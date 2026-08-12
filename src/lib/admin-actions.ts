"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperadmin } from "@/lib/admin-data";
import { DataError, errorMessage, type ActionResult } from "@/lib/errors";
import { isValidDomain, normalizeDomain } from "@/lib/slug";
import {
  dbError,
  deleteRow,
  setRowActive,
  writeCombination,
  writePeriod,
  writeSettings,
  writeStrictTableCapacity,
  writeTable,
  type CombinationInput,
  type PeriodInput,
  type SettingsInput,
  type TableInput,
} from "@/lib/restaurant-config";

/**
 * Onboarding writes performed by Terron Studio superadmins.
 *
 * Unlike the restaurant-facing actions, the restaurant is named by id from the
 * URL. That is only safe because every function calls requireSuperadmin() first
 * — a restaurant user reaching these actions is redirected out before any write
 * — and because the shared writers still scope each statement by restaurant_id
 * under RLS. Owner invitations use a separate server-only Supabase client with
 * the project's secret key, after the same superadmin check has succeeded.
 */

const ADMIN_PATHS = ["/admin", "/admin/restaurants"];

function revalidateRestaurant(restaurantId: string) {
  for (const path of ADMIN_PATHS) revalidatePath(path);
  revalidatePath(`/admin/restaurants/${restaurantId}`);
}

async function run(
  restaurantId: string,
  write: () => Promise<ActionResult>
): Promise<ActionResult> {
  try {
    await requireSuperadmin();
    const result = await write();
    if (result.ok) revalidateRestaurant(restaurantId);
    return result;
  } catch (error) {
    // requireSuperadmin() redirects non-admins; let that through.
    unstable_rethrow(error);
    return { ok: false, error: errorMessage(error) };
  }
}

// ------------------------------------------------------ restaurant basics

export interface RestaurantBasicsInput {
  name: string;
  domain: string;
  ownerEmail: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ownerEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return EMAIL.test(email) ? email : null;
}

function inviteRedirectUrl(): string {
  const configured = process.env.APP_URL?.trim();
  if (!configured) {
    throw new DataError("Owner invitations are not configured. Add APP_URL.");
  }

  try {
    const url = new URL("/set-password", configured);
    if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error();
    return url.toString();
  } catch {
    throw new DataError("APP_URL must be a valid HTTPS application URL.");
  }
}

function inviteError(error: { code?: string; message?: string } | null): string {
  const code = error?.code ?? "";
  const message = error?.message?.toLowerCase() ?? "";
  if (
    code === "email_exists" ||
    code === "user_already_exists" ||
    message.includes("already been registered") ||
    message.includes("already exists")
  ) {
    return "That email already belongs to an account. Use a new email address.";
  }
  if (code === "over_email_send_rate_limit") {
    return "Supabase's email limit has been reached. Wait a moment and try again.";
  }
  return "Could not send the owner invitation. Please try again.";
}

async function inviteOwner(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  restaurantName: string,
  redirectTo: string
) {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      restaurant_name: restaurantName,
      account_role: "restaurant_owner",
    },
  });

  if (error || !data.user) {
    return { ok: false as const, error: inviteError(error) };
  }
  return { ok: true as const, userId: data.user.id };
}

async function removePreviousOwnerAccounts(
  admin: ReturnType<typeof createAdminClient>,
  previousOwnerIds: string[]
) {
  for (const userId of previousOwnerIds) {
    const [membershipCheck, profileCheck] = await Promise.all([
      admin
        .from("restaurant_users")
        .select("user_id", { count: "exact", head: true })
        .eq("user_id", userId),
      admin
        .from("user_profiles")
        .select("global_role")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    if (membershipCheck.error || profileCheck.error) {
      console.error(
        "Could not verify whether replaced owner account is shared",
        userId,
        membershipCheck.error ?? profileCheck.error
      );
      continue;
    }

    // A shared account or superadmin must survive; only this restaurant's
    // membership is removed. Ordinary single-restaurant accounts are deleted.
    const isSuperadmin =
      String(
        (profileCheck.data as Record<string, unknown> | null)?.global_role ?? ""
      ) ===
      "superadmin";
    if ((membershipCheck.count ?? 0) === 0 && !isSuperadmin) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) {
        // Access is already revoked by deleting restaurant_users. Keep the save
        // successful even if Supabase leaves an inaccessible orphan to clean up.
        console.error("Could not delete replaced restaurant owner", userId, error);
      }
    }
  }
}

/**
 * Step 1. Creates the restaurant inactive: the reservation backend resolves a
 * booking through restaurants.slug, so nothing should be reachable until the
 * rest of the configuration exists and a superadmin activates it.
 */
export async function createRestaurant(
  input: RestaurantBasicsInput
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireSuperadmin();
    const supabase = await createClient();

    const name = input.name.trim();
    if (!name) return { ok: false, error: "Enter the restaurant's name." };

    const slug = normalizeDomain(input.domain);
    if (!slug) return { ok: false, error: "Enter the restaurant's website domain." };
    if (!isValidDomain(slug)) {
      return {
        ok: false,
        error: `“${slug}” is not a valid domain. Use something like restaurant.com.`,
      };
    }

    const email = ownerEmail(input.ownerEmail);
    if (!email) return { ok: false, error: "Enter a valid owner email address." };

    const { data: existing } = await supabase
      .from("restaurants")
      .select("id, name")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      return {
        ok: false,
        error: `${slug} is already used by another restaurant. Each domain can only be onboarded once.`,
      };
    }

    const redirectTo = inviteRedirectUrl();
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("restaurants")
      .insert({ name, slug, active: false })
      .select("id")
      .single();

    if (error || !data) return { ok: false, error: dbError(error) };

    const id = String((data as { id: unknown }).id);
    const invitation = await inviteOwner(admin, email, name, redirectTo);
    if (!invitation.ok) {
      await admin.from("restaurants").delete().eq("id", id);
      return invitation;
    }

    const { userId } = invitation;
    const { error: membershipError } = await admin.from("restaurant_users").insert({
      user_id: userId,
      restaurant_id: id,
      role: "owner",
    });

    if (membershipError) {
      await admin.from("restaurants").delete().eq("id", id);
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, error: "Could not assign the owner. Please try again." };
    }

    revalidateRestaurant(id);
    return { ok: true, data: { id } };
  } catch (error) {
    // requireSuperadmin() redirects non-admins; let that through.
    unstable_rethrow(error);
    return { ok: false, error: errorMessage(error) };
  }
}

export async function updateRestaurantBasics(
  restaurantId: string,
  input: RestaurantBasicsInput
): Promise<ActionResult> {
  return run(restaurantId, async () => {
    const supabase = await createClient();

    const name = input.name.trim();
    if (!name) return { ok: false, error: "Enter the restaurant's name." };

    const slug = normalizeDomain(input.domain);
    if (!slug) return { ok: false, error: "Enter the restaurant's website domain." };
    if (!isValidDomain(slug)) {
      return {
        ok: false,
        error: `“${slug}” is not a valid domain. Use something like restaurant.com.`,
      };
    }

    const email = ownerEmail(input.ownerEmail);
    if (!email) return { ok: false, error: "Enter a valid owner email address." };

    const { data: clash } = await supabase
      .from("restaurants")
      .select("id")
      .eq("slug", slug)
      .neq("id", restaurantId)
      .maybeSingle();

    if (clash) {
      return {
        ok: false,
        error: `${slug} is already used by another restaurant.`,
      };
    }

    const admin = createAdminClient();
    const { data: ownerRows, error: ownerRowsError } = await admin
      .from("restaurant_users")
      .select("user_id")
      .eq("restaurant_id", restaurantId)
      .eq("role", "owner");

    if (ownerRowsError) {
      return { ok: false, error: "Could not load the current owner." };
    }

    const previousOwnerIds = (ownerRows ?? [])
      .map((row) => String(row.user_id ?? ""))
      .filter(Boolean);
    const previousOwners = await Promise.all(
      previousOwnerIds.map((id) => admin.auth.admin.getUserById(id))
    );
    const emailUnchanged = previousOwners.some(
      ({ data }) => data.user?.email?.toLowerCase() === email
    );

    if (emailUnchanged) {
      const { error } = await supabase
        .from("restaurants")
        .update({ name, slug })
        .eq("id", restaurantId);
      if (error) return { ok: false, error: dbError(error) };
      return { ok: true, data: undefined };
    }

    const invitation = await inviteOwner(admin, email, name, inviteRedirectUrl());
    if (!invitation.ok) return invitation;

    const newOwnerId = invitation.userId;
    const { error: membershipError } = await admin.from("restaurant_users").insert({
      user_id: newOwnerId,
      restaurant_id: restaurantId,
      role: "owner",
    });
    if (membershipError) {
      await admin.auth.admin.deleteUser(newOwnerId);
      return { ok: false, error: "Could not assign the new owner. Please try again." };
    }

    const { error } = await supabase
      .from("restaurants")
      .update({ name, slug })
      .eq("id", restaurantId);

    if (error) {
      await admin
        .from("restaurant_users")
        .delete()
        .eq("restaurant_id", restaurantId)
        .eq("user_id", newOwnerId);
      await admin.auth.admin.deleteUser(newOwnerId);
      return { ok: false, error: dbError(error) };
    }

    if (previousOwnerIds.length > 0) {
      const { error: removalError } = await admin
        .from("restaurant_users")
        .delete()
        .eq("restaurant_id", restaurantId)
        .eq("role", "owner")
        .in("user_id", previousOwnerIds);
      if (removalError) {
        await admin
          .from("restaurant_users")
          .delete()
          .eq("restaurant_id", restaurantId)
          .eq("user_id", newOwnerId);
        await admin.auth.admin.deleteUser(newOwnerId);
        return { ok: false, error: "Could not replace the current owner." };
      }
      await removePreviousOwnerAccounts(admin, previousOwnerIds);
    }

    return { ok: true, data: undefined };
  });
}

/** Step 7, and the activate/deactivate control on the restaurants list. */
export async function setRestaurantActive(
  restaurantId: string,
  active: boolean
): Promise<ActionResult> {
  return run(restaurantId, async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("restaurants")
      .update({ active })
      .eq("id", restaurantId);

    if (error) return { ok: false, error: dbError(error) };
    return { ok: true, data: undefined };
  });
}

// ------------------------------------------------------- step 2: settings

export async function saveSettingsFor(
  restaurantId: string,
  input: SettingsInput
): Promise<ActionResult> {
  return run(restaurantId, () => writeSettings(restaurantId, input));
}

export async function saveStrictTableCapacityFor(
  restaurantId: string,
  enabled: boolean
): Promise<ActionResult> {
  return run(restaurantId, () => writeStrictTableCapacity(restaurantId, enabled));
}

// ------------------------------------------------------- step 3: schedule

export async function savePeriodFor(
  restaurantId: string,
  input: PeriodInput
): Promise<ActionResult> {
  return run(restaurantId, () => writePeriod(restaurantId, input));
}

export async function setPeriodActiveFor(
  restaurantId: string,
  periodId: string,
  active: boolean
): Promise<ActionResult> {
  return run(restaurantId, () =>
    setRowActive("booking_hours", restaurantId, periodId, active)
  );
}

export async function deletePeriodFor(
  restaurantId: string,
  periodId: string
): Promise<ActionResult> {
  return run(restaurantId, () =>
    deleteRow("booking_hours", restaurantId, periodId)
  );
}

// --------------------------------------------------------- step 4: tables

export async function saveTableFor(
  restaurantId: string,
  input: TableInput
): Promise<ActionResult> {
  return run(restaurantId, () => writeTable(restaurantId, input));
}

export async function setTableActiveFor(
  restaurantId: string,
  tableId: string,
  active: boolean
): Promise<ActionResult> {
  return run(restaurantId, () =>
    setRowActive("restaurant_tables", restaurantId, tableId, active)
  );
}

/**
 * Deleting is offered during onboarding, where a mistyped table has no history.
 * A table that any booking has referenced fails the foreign key and the error
 * tells the superadmin to take it out of service instead.
 */
export async function deleteTableFor(
  restaurantId: string,
  tableId: string
): Promise<ActionResult> {
  return run(restaurantId, () =>
    deleteRow("restaurant_tables", restaurantId, tableId)
  );
}

// --------------------------------------------------- step 5: combinations

export async function saveCombinationFor(
  restaurantId: string,
  input: CombinationInput
): Promise<ActionResult> {
  return run(restaurantId, () => writeCombination(restaurantId, input));
}

export async function setCombinationActiveFor(
  restaurantId: string,
  combinationId: string,
  active: boolean
): Promise<ActionResult> {
  return run(restaurantId, () =>
    setRowActive("table_combinations", restaurantId, combinationId, active)
  );
}

export async function deleteCombinationFor(
  restaurantId: string,
  combinationId: string
): Promise<ActionResult> {
  return run(restaurantId, () =>
    deleteRow("table_combinations", restaurantId, combinationId)
  );
}

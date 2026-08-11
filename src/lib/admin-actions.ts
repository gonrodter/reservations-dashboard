"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSuperadmin } from "@/lib/admin-data";
import { errorMessage, type ActionResult } from "@/lib/errors";
import { isValidDomain, normalizeDomain } from "@/lib/slug";
import {
  dbError,
  deleteRow,
  setRowActive,
  writeCombination,
  writePeriod,
  writeSettings,
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
 * under RLS. No service_role key is involved anywhere.
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

    const { data, error } = await supabase
      .from("restaurants")
      .insert({ name, slug, active: false })
      .select("id")
      .single();

    if (error || !data) return { ok: false, error: dbError(error) };

    const id = String((data as { id: unknown }).id);
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

    const { error } = await supabase
      .from("restaurants")
      .update({ name, slug })
      .eq("id", restaurantId);

    if (error) return { ok: false, error: dbError(error) };
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

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBookingsBetween, getSettings, getTables } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import {
  Booking,
  BookingHour,
  Restaurant,
  RestaurantSettings,
  RestaurantTable,
  TableCombination,
  normalizeBookingHour,
  normalizeCombination,
  normalizeRestaurant,
  normalizeSettings,
  normalizeTable,
  linkIds,
} from "@/lib/types";
import { DataError } from "@/lib/errors";

export const SUPERADMIN = "superadmin";

export interface AdminRestaurant extends Restaurant {
  active: boolean;
  createdAt: string | null;
}

function normalizeAdminRestaurant(row: Record<string, unknown>): AdminRestaurant {
  const base = normalizeRestaurant(row);
  const active = row.active;
  return {
    ...base,
    // A missing column reads as inactive rather than silently "live".
    active: active === true || active === "true" || active === "t",
    createdAt: row.created_at ? String(row.created_at) : null,
  };
}

/**
 * Gate for every admin route and every admin write.
 *
 * Access comes only from the authenticated user's user_profiles.global_role.
 * Nothing about the request body or URL can grant it, and a restaurant user who
 * reaches an /admin URL is sent back to their own dashboard rather than shown
 * an error, because for them the area does not exist.
 */
export const requireSuperadmin = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, full_name, global_role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new DataError("Could not verify your administrator access.");
  }

  const role = data ? String((data as Record<string, unknown>).global_role ?? "") : "";
  if (role !== SUPERADMIN) redirect("/");

  return {
    user,
    fullName: data ? (String((data as Record<string, unknown>).full_name ?? "") || null) : null,
  };
});

/** True when the signed-in user is a superadmin, without redirecting. */
export async function isSuperadmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("user_profiles")
    .select("global_role")
    .eq("id", user.id)
    .maybeSingle();

  return (
    !!data && String((data as Record<string, unknown>).global_role ?? "") === SUPERADMIN
  );
}

export async function listRestaurants(): Promise<AdminRestaurant[]> {
  await requireSuperadmin();
  const supabase = await createClient();

  const { data, error } = await supabase.from("restaurants").select("*");
  if (error) throw new DataError("Could not load the restaurant list.");

  const restaurants = (data ?? []).map((row) =>
    normalizeAdminRestaurant(row as Record<string, unknown>)
  );
  restaurants.sort(
    (a, b) =>
      Number(a.active) - Number(b.active) ||
      (b.createdAt ?? "").localeCompare(a.createdAt ?? "") ||
      a.name.localeCompare(b.name)
  );
  return restaurants;
}

export interface FloorSnapshot {
  restaurant: AdminRestaurant;
  tables: RestaurantTable[];
  bookings: Booking[];
  today: string;
  /** The instant this snapshot was read, for a stable first paint. */
  readAt: number;
  /** Fallback sitting length for bookings with no ends_at. */
  defaultDurationMinutes: number | null;
}

/**
 * Today's floor for one restaurant, exactly as its own team sees it on their
 * Today screen — same tables, same bookings, same timezone. Reuses the
 * restaurant-facing readers rather than duplicating the queries; RLS still
 * decides what comes back, and the superadmin check runs first.
 */
export async function getRestaurantFloor(
  restaurantId: string
): Promise<FloorSnapshot | null> {
  await requireSuperadmin();
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error) throw new DataError("Could not load this restaurant.");
  if (!row) return null;

  const base = normalizeAdminRestaurant(row as Record<string, unknown>);
  const settings = await getSettings(restaurantId);
  const restaurant: AdminRestaurant = {
    ...base,
    name: settings?.restaurantName ?? base.name,
    timezone: settings?.timezone ?? base.timezone,
  };

  const readAt = Date.now();
  const today = todayISO(restaurant.timezone, new Date(readAt));
  const [tables, bookings] = await Promise.all([
    getTables(restaurantId),
    getBookingsBetween(restaurant, today, today),
  ]);

  return {
    restaurant,
    tables,
    bookings,
    today,
    readAt,
    defaultDurationMinutes: settings?.defaultBookingDurationMinutes ?? null,
  };
}

export interface OnboardingStatus {
  owner: boolean;
  settings: boolean;
  schedule: boolean;
  tables: boolean;
  combinations: boolean;
  readyToActivate: boolean;
}

export interface RestaurantConfig {
  restaurant: AdminRestaurant;
  owner: {
    id: string;
    email: string;
  } | null;
  settings: RestaurantSettings | null;
  bookingHours: BookingHour[];
  tables: RestaurantTable[];
  combinations: TableCombination[];
  status: OnboardingStatus;
}

/**
 * Everything the wizard needs for one restaurant, plus which steps are already
 * done. Completion is derived from the rows that exist in Supabase, never from
 * wizard state, so onboarding can be abandoned and picked up later — in another
 * session, on another machine, by another superadmin.
 */
export async function getRestaurantConfig(
  restaurantId: string
): Promise<RestaurantConfig | null> {
  await requireSuperadmin();
  const supabase = await createClient();

  const { data: restaurantRow, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .maybeSingle();

  if (error) throw new DataError("Could not load this restaurant.");
  if (!restaurantRow) return null;

  const admin = createAdminClient();
  const { data: ownerMemberships, error: ownerMembershipError } = await admin
    .from("restaurant_users")
    .select("user_id")
    .eq("restaurant_id", restaurantId)
    .eq("role", "owner")
    .limit(1);

  if (ownerMembershipError) {
    throw new DataError("Could not load this restaurant's owner.");
  }

  const ownerId = ownerMemberships?.[0]?.user_id
    ? String(ownerMemberships[0].user_id)
    : null;
  let owner: RestaurantConfig["owner"] = null;

  if (ownerId) {
    const { data: ownerData, error: ownerError } =
      await admin.auth.admin.getUserById(ownerId);
    if (ownerError && ownerError.code !== "user_not_found") {
      throw new DataError("Could not load this restaurant's owner.");
    }
    if (ownerData.user?.email) {
      owner = { id: ownerId, email: ownerData.user.email };
    }
  }

  const [settingsResult, hoursResult, tablesResult, combinationsResult] =
    await Promise.all([
      supabase
        .from("restaurant_settings")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .maybeSingle(),
      supabase.from("booking_hours").select("*").eq("restaurant_id", restaurantId),
      supabase.from("restaurant_tables").select("*").eq("restaurant_id", restaurantId),
      supabase.from("table_combinations").select("*").eq("restaurant_id", restaurantId),
    ]);

  const settings = settingsResult.data
    ? normalizeSettings(settingsResult.data as Record<string, unknown>)
    : null;

  const bookingHours = (hoursResult.data ?? []).map((row) =>
    normalizeBookingHour(row as Record<string, unknown>)
  );
  bookingHours.sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)
  );

  const tables = (tablesResult.data ?? []).map((row) =>
    normalizeTable(row as Record<string, unknown>)
  );
  tables.sort(
    (a, b) =>
      (a.zone ?? "").localeCompare(b.zone ?? "") ||
      a.name.localeCompare(b.name, undefined, { numeric: true })
  );

  const combinationRows = (combinationsResult.data ?? []) as Record<string, unknown>[];
  const combinationIds = combinationRows.map((row) => String(row.id ?? "")).filter(Boolean);

  const membersByCombination = new Map<string, string[]>();
  if (combinationIds.length > 0) {
    const { data: members } = await supabase
      .from("table_combination_members")
      .select("*")
      .in("combination_id", combinationIds);

    for (const member of members ?? []) {
      const link = linkIds(
        member as Record<string, unknown>,
        ["combination_id", "table_combination_id"],
        ["table_id", "restaurant_table_id"]
      );
      if (!link) continue;
      const list = membersByCombination.get(link.left) ?? [];
      list.push(link.right);
      membersByCombination.set(link.left, list);
    }
  }

  const combinations = combinationRows.map((row) =>
    normalizeCombination(row, membersByCombination.get(String(row.id ?? "")) ?? [])
  );
  combinations.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const settingsComplete =
    settings !== null &&
    settings.timezone !== null &&
    settings.slotIntervalMinutes !== null &&
    settings.defaultBookingDurationMinutes !== null &&
    settings.maxOnlinePartySize !== null &&
    settings.minAdvanceMinutes !== null &&
    settings.maxAdvanceDays !== null;

  const scheduleComplete = bookingHours.some((hour) => hour.active);
  const tablesComplete = tables.some((table) => table.active);

  return {
    restaurant: normalizeAdminRestaurant(restaurantRow as Record<string, unknown>),
    owner,
    settings,
    bookingHours,
    tables,
    combinations,
    status: {
      owner: owner !== null,
      settings: settingsComplete,
      schedule: scheduleComplete,
      tables: tablesComplete,
      // Combinations are genuinely optional, so the step never blocks activation.
      combinations: combinations.length > 0,
      readyToActivate:
        owner !== null && settingsComplete && scheduleComplete && tablesComplete,
    },
  };
}

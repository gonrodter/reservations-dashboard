import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Booking,
  BookingHour,
  Restaurant,
  RestaurantSettings,
  RestaurantTable,
  SpecialDate,
  TableCombination,
  linkIds,
  normalizeBooking,
  normalizeBookingHour,
  normalizeCombination,
  normalizeRestaurant,
  normalizeSettings,
  normalizeSpecialDate,
  normalizeTable,
} from "@/lib/types";
import { todayISO } from "@/lib/dates";
import { DataError } from "@/lib/errors";

function fail(message: string): never {
  throw new DataError(message);
}

/**
 * Resolves the signed-in user and the restaurant they may act on, via
 * restaurant_users under RLS. Restaurant identity never comes from the URL
 * or any other client-supplied value.
 */
export const getSessionContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: memberships, error: membershipError } = await supabase
    .from("restaurant_users")
    .select("restaurant_id, role")
    .eq("user_id", user.id);

  if (membershipError) fail("No se pudo cargar tu acceso al restaurante.");

  const restaurantIds = [
    ...new Set(
      (memberships ?? [])
        .map((m) => (m as Record<string, unknown>).restaurant_id)
        .filter(Boolean)
        .map(String)
    ),
  ];

  if (restaurantIds.length === 0) {
    return { user, restaurant: null, restaurants: [] as Restaurant[], role: null };
  }

  const { data: restaurantRows, error: restaurantError } = await supabase
    .from("restaurants")
    .select("*")
    .in("id", restaurantIds);

  if (restaurantError || !restaurantRows?.length) {
    fail("No se pudo cargar tu restaurante.");
  }

  const restaurants = restaurantRows.map((row) =>
    normalizeRestaurant(row as Record<string, unknown>)
  );

  // MVP behaviour retained: a single assigned restaurant is selected
  // automatically. The array keeps a future switcher possible.
  const selected = restaurants[0];

  // restaurant_settings wins over the restaurants row for name and timezone,
  // because the settings page is where staff edit them.
  const settings = await getSettings(selected.id);
  const restaurant: Restaurant = {
    ...selected,
    name: settings?.restaurantName ?? selected.name,
    timezone: settings?.timezone ?? selected.timezone,
  };

  const role =
    (memberships ?? [])
      .map((m) => (m as Record<string, unknown>).role)
      .filter(Boolean)
      .map(String)[0] ?? null;

  return { user, restaurant, restaurants, role };
});

/** Session restaurant, or a readable error for callers that cannot proceed without one. */
export async function requireRestaurant(): Promise<Restaurant> {
  const { restaurant } = await getSessionContext();
  if (!restaurant) fail("Tu cuenta todavía no tiene ningún restaurante asignado.");
  return restaurant;
}

export const getSettings = cache(
  async (restaurantId: string): Promise<RestaurantSettings | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("restaurant_settings")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();

    if (error || !data) return null;
    return normalizeSettings(data as Record<string, unknown>);
  }
);

export const getTables = cache(
  async (restaurantId: string): Promise<RestaurantTable[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("restaurant_tables")
      .select("*")
      .eq("restaurant_id", restaurantId);

    if (error) return [];
    const tables = (data ?? []).map((row) =>
      normalizeTable(row as Record<string, unknown>)
    );
    tables.sort((a, b) =>
      (a.zone ?? "").localeCompare(b.zone ?? "") ||
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
    return tables;
  }
);

export const getCombinations = cache(
  async (restaurantId: string): Promise<TableCombination[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("table_combinations")
      .select("*")
      .eq("restaurant_id", restaurantId);

    if (error) return [];
    const rows = (data ?? []) as Record<string, unknown>[];
    const ids = rows.map((row) => String(row.id ?? "")).filter(Boolean);

    const membersByCombination = new Map<string, string[]>();
    if (ids.length > 0) {
      const { data: members } = await supabase
        .from("table_combination_members")
        .select("*")
        .in("combination_id", ids);

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

    const combinations = rows.map((row) =>
      normalizeCombination(row, membersByCombination.get(String(row.id ?? "")) ?? [])
    );
    combinations.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    return combinations;
  }
);

export const getBookingHours = cache(
  async (restaurantId: string): Promise<BookingHour[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("booking_hours")
      .select("*")
      .eq("restaurant_id", restaurantId);

    if (error) return [];
    const hours = (data ?? []).map((row) =>
      normalizeBookingHour(row as Record<string, unknown>)
    );
    hours.sort(
      (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)
    );
    return hours;
  }
);

export const getSpecialDates = cache(
  async (restaurantId: string): Promise<SpecialDate[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("special_dates")
      .select("*")
      .eq("restaurant_id", restaurantId);

    if (error) return [];
    const dates = (data ?? []).map((row) =>
      normalizeSpecialDate(row as Record<string, unknown>)
    );
    dates.sort((a, b) => a.date.localeCompare(b.date));
    return dates;
  }
);

/** Attaches assigned physical tables to a set of bookings. */
async function attachTables(
  rows: Record<string, unknown>[],
  tables: RestaurantTable[],
  timezone?: string
): Promise<Booking[]> {
  const supabase = await createClient();
  const bookingIds = rows.map((row) => String(row.id ?? "")).filter(Boolean);

  const tablesByBooking = new Map<string, RestaurantTable[]>();
  if (bookingIds.length > 0 && tables.length > 0) {
    const { data: links } = await supabase
      .from("booking_tables")
      .select("*")
      .in("booking_id", bookingIds);

    const tableById = new Map(tables.map((table) => [table.id, table]));
    for (const link of links ?? []) {
      const ids = linkIds(
        link as Record<string, unknown>,
        ["booking_id"],
        ["table_id", "restaurant_table_id"]
      );
      if (!ids) continue;
      const table = tableById.get(ids.right);
      if (!table) continue;
      const list = tablesByBooking.get(ids.left) ?? [];
      list.push(table);
      tablesByBooking.set(ids.left, list);
    }
  }

  const bookings = rows.map((row) =>
    normalizeBooking(row, tablesByBooking.get(String(row.id ?? "")) ?? [], timezone)
  );
  bookings.sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
  return bookings;
}

/** Bookings belonging to the operational service-date range, inclusive. */
export async function getBookingsBetween(
  restaurant: Restaurant,
  fromDate: string,
  toDate: string
): Promise<Booking[]> {
  const supabase = await createClient();
  const [tables, result] = await Promise.all([
    getTables(restaurant.id),
    supabase
      .from("bookings")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .gte("service_date", fromDate)
      .lte("service_date", toDate)
      .order("starts_at", { ascending: true })
      .limit(2000),
  ]);

  if (result.error) fail("No se pudieron cargar las reservas.");
  return attachTables(result.data as Record<string, unknown>[], tables, restaurant.timezone);
}

export async function getBookingById(
  restaurant: Restaurant,
  bookingId: string
): Promise<Booking | null> {
  const supabase = await createClient();
  const [tables, result] = await Promise.all([
    getTables(restaurant.id),
    supabase
      .from("bookings")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("id", bookingId)
      .maybeSingle(),
  ]);

  if (result.error || !result.data) return null;
  const [booking] = await attachTables(
    [result.data as Record<string, unknown>],
    tables,
    restaurant.timezone
  );
  return booking ?? null;
}

/**
 * Today's reservations, plus the instant they were read. The caller passes that
 * instant down so the first paint on the client matches the server's, instead of
 * both sides reading their own clock.
 */
export async function getTodayBookings(restaurant: Restaurant) {
  const readAt = Date.now();
  const today = todayISO(restaurant.timezone, new Date(readAt));
  return {
    today,
    readAt,
    bookings: await getBookingsBetween(restaurant, today, today),
  };
}


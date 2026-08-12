import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/errors";
import { impliesNextDay } from "@/lib/dates";

/**
 * Validated configuration writes for one restaurant, identified by id.
 *
 * Callers are responsible for establishing that the caller may touch that
 * restaurant: the restaurant-facing actions resolve the id from the session's
 * restaurant_users membership, and the admin actions resolve it from the URL
 * only after confirming the user is a superadmin. Every statement here is also
 * scoped by restaurant_id, so even a mistaken id cannot cross restaurants, and
 * RLS remains the final authority.
 */

const TIME = /^\d{2}:\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type ConfigTable =
  | "restaurant_tables"
  | "table_combinations"
  | "booking_hours"
  | "special_dates";

/** Postgres errors, translated for the person looking at the form. */
export function dbError(error: { code?: string; message?: string } | null): string {
  if (error?.code === "23505") return "That already exists. Use a different name.";
  if (error?.code === "23503") {
    return "That change conflicts with existing records. Take it out of service instead.";
  }
  if (error?.code === "42501") {
    return "You do not have permission to change this setting.";
  }
  return "Could not save your changes. Please try again.";
}

function clampInt(
  value: unknown,
  min: number,
  max: number
): { ok: true; value: number } | { ok: false } {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    return { ok: false };
  }
  return { ok: true, value: n };
}

// ---------------------------------------------------------------- tables

export interface TableInput {
  id?: string;
  name: string;
  capacity: number;
  zone: string;
  active: boolean;
}

export async function writeTable(
  restaurantId: string,
  input: TableInput
): Promise<ActionResult> {
  const supabase = await createClient();

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Give the table a name." };

  const capacity = clampInt(input.capacity, 1, 50);
  if (!capacity.ok) {
    return { ok: false, error: "Seats must be a whole number between 1 and 50." };
  }

  const values = {
    name,
    capacity: capacity.value,
    zone: input.zone.trim() || null,
    active: input.active,
  };

  const { error } = input.id
    ? await supabase
        .from("restaurant_tables")
        .update(values)
        .eq("id", input.id)
        .eq("restaurant_id", restaurantId)
    : await supabase
        .from("restaurant_tables")
        .insert({ ...values, restaurant_id: restaurantId });

  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, data: undefined };
}

// ---------------------------------------------------- table combinations

export interface CombinationInput {
  id?: string;
  name: string;
  capacity: number;
  active: boolean;
  memberIds: string[];
}

export async function writeCombination(
  restaurantId: string,
  input: CombinationInput
): Promise<ActionResult> {
  const supabase = await createClient();

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Give the combination a name." };

  const memberIds = [...new Set(input.memberIds.filter(Boolean))];
  if (memberIds.length < 2) {
    return { ok: false, error: "Pick at least two tables to join." };
  }

  const capacity = clampInt(input.capacity, 1, 200);
  if (!capacity.ok) {
    return { ok: false, error: "Seats must be a whole number between 1 and 200." };
  }

  // Members must belong to this restaurant. Checked server-side so a tampered
  // request can never join a table from a different restaurant.
  const { data: owned, error: ownedError } = await supabase
    .from("restaurant_tables")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .in("id", memberIds);

  if (ownedError) return { ok: false, error: dbError(ownedError) };
  if ((owned ?? []).length !== memberIds.length) {
    return {
      ok: false,
      error: "One of those tables does not belong to this restaurant.",
    };
  }

  const values = { name, capacity: capacity.value, active: input.active };
  let combinationId = input.id;

  if (combinationId) {
    const { error } = await supabase
      .from("table_combinations")
      .update(values)
      .eq("id", combinationId)
      .eq("restaurant_id", restaurantId);
    if (error) return { ok: false, error: dbError(error) };
  } else {
    const { data, error } = await supabase
      .from("table_combinations")
      .insert({ ...values, restaurant_id: restaurantId })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: dbError(error) };
    combinationId = String((data as { id: unknown }).id);
  }

  // Membership is replaced wholesale: idempotent, and the set is always tiny.
  const { error: clearError } = await supabase
    .from("table_combination_members")
    .delete()
    .eq("combination_id", combinationId);
  if (clearError) return { ok: false, error: dbError(clearError) };

  const { error: insertError } = await supabase
    .from("table_combination_members")
    .insert(
      memberIds.map((tableId) => ({
        combination_id: combinationId,
        table_id: tableId,
      }))
    );
  if (insertError) return { ok: false, error: dbError(insertError) };

  return { ok: true, data: undefined };
}

// -------------------------------------------------------- booking hours

export interface PeriodInput {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  active: boolean;
}

export async function writePeriod(
  restaurantId: string,
  input: PeriodInput
): Promise<ActionResult> {
  const supabase = await createClient();

  if (input.dayOfWeek < 0 || input.dayOfWeek > 6) {
    return { ok: false, error: "Pick a day of the week." };
  }
  if (!TIME.test(input.startTime) || !TIME.test(input.endTime)) {
    return { ok: false, error: "Enter both a start and an end time." };
  }
  if (input.startTime === input.endTime) {
    return { ok: false, error: "The start and end time cannot be the same." };
  }

  // An end time at or before the start means service runs past midnight.
  const values = {
    day_of_week: input.dayOfWeek,
    start_time: input.startTime,
    end_time: input.endTime,
    spans_next_day: impliesNextDay(input.startTime, input.endTime),
    active: input.active,
  };

  const { error } = input.id
    ? await supabase
        .from("booking_hours")
        .update(values)
        .eq("id", input.id)
        .eq("restaurant_id", restaurantId)
    : await supabase
        .from("booking_hours")
        .insert({ ...values, restaurant_id: restaurantId });

  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, data: undefined };
}

// --------------------------------------------------------- special dates

export interface SpecialDateInput {
  id?: string;
  date: string;
  closed: boolean;
  startTime: string;
  endTime: string;
  note: string;
}

export async function writeSpecialDate(
  restaurantId: string,
  input: SpecialDateInput
): Promise<ActionResult> {
  const supabase = await createClient();

  if (!DATE.test(input.date)) return { ok: false, error: "Pick a date." };

  let startTime: string | null = null;
  let endTime: string | null = null;
  let spansNextDay = false;

  if (!input.closed) {
    if (!TIME.test(input.startTime) || !TIME.test(input.endTime)) {
      return {
        ok: false,
        error: "Enter the hours for this date, or mark the restaurant as closed.",
      };
    }
    if (input.startTime === input.endTime) {
      return { ok: false, error: "The start and end time cannot be the same." };
    }
    startTime = input.startTime;
    endTime = input.endTime;
    spansNextDay = impliesNextDay(startTime, endTime);
  }

  const values = {
    date: input.date,
    closed: input.closed,
    start_time: startTime,
    end_time: endTime,
    spans_next_day: spansNextDay,
    note: input.note.trim() || null,
  };

  const { error } = input.id
    ? await supabase
        .from("special_dates")
        .update(values)
        .eq("id", input.id)
        .eq("restaurant_id", restaurantId)
    : await supabase
        .from("special_dates")
        .insert({ ...values, restaurant_id: restaurantId });

  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, data: undefined };
}

// -------------------------------------------------------------- settings

export interface SettingsInput {
  restaurantName: string;
  timezone: string;
  slotIntervalMinutes: number;
  defaultBookingDurationMinutes: number;
  maxOnlinePartySize: number;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
  strictTableCapacity: boolean;
}

export async function writeSettings(
  restaurantId: string,
  input: SettingsInput
): Promise<ActionResult> {
  const supabase = await createClient();

  const name = input.restaurantName.trim();
  if (!name) return { ok: false, error: "The restaurant needs a name." };

  const timezone = input.timezone.trim();
  if (!timezone) return { ok: false, error: "Choose the restaurant's timezone." };
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone });
  } catch {
    return { ok: false, error: "That is not a valid timezone." };
  }
  if (typeof input.strictTableCapacity !== "boolean") {
    return { ok: false, error: "Choose a valid table assignment rule." };
  }

  const checks: [keyof SettingsInput, number, number, string][] = [
    ["slotIntervalMinutes", 5, 240, "Time between slots must be 5 to 240 minutes."],
    [
      "defaultBookingDurationMinutes",
      15,
      600,
      "Reservation duration must be 15 to 600 minutes.",
    ],
    ["maxOnlinePartySize", 1, 100, "Maximum online party must be 1 to 100 guests."],
    ["minAdvanceMinutes", 0, 10080, "Minimum notice must be 0 to 10080 minutes."],
    ["maxAdvanceDays", 1, 730, "Booking window must be 1 to 730 days."],
  ];

  const numbers: Record<string, number> = {};
  for (const [key, min, max, message] of checks) {
    const parsed = clampInt(input[key], min, max);
    if (!parsed.ok) return { ok: false, error: message };
    numbers[key] = parsed.value;
  }

  const { error } = await supabase.from("restaurant_settings").upsert(
    {
      restaurant_id: restaurantId,
      restaurant_name: name,
      timezone,
      slot_interval_minutes: numbers.slotIntervalMinutes,
      default_booking_duration_minutes: numbers.defaultBookingDurationMinutes,
      max_online_party_size: numbers.maxOnlinePartySize,
      min_advance_minutes: numbers.minAdvanceMinutes,
      max_advance_days: numbers.maxAdvanceDays,
      strict_table_capacity: input.strictTableCapacity,
    },
    { onConflict: "restaurant_id" }
  );

  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, data: undefined };
}

/** Update the table-fitting rule from the Tables screen without resaving all settings. */
export async function writeStrictTableCapacity(
  restaurantId: string,
  enabled: boolean
): Promise<ActionResult> {
  if (typeof enabled !== "boolean") {
    return { ok: false, error: "Choose a valid table assignment rule." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("restaurant_settings")
    .update({ strict_table_capacity: enabled })
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------- floor layout

export interface TablePosition {
  id: string;
  x: number;
  y: number;
}

/**
 * True when Postgres rejected the statement because grid_x / grid_y are not in
 * the schema. The floor map works without them — it just falls back to its
 * default arrangement — so this is reported as its own actionable message
 * instead of the generic save error.
 */
function isMissingLayoutColumn(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  const text = (error.message ?? "").toLowerCase();
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    text.includes("grid_x") ||
    text.includes("grid_y")
  );
}

/**
 * Saves where each table sits on the floor map. Positions are whole grid
 * coordinates, and every row is scoped to the restaurant so a foreign table id
 * cannot be repositioned.
 */
export async function writeTableLayout(
  restaurantId: string,
  positions: TablePosition[],
  gridSize: number
): Promise<ActionResult> {
  const supabase = await createClient();

  if (positions.length === 0) return { ok: true, data: undefined };

  for (const position of positions) {
    const x = clampInt(position.x, 0, gridSize - 1);
    const y = clampInt(position.y, 0, gridSize - 1);
    if (!position.id || !x.ok || !y.ok) {
      return { ok: false, error: "That position is outside the floor plan." };
    }
  }

  // Every id must be one of this restaurant's tables.
  const ids = [...new Set(positions.map((position) => position.id))];
  const { data: owned, error: ownedError } = await supabase
    .from("restaurant_tables")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .in("id", ids);

  if (ownedError) return { ok: false, error: dbError(ownedError) };
  if ((owned ?? []).length !== ids.length) {
    return { ok: false, error: "One of those tables is no longer available." };
  }

  const results = await Promise.all(
    positions.map((position) =>
      supabase
        .from("restaurant_tables")
        .update({ grid_x: Math.round(position.x), grid_y: Math.round(position.y) })
        .eq("id", position.id)
        .eq("restaurant_id", restaurantId)
    )
  );

  const failed = results.find((result) => result.error)?.error ?? null;
  if (failed) {
    if (isMissingLayoutColumn(failed)) {
      return {
        ok: false,
        error:
          "Saving the floor plan needs two extra columns on the tables. Ask your administrator to add grid_x and grid_y, then try again.",
      };
    }
    return { ok: false, error: dbError(failed) };
  }

  return { ok: true, data: undefined };
}

// ------------------------------------------------------ shared row edits

export async function setRowActive(
  table: ConfigTable,
  restaurantId: string,
  rowId: string,
  active: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .update({ active })
    .eq("id", rowId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, data: undefined };
}

export async function deleteRow(
  table: ConfigTable,
  restaurantId: string,
  rowId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", rowId)
    .eq("restaurant_id", restaurantId);

  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, data: undefined };
}

// Normalized domain types. Raw Supabase rows go through the pick() helpers
// below so reads tolerate common column-name variants (e.g. customer_name vs
// name). Writes always use the canonical column names listed in each Draft
// type, so if a write fails on an unknown column, that is the place to look.

import { zonedParts } from "@/lib/dates";

export type BookingStatus =
  | "confirmed"
  | "pending"
  | "seated"
  | "completed"
  | "cancelled"
  | "no_show"
  | "unknown";

export const ACTIVE_STATUSES: BookingStatus[] = [
  "confirmed",
  "pending",
  "seated",
  "completed",
];

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  timezone?: string;
}

export interface RestaurantSettings {
  restaurantId: string;
  restaurantName: string | null;
  timezone: string | null;
  slotIntervalMinutes: number | null;
  defaultBookingDurationMinutes: number | null;
  maxOnlinePartySize: number | null;
  minAdvanceMinutes: number | null;
  maxAdvanceDays: number | null;
}

export interface RestaurantTable {
  id: string;
  name: string;
  capacity: number | null;
  zone: string | null;
  active: boolean;
  /**
   * Where the table sits on the floor map, in grid positions. Null until
   * someone arranges the floor, or when the columns are not in the schema yet;
   * the map falls back to its default layout in both cases.
   */
  gridX: number | null;
  gridY: number | null;
}

export interface TableCombination {
  id: string;
  name: string;
  capacity: number | null;
  active: boolean;
  memberIds: string[];
}

export interface BookingHour {
  id: string;
  dayOfWeek: number; // 0 = Sunday
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  spansNextDay: boolean;
  active: boolean;
}

export interface SpecialDate {
  id: string;
  date: string; // YYYY-MM-DD
  closed: boolean;
  startTime: string | null;
  endTime: string | null;
  spansNextDay: boolean;
  note: string | null;
}

/** A bookable time resolved from its service day to its real calendar date. */
export interface AvailabilitySlot {
  time: string; // HH:mm
  date: string; // actual restaurant-local YYYY-MM-DD
  nextDay: boolean;
}

export interface Booking {
  id: string;
  startsAt: string | null; // ISO instant, source of truth
  endsAt: string | null;
  date: string; // actual restaurant-local YYYY-MM-DD
  serviceDate: string; // operational YYYY-MM-DD (may be the previous day)
  time: string; // restaurant-local HH:mm
  partySize: number;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  status: BookingStatus;
  tables: RestaurantTable[];
}

type Row = Record<string, unknown>;

function pick(row: Row, keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function bool(value: unknown, fallback: boolean): boolean {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const s = String(value).toLowerCase();
  if (["true", "t", "1", "yes"].includes(s)) return true;
  if (["false", "f", "0", "no"].includes(s)) return false;
  return fallback;
}

function hhmm(value: unknown): string | null {
  const s = str(value);
  if (!s) return null;
  const match = s.match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : null;
}

function isoDate(value: unknown): string | null {
  const s = str(value);
  if (!s) return null;
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function normalizeStatus(value: unknown): BookingStatus {
  const s = str(value)?.toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  if (["cancelled", "canceled"].includes(s)) return "cancelled";
  if (["confirmed", "active", "booked"].includes(s)) return "confirmed";
  if (s === "pending") return "pending";
  if (s === "seated") return "seated";
  if (["completed", "finished", "done"].includes(s)) return "completed";
  if (["no_show", "noshow"].includes(s)) return "no_show";
  return s ? "unknown" : "confirmed";
}

export function normalizeRestaurant(row: Row): Restaurant {
  return {
    id: String(pick(row, ["id", "restaurant_id"]) ?? ""),
    name: str(pick(row, ["name", "restaurant_name", "title"])) ?? "Restaurant",
    slug: str(pick(row, ["slug", "restaurant_slug"])) ?? "",
    timezone: str(pick(row, ["timezone", "time_zone", "tz"])) ?? undefined,
  };
}

export function normalizeSettings(row: Row): RestaurantSettings {
  return {
    restaurantId: String(pick(row, ["restaurant_id", "id"]) ?? ""),
    restaurantName: str(pick(row, ["restaurant_name", "name"])),
    timezone: str(pick(row, ["timezone", "time_zone", "tz"])),
    slotIntervalMinutes: num(pick(row, ["slot_interval_minutes", "slot_interval"])),
    defaultBookingDurationMinutes: num(
      pick(row, ["default_booking_duration_minutes", "default_duration_minutes"])
    ),
    maxOnlinePartySize: num(pick(row, ["max_online_party_size", "max_party_size"])),
    minAdvanceMinutes: num(pick(row, ["min_advance_minutes"])),
    maxAdvanceDays: num(pick(row, ["max_advance_days"])),
  };
}

export function normalizeTable(row: Row): RestaurantTable {
  return {
    id: String(pick(row, ["id", "table_id"]) ?? ""),
    name:
      str(pick(row, ["name", "label", "table_name", "table_number", "number"])) ??
      "Table",
    capacity: num(pick(row, ["capacity", "seats", "max_party_size"])),
    zone: str(pick(row, ["zone", "area", "section", "room"])),
    active: bool(pick(row, ["active", "is_active", "enabled"]), true),
    gridX: num(pick(row, ["grid_x", "pos_x", "layout_x"])),
    gridY: num(pick(row, ["grid_y", "pos_y", "layout_y"])),
  };
}

export function normalizeCombination(row: Row, memberIds: string[]): TableCombination {
  return {
    id: String(pick(row, ["id", "combination_id"]) ?? ""),
    name: str(pick(row, ["name", "label", "title"])) ?? "Combination",
    capacity: num(pick(row, ["capacity", "seats", "total_capacity"])),
    active: bool(pick(row, ["active", "is_active", "enabled"]), true),
    memberIds,
  };
}

export function normalizeBookingHour(row: Row): BookingHour {
  return {
    id: String(pick(row, ["id"]) ?? ""),
    dayOfWeek: num(pick(row, ["day_of_week", "weekday", "dow"])) ?? 0,
    startTime: hhmm(pick(row, ["start_time", "opens_at", "from_time"])) ?? "00:00",
    endTime: hhmm(pick(row, ["end_time", "closes_at", "to_time"])) ?? "00:00",
    spansNextDay: bool(pick(row, ["spans_next_day", "overnight"]), false),
    active: bool(pick(row, ["active", "is_active", "enabled"]), true),
  };
}

export function normalizeSpecialDate(row: Row): SpecialDate {
  return {
    id: String(pick(row, ["id"]) ?? ""),
    date: isoDate(pick(row, ["date", "special_date", "day"])) ?? "",
    closed: bool(pick(row, ["closed", "is_closed"]), false),
    startTime: hhmm(pick(row, ["start_time", "opens_at"])),
    endTime: hhmm(pick(row, ["end_time", "closes_at"])),
    spansNextDay: bool(pick(row, ["spans_next_day", "overnight"]), false),
    note: str(pick(row, ["note", "notes", "reason", "description"])),
  };
}

export function normalizeBooking(
  row: Row,
  tables: RestaurantTable[],
  timezone?: string
): Booking {
  const startsAt = str(pick(row, ["starts_at", "start_at", "startsAt"]));
  const endsAt = str(pick(row, ["ends_at", "end_at", "endsAt"]));
  const local = startsAt ? zonedParts(startsAt, timezone) : { date: "", time: "" };
  const serviceDate =
    isoDate(pick(row, ["service_date", "serviceDate", "booking_date"])) ??
    local.date;

  return {
    id: String(pick(row, ["id", "booking_id"]) ?? ""),
    startsAt,
    endsAt,
    date: local.date,
    serviceDate,
    time: local.time,
    partySize:
      num(pick(row, ["party_size", "partysize", "guests", "people", "covers", "pax"])) ??
      0,
    name:
      str(pick(row, ["customer_name", "name", "guest_name", "client_name"])) ?? "Guest",
    phone: str(pick(row, ["customer_phone", "phone", "phone_number", "tel"])) ?? "",
    email: str(pick(row, ["customer_email", "email"])),
    notes: str(pick(row, ["notes", "note", "special_requests", "comments"])),
    status: normalizeStatus(pick(row, ["status", "state"])),
    tables,
  };
}

/** Link-row reader shared by bookings↔tables and combinations↔tables. */
export function linkIds(
  row: Row,
  leftKeys: string[],
  rightKeys: string[]
): { left: string; right: string } | null {
  const left = str(pick(row, leftKeys));
  const right = str(pick(row, rightKeys));
  if (!left || !right) return null;
  return { left, right };
}

export function isCancelled(booking: Booking): boolean {
  return booking.status === "cancelled" || booking.status === "no_show";
}

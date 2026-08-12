// All reservation times live in Supabase as timestamptz (bookings.starts_at /
// ends_at). The dashboard always shows and edits them in the restaurant's own
// timezone, so every conversion goes through the helpers here.

export const WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

/** Minutes that `timezone` is ahead of UTC at the given instant. */
function offsetMinutes(instant: Date, timezone?: string): number {
  if (!timezone) return -instant.getTimezoneOffset();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(instant);

    const map: Record<string, string> = {};
    for (const part of parts) map[part.type] = part.value;

    const asIfUtc = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour) % 24,
      Number(map.minute),
      Number(map.second)
    );
    return (asIfUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000;
  } catch {
    return -instant.getTimezoneOffset();
  }
}

/** Wall-clock date and time of an instant, as seen in the restaurant. */
export function zonedParts(
  instant: string | Date,
  timezone?: string
): { date: string; time: string } {
  const value = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(value.getTime())) return { date: "", time: "" };
  const shifted = new Date(value.getTime() + offsetMinutes(value, timezone) * 60000);
  const iso = shifted.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** The instant at which a restaurant-local date + time occurs. */
export function zonedToInstant(
  date: string,
  time: string,
  timezone?: string
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const naive = Date.UTC(year, (month || 1) - 1, day || 1, hour || 0, minute || 0);

  // Two passes so the result stays correct across DST transitions.
  let utc = naive - offsetMinutes(new Date(naive), timezone) * 60000;
  utc = naive - offsetMinutes(new Date(utc), timezone) * 60000;
  return new Date(utc);
}

export function todayISO(timezone?: string, date = new Date()): string {
  return zonedParts(date, timezone).date;
}

export function nowHHMM(timezone?: string, date = new Date()): string {
  return zonedParts(date, timezone).time;
}

/** Weekday index of a date string, matching booking_hours.day_of_week (0 = Sunday). */
export function weekdayOf(isoDate: string): number {
  const date = new Date(`${isoDate}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? 0 : date.getUTCDay();
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Monday of the week containing `isoDate`. */
export function weekStart(isoDate: string): string {
  const weekday = weekdayOf(isoDate);
  return addDays(isoDate, weekday === 0 ? -6 : 1 - weekday);
}

export function formatDayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  // The year is only worth the space when it is not the current one.
  const sameYear = isoDate.slice(0, 4) === String(new Date().getUTCFullYear());
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

export function formatShortDay(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatMonthYear(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function minutesFromHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function hhmmFromMinutes(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addMinutes(hhmm: string, minutes: number): string {
  return hhmmFromMinutes(minutesFromHHMM(hhmm) + minutes);
}

/** "20:00 – 01:30 (next day)" style label for a booking period. */
export function periodLabel(
  start: string,
  end: string,
  spansNextDay: boolean
): string {
  const range = `${start.slice(0, 5)} – ${end.slice(0, 5)}`;
  return spansNextDay ? `${range} (día siguiente)` : range;
}

/** True when the end time falls before the start, i.e. the period is overnight. */
export function impliesNextDay(start: string, end: string): boolean {
  return minutesFromHHMM(end) <= minutesFromHHMM(start);
}

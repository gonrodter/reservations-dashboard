import type { Metadata } from "next";
import { getBookingsBetween, getSessionContext } from "@/lib/data";
import { ReservationsView, type RangePreset } from "@/components/ReservationsView";
import { addDays, todayISO, weekStart } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Reservations",
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Turns the URL's range preset into concrete restaurant-local dates. */
function resolveRange(
  preset: RangePreset,
  today: string,
  fromParam?: string,
  toParam?: string
): { from: string; to: string } {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "week": {
      const start = weekStart(today);
      return { from: start, to: addDays(start, 6) };
    }
    case "month":
      return {
        from: `${today.slice(0, 7)}-01`,
        to: addDays(`${addDays(`${today.slice(0, 7)}-01`, 31).slice(0, 7)}-01`, -1),
      };
    case "past":
      return { from: addDays(today, -30), to: addDays(today, -1) };
    case "custom": {
      const from = fromParam && DATE.test(fromParam) ? fromParam : today;
      const to = toParam && DATE.test(toParam) ? toParam : addDays(from, 7);
      return from <= to ? { from, to } : { from: to, to: from };
    }
    default:
      return { from: today, to: addDays(today, 60) };
  }
}

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { restaurant } = await getSessionContext();
  if (!restaurant) return null;

  const params = await searchParams;
  const today = todayISO(restaurant.timezone);
  const preset: RangePreset = (
    ["today", "upcoming", "week", "month", "past", "custom"] as RangePreset[]
  ).includes(params.range as RangePreset)
    ? (params.range as RangePreset)
    : "upcoming";

  const { from, to } = resolveRange(preset, today, params.from, params.to);
  const bookings = await getBookingsBetween(restaurant, from, to);

  return (
    <ReservationsView
      restaurant={restaurant}
      today={today}
      bookings={bookings}
      preset={preset}
      from={from}
      to={to}
    />
  );
}

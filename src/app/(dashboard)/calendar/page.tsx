import type { Metadata } from "next";
import {
  getBookingHours,
  getBookingsBetween,
  getSessionContext,
  getSettings,
} from "@/lib/data";
import { CalendarView, type CalendarMode } from "@/components/CalendarView";
import { addDays, todayISO, weekStart } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Calendar",
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { restaurant } = await getSessionContext();
  if (!restaurant) return null;

  const params = await searchParams;
  const today = todayISO(restaurant.timezone);
  const mode: CalendarMode = params.view === "week" ? "week" : "day";
  const date = params.date && DATE.test(params.date) ? params.date : today;

  const from = mode === "day" ? date : weekStart(date);
  const to = mode === "day" ? date : addDays(from, 6);

  const [bookings, bookingHours, settings] = await Promise.all([
    getBookingsBetween(restaurant, from, to),
    getBookingHours(restaurant.id),
    getSettings(restaurant.id),
  ]);

  return (
    <CalendarView
      restaurant={restaurant}
      mode={mode}
      date={date}
      bookings={bookings}
      bookingHours={bookingHours}
      defaultDurationMinutes={settings?.defaultBookingDurationMinutes ?? 90}
    />
  );
}

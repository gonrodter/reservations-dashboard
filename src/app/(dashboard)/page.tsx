import {
  getSessionContext,
  getSettings,
  getTables,
  getTodayBookings,
  getUpcomingBookings,
} from "@/lib/data";
import { TodayView } from "@/components/TodayView";

export default async function TodayPage() {
  const { restaurant } = await getSessionContext();
  if (!restaurant) return null;

  const [{ today, readAt, bookings }, tables, upcoming, settings] = await Promise.all([
    getTodayBookings(restaurant),
    getTables(restaurant.id),
    getUpcomingBookings(restaurant),
    getSettings(restaurant.id),
  ]);

  return (
    <TodayView
      restaurant={restaurant}
      today={today}
      bookings={bookings}
      tables={tables}
      upcomingCount={upcoming.bookings.filter((booking) => booking.status !== "cancelled").length}
      defaultDurationMinutes={settings?.defaultBookingDurationMinutes ?? undefined}
      nowMs={readAt}
    />
  );
}

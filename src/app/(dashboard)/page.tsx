import {
  getSessionContext,
  getSettings,
  getTables,
  getTodayBookings,
} from "@/lib/data";
import { TodayView } from "@/components/TodayView";

export default async function TodayPage() {
  const { restaurant } = await getSessionContext();
  if (!restaurant) return null;

  const [{ today, readAt, bookings }, tables, settings] = await Promise.all([
    getTodayBookings(restaurant),
    getTables(restaurant.id),
    getSettings(restaurant.id),
  ]);

  return (
    <TodayView
      restaurant={restaurant}
      today={today}
      bookings={bookings}
      tables={tables}
      defaultDurationMinutes={settings?.defaultBookingDurationMinutes ?? undefined}
      nowMs={readAt}
    />
  );
}

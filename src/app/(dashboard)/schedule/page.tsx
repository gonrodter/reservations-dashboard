import type { Metadata } from "next";
import { getBookingHours, getSessionContext } from "@/lib/data";
import { ScheduleView } from "@/components/ScheduleView";

export const metadata: Metadata = {
  title: "Booking hours",
};

export default async function SchedulePage() {
  const { restaurant } = await getSessionContext();
  if (!restaurant) return null;

  const bookingHours = await getBookingHours(restaurant.id);

  return <ScheduleView restaurant={restaurant} bookingHours={bookingHours} />;
}

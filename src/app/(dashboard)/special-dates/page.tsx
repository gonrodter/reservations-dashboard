import type { Metadata } from "next";
import { getSessionContext, getSpecialDates } from "@/lib/data";
import { SpecialDatesView } from "@/components/SpecialDatesView";
import { todayISO } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Special dates",
};

export default async function SpecialDatesPage() {
  const { restaurant } = await getSessionContext();
  if (!restaurant) return null;

  const specialDates = await getSpecialDates(restaurant.id);

  return (
    <SpecialDatesView
      restaurant={restaurant}
      today={todayISO(restaurant.timezone)}
      specialDates={specialDates}
    />
  );
}

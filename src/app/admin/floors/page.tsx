import type { Metadata } from "next";
import { getRestaurantFloor, listRestaurants } from "@/lib/admin-data";
import { AdminFloorView } from "@/components/admin/AdminFloorView";

export const metadata: Metadata = {
  title: "Table map · Admin",
};

export default async function AdminFloorsPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string }>;
}) {
  const { restaurant: requested } = await searchParams;
  const all = await listRestaurants();

  // Only live restaurants have a floor worth watching; the rest are still
  // being configured.
  const live = all.filter((restaurant) => restaurant.active);

  const selectedId =
    requested && live.some((restaurant) => restaurant.id === requested)
      ? requested
      : live[0]?.id;

  const snapshot = selectedId ? await getRestaurantFloor(selectedId) : null;

  return (
    <AdminFloorView
      restaurants={live}
      snapshot={snapshot}
      nowMs={snapshot?.readAt ?? 0}
    />
  );
}

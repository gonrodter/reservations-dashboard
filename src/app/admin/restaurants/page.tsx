import type { Metadata } from "next";
import { listRestaurants } from "@/lib/admin-data";
import { RestaurantsList } from "@/components/admin/RestaurantsList";

export const metadata: Metadata = {
  title: "Restaurants · Admin",
};

export default async function AdminRestaurantsPage() {
  const restaurants = await listRestaurants();
  return <RestaurantsList restaurants={restaurants} />;
}

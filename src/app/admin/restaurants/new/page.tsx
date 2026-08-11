import type { Metadata } from "next";
import { requireSuperadmin } from "@/lib/admin-data";
import { NewRestaurantForm } from "@/components/admin/NewRestaurantForm";

export const metadata: Metadata = {
  title: "New restaurant · Admin",
};

export default async function NewRestaurantPage() {
  await requireSuperadmin();
  return <NewRestaurantForm />;
}

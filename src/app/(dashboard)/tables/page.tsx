import type { Metadata } from "next";
import { getCombinations, getSessionContext, getTables } from "@/lib/data";
import { TablesView } from "@/components/TablesView";

export const metadata: Metadata = {
  title: "Tables",
};

export default async function TablesPage() {
  const { restaurant } = await getSessionContext();
  if (!restaurant) return null;

  const [tables, combinations] = await Promise.all([
    getTables(restaurant.id),
    getCombinations(restaurant.id),
  ]);

  return (
    <TablesView
      restaurant={restaurant}
      tables={tables}
      combinations={combinations}
    />
  );
}

import type { Metadata } from "next";
import { getSessionContext, getSettings } from "@/lib/data";
import { SettingsView } from "@/components/SettingsView";

export const metadata: Metadata = {
  title: "Ajustes",
};

export default async function SettingsPage() {
  const { restaurant } = await getSessionContext();
  if (!restaurant) return null;

  const settings = await getSettings(restaurant.id);

  return <SettingsView restaurant={restaurant} settings={settings} />;
}

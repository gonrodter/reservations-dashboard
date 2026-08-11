"use client";

import { useRouter } from "next/navigation";
import type { Restaurant, RestaurantSettings } from "@/lib/types";
import { saveSettings } from "@/lib/config-actions";
import { TopBar } from "@/components/TopBar";
import { PageHeading } from "@/components/ui";
import { SettingsForm } from "@/components/editors/SettingsForm";

export function SettingsView({
  restaurant,
  settings,
}: {
  restaurant: Restaurant;
  settings: RestaurantSettings | null;
}) {
  const router = useRouter();

  const fallbackTimezone =
    restaurant.timezone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    "UTC";

  return (
    <>
      <TopBar title={restaurant.name} />

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-3 py-4 md:px-6">
          <PageHeading
            title="Reservation settings"
            description="How your booking system behaves. These apply to your public booking page and to bookings your team takes by phone."
          />

          <div className="mt-4">
            <SettingsForm
              settings={settings}
              fallbackName={restaurant.name}
              fallbackTimezone={fallbackTimezone}
              save={saveSettings}
              onSaved={() => router.refresh()}
            />
          </div>
        </div>
      </div>
    </>
  );
}

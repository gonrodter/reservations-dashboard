"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createRestaurant } from "@/lib/admin-actions";
import { TopBar } from "@/components/TopBar";
import { PageHeading } from "@/components/ui";
import { BasicsForm } from "@/components/admin/BasicsForm";
import { ChevronLeftIcon } from "@/components/icons";

export function NewRestaurantForm() {
  const router = useRouter();

  return (
    <>
      <TopBar title="Terron Studio admin" />

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl px-3 py-4 md:px-6">
          <Link
            href="/admin/restaurants"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
          >
            <ChevronLeftIcon size={13} /> All restaurants
          </Link>

          <div className="mt-3">
            <PageHeading
              title="Onboard a restaurant"
              description="Start with the name and domain. The restaurant is created switched off, so you can configure the rest and activate it when everything is ready."
            />
          </div>

          <div className="mt-4">
            <BasicsForm
              submitLabel="Create and continue"
              save={async (input) => {
                const result = await createRestaurant(input);
                if (result.ok) {
                  router.replace(`/admin/restaurants/${result.data.id}?step=settings`);
                }
                return result;
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

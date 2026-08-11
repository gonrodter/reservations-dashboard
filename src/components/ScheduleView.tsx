"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingHour, Restaurant } from "@/lib/types";
import { deletePeriod, savePeriod, setPeriodActive } from "@/lib/config-actions";
import { PeriodDialog } from "@/components/PeriodDialog";
import { TopBar } from "@/components/TopBar";
import { Button, PageHeading } from "@/components/ui";
import { PlusIcon } from "@/components/icons";
import {
  ScheduleEditor,
  useScheduleSummary,
} from "@/components/editors/ScheduleEditor";

export function ScheduleView({
  restaurant,
  bookingHours,
}: {
  restaurant: Restaurant;
  bookingHours: BookingHour[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const { openDays } = useScheduleSummary(bookingHours);

  return (
    <>
      <TopBar
        title={restaurant.name}
        onNew={() => setAdding(true)}
        newLabel="Add hours"
      />

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-3 py-4 md:px-6">
          <PageHeading
            title="Booking hours"
            description="When guests can book a table, for each day of the week. A day with no hours takes no bookings."
          />

          <p className="mt-2 text-xs text-muted">
            {openDays === 0
              ? "No days are open for bookings yet."
              : `Open for bookings on ${openDays} of 7 days.`}
          </p>

          <div className="mt-4">
            <ScheduleEditor
              bookingHours={bookingHours}
              actions={{
                save: savePeriod,
                setActive: setPeriodActive,
                remove: deletePeriod,
              }}
              onChanged={() => router.refresh()}
            />
          </div>

          <p className="mt-4 text-[11px] leading-5 text-muted">
            Need different hours for one specific date, like a holiday? Use
            Special dates instead — those always win over the weekly hours.
          </p>

          <div className="mt-3">
            <Button
              variant="primary"
              icon={<PlusIcon size={13} />}
              onClick={() => setAdding(true)}
            >
              Add booking hours
            </Button>
          </div>
        </div>
      </div>

      {adding && (
        <PeriodDialog
          dayOfWeek={1}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Restaurant, SpecialDate } from "@/lib/types";
import { deleteSpecialDate } from "@/lib/config-actions";
import { formatDayLabel, periodLabel } from "@/lib/dates";
import { TopBar } from "@/components/TopBar";
import { EmptyState } from "@/components/EmptyState";
import { SpecialDateDialog } from "@/components/SpecialDateDialog";
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorNote,
  PageHeading,
} from "@/components/ui";
import {
  PencilIcon,
  PlusIcon,
  StarDateIcon,
  TrashIcon,
} from "@/components/icons";

function DateRow({
  specialDate,
  onEdit,
  onRemove,
  past,
}: {
  specialDate: SpecialDate;
  onEdit: () => void;
  onRemove: () => void;
  past?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 border-t border-line px-3 py-2.5 first:border-t-0 ${
        past ? "opacity-60" : ""
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">
          {formatDayLabel(specialDate.date)}
        </span>
        <span className="block truncate text-[11px] text-muted">
          {specialDate.closed
            ? "Closed all day"
            : specialDate.startTime && specialDate.endTime
              ? periodLabel(
                  specialDate.startTime,
                  specialDate.endTime,
                  specialDate.spansNextDay
                )
              : "Custom hours"}
          {specialDate.note ? ` · ${specialDate.note}` : ""}
        </span>
      </span>

      <span
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 ${
          specialDate.closed ? "bg-danger-soft text-danger" : "bg-info-soft text-info"
        }`}
      >
        <span className="size-1 rounded-full bg-current" aria-hidden />
        {specialDate.closed ? "Closed" : "Special hours"}
      </span>

      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${specialDate.date}`}
        className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
      >
        <PencilIcon size={14} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${specialDate.date}`}
        className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
      >
        <TrashIcon size={14} />
      </button>
    </div>
  );
}

export function SpecialDatesView({
  restaurant,
  today,
  specialDates,
}: {
  restaurant: Restaurant;
  today: string;
  specialDates: SpecialDate[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ specialDate?: SpecialDate } | null>(null);
  const [removing, setRemoving] = useState<SpecialDate | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { upcoming, past } = useMemo(() => {
    const upcomingList = specialDates.filter((date) => date.date >= today);
    const pastList = specialDates
      .filter((date) => date.date < today)
      .sort((a, b) => b.date.localeCompare(a.date));
    return { upcoming: upcomingList, past: pastList };
  }, [specialDates, today]);

  async function confirmRemove() {
    if (!removing) return;
    setPending(true);
    setError(null);
    const result = await deleteSpecialDate(removing.id);
    setPending(false);
    if (result.ok) {
      setRemoving(null);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <>
      <TopBar
        title={restaurant.name}
        onNew={() => setDialog({})}
        newLabel="Add special date"
      />

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-3 py-4 md:px-6">
          <PageHeading
            title="Special dates"
            description="Holidays, closures and one-off hours. A special date always overrides that day's usual booking hours."
          />

          {specialDates.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                icon={<StarDateIcon size={18} />}
                title="No special dates yet"
                body="Add the days your usual hours do not apply, such as Christmas Day or a private event."
                action={
                  <Button
                    variant="primary"
                    icon={<PlusIcon size={13} />}
                    onClick={() => setDialog({})}
                  >
                    Add a special date
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <section className="mt-5">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  Coming up
                </h3>
                {upcoming.length === 0 ? (
                  <p className="rounded-lg bg-sunken px-3 py-2.5 text-xs text-muted">
                    No special dates ahead. Your weekly booking hours apply.
                  </p>
                ) : (
                  <Card className="overflow-hidden">
                    {upcoming.map((specialDate) => (
                      <DateRow
                        key={specialDate.id}
                        specialDate={specialDate}
                        onEdit={() => setDialog({ specialDate })}
                        onRemove={() => {
                          setError(null);
                          setRemoving(specialDate);
                        }}
                      />
                    ))}
                  </Card>
                )}
              </section>

              {past.length > 0 && (
                <section className="mt-5">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    Past
                  </h3>
                  <Card className="overflow-hidden">
                    {past.slice(0, 12).map((specialDate) => (
                      <DateRow
                        key={specialDate.id}
                        specialDate={specialDate}
                        past
                        onEdit={() => setDialog({ specialDate })}
                        onRemove={() => {
                          setError(null);
                          setRemoving(specialDate);
                        }}
                      />
                    ))}
                  </Card>
                </section>
              )}

              <div className="mt-4">
                <Button
                  variant="primary"
                  icon={<PlusIcon size={13} />}
                  onClick={() => setDialog({})}
                >
                  Add special date
                </Button>
              </div>
            </>
          )}

          {error && !removing && <div className="mt-3">{<ErrorNote>{error}</ErrorNote>}</div>}
        </div>
      </div>

      {dialog && (
        <SpecialDateDialog
          specialDate={dialog.specialDate}
          minDate={today}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            router.refresh();
          }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title="Remove this special date?"
          body={`${formatDayLabel(removing.date)} will go back to your usual booking hours.`}
          confirmLabel="Remove"
          destructive
          pending={pending}
          error={error}
          onConfirm={confirmRemove}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}

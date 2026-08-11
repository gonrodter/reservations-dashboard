"use client";

import { useMemo, useState } from "react";
import type { BookingHour } from "@/lib/types";
import type { PeriodInput } from "@/lib/config-actions";
import type { ActionResult } from "@/lib/errors";
import { periodLabel, WEEKDAYS } from "@/lib/dates";
import { PeriodDialog } from "@/components/PeriodDialog";
import { Card, ConfirmDialog, ErrorNote } from "@/components/ui";
import { PencilIcon, PlusIcon, Spinner, TrashIcon } from "@/components/icons";

// Monday first: how staff think about a week, regardless of the 0-Sunday
// indexing booking_hours uses underneath.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export interface ScheduleActions {
  save: (input: PeriodInput) => Promise<ActionResult>;
  setActive: (periodId: string, active: boolean) => Promise<ActionResult>;
  remove: (periodId: string) => Promise<ActionResult>;
}

/**
 * The weekly booking_hours editor, shared by the restaurant's own Schedule page
 * and by step 3 of admin onboarding. The caller supplies the write actions, so
 * the same UI can target the session's restaurant or one named by id.
 */
export function ScheduleEditor({
  bookingHours,
  actions,
  onChanged,
}: {
  bookingHours: BookingHour[];
  actions: ScheduleActions;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    { period?: BookingHour; dayOfWeek: number } | null
  >(null);
  const [removing, setRemoving] = useState<BookingHour | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<number, BookingHour[]>();
    for (const index of DAY_ORDER) map.set(index, []);
    for (const hour of bookingHours) map.get(hour.dayOfWeek)?.push(hour);
    return map;
  }, [bookingHours]);

  async function togglePeriod(period: BookingHour) {
    setBusyId(period.id);
    setError(null);
    const result = await actions.setActive(period.id, !period.active);
    setBusyId(null);
    if (result.ok) onChanged();
    else setError(result.error);
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusyId(removing.id);
    setRemoveError(null);
    const result = await actions.remove(removing.id);
    setBusyId(null);
    if (result.ok) {
      setRemoving(null);
      onChanged();
    } else {
      setRemoveError(result.error);
    }
  }

  return (
    <>
      {error && <div className="mb-3">{<ErrorNote>{error}</ErrorNote>}</div>}

      <div className="space-y-2">
        {DAY_ORDER.map((index) => {
          const periods = byDay.get(index) ?? [];
          const anyActive = periods.some((hour) => hour.active);

          return (
            <Card key={index} className="overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-[13px] font-semibold">{WEEKDAYS[index]}</h3>
                  {!anyActive && (
                    <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-medium text-muted">
                      Closed
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDialog({ dayOfWeek: index })}
                  className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium hover:bg-sunken"
                >
                  <PlusIcon size={11} /> Add
                </button>
              </div>

              {periods.length > 0 && (
                <div className="border-t border-line">
                  {periods.map((period, position) => (
                    <div
                      key={period.id}
                      className={`flex items-center gap-2 px-3 py-2 ${
                        position > 0 ? "border-t border-line" : ""
                      } ${period.active ? "" : "bg-sunken/40"}`}
                    >
                      <span
                        className={`flex-1 text-[13px] tabular-nums ${
                          period.active ? "" : "text-muted line-through"
                        }`}
                      >
                        {periodLabel(
                          period.startTime,
                          period.endTime,
                          period.spansNextDay
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() => togglePeriod(period)}
                        disabled={busyId === period.id}
                        className="rounded-lg border border-line px-2 py-1 text-[11px] font-medium hover:bg-sunken disabled:opacity-40"
                      >
                        {busyId === period.id ? (
                          <Spinner size={11} />
                        ) : period.active ? (
                          "Pause"
                        ) : (
                          "Resume"
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDialog({ period, dayOfWeek: index })}
                        aria-label="Edit hours"
                        className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
                      >
                        <PencilIcon size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRemoveError(null);
                          setRemoving(period);
                        }}
                        aria-label="Remove hours"
                        className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                      >
                        <TrashIcon size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {dialog && (
        <PeriodDialog
          period={dialog.period}
          dayOfWeek={dialog.dayOfWeek}
          save={actions.save}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            onChanged();
          }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title="Remove these hours?"
          body={`${WEEKDAYS[removing.dayOfWeek]}, ${periodLabel(
            removing.startTime,
            removing.endTime,
            removing.spansNextDay
          )}. Existing reservations are not affected.`}
          confirmLabel="Remove"
          destructive
          pending={busyId === removing.id}
          error={removeError}
          onConfirm={confirmRemove}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}

/** Exposed so callers can add their own "Add hours" button. */
export function useScheduleSummary(bookingHours: BookingHour[]) {
  return useMemo(() => {
    const openDays = DAY_ORDER.filter((index) =>
      bookingHours.some((hour) => hour.dayOfWeek === index && hour.active)
    ).length;
    return { openDays };
  }, [bookingHours]);
}

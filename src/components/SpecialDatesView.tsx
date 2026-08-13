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
            ? "Cerrado todo el día"
            : specialDate.startTime && specialDate.endTime
              ? periodLabel(
                  specialDate.startTime,
                  specialDate.endTime,
                  specialDate.spansNextDay
                )
              : "Horario personalizado"}
          {specialDate.note ? ` · ${specialDate.note}` : ""}
        </span>
      </span>

      <span
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 ${
          specialDate.closed ? "bg-danger-soft text-danger" : "bg-info-soft text-info"
        }`}
      >
        <span className="size-1 rounded-full bg-current" aria-hidden />
        {specialDate.closed ? "Cerrado" : "Horario especial"}
      </span>

      <button
        type="button"
        onClick={onEdit}
        aria-label={`Editar ${specialDate.date}`}
        className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
      >
        <PencilIcon size={14} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Eliminar ${specialDate.date}`}
        className="flex size-8 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"
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
        newLabel="Añadir fecha especial"
      />

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-3 pt-4 pb-24 md:px-6">
          <PageHeading
            title="Fechas especiales"
            description="Festivos, cierres y horarios puntuales. Una fecha especial siempre sustituye el horario habitual de ese día."
          />

          {specialDates.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                icon={<StarDateIcon size={18} />}
                title="Todavía no hay fechas especiales"
                body="Añade los días en los que no se aplique el horario habitual, como Navidad o un evento privado."
                action={
                  <Button
                    variant="primary"
                    icon={<PlusIcon size={13} />}
                    onClick={() => setDialog({})}
                  >
                    Añadir una fecha especial
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <section className="mt-5">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  Próximas
                </h3>
                {upcoming.length === 0 ? (
                  <p className="rounded-lg bg-sunken px-3 py-2.5 text-xs text-muted">
                    No hay próximas fechas especiales. Se aplica el horario semanal.
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
                    Anteriores
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
          title="¿Eliminar esta fecha especial?"
          body={`${formatDayLabel(removing.date)} volverá a usar el horario de reservas habitual.`}
          confirmLabel="Eliminar"
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

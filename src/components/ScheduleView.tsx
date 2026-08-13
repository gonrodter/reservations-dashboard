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
        newLabel="Añadir horario"
      />

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-3 pt-4 pb-24 md:px-6">
          <PageHeading
            title="Horario de reservas"
            description="Cuándo pueden reservar mesa los clientes cada día de la semana. Los días sin horario no aceptan reservas."
          />

          <p className="mt-2 text-xs text-muted">
            {openDays === 0
              ? "Todavía no hay ningún día abierto para reservas."
              : `Se aceptan reservas ${openDays} de los 7 días.`}
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
            ¿Necesitas un horario distinto para una fecha concreta, como un
            festivo? Usa Fechas especiales: siempre tienen prioridad sobre el
            horario semanal.
          </p>

          <div className="mt-3">
            <Button
              variant="primary"
              icon={<PlusIcon size={13} />}
              onClick={() => setAdding(true)}
            >
              Añadir horario de reservas
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

"use client";

import { useState } from "react";
import type { BookingHour } from "@/lib/types";
import { savePeriod, type PeriodInput } from "@/lib/config-actions";
import type { ActionResult } from "@/lib/errors";
import { impliesNextDay, WEEKDAYS } from "@/lib/dates";
import { Button, ErrorNote, Field, Input, Modal, Select, Toggle } from "@/components/ui";

// Monday first: how staff think about a week.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function PeriodDialog({
  period,
  dayOfWeek,
  onClose,
  onSaved,
  save = savePeriod,
}: {
  period?: BookingHour;
  dayOfWeek: number;
  onClose: () => void;
  onSaved: () => void;
  /** Overridden by the admin area to write to a restaurant it names by id. */
  save?: (input: PeriodInput) => Promise<ActionResult>;
}) {
  const [day, setDay] = useState(period?.dayOfWeek ?? dayOfWeek);
  const [startTime, setStartTime] = useState(period?.startTime ?? "13:00");
  const [endTime, setEndTime] = useState(period?.endTime ?? "16:00");
  const [active, setActive] = useState(period?.active ?? true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overnight =
    /^\d{2}:\d{2}$/.test(startTime) &&
    /^\d{2}:\d{2}$/.test(endTime) &&
    impliesNextDay(startTime, endTime);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await save({
      id: period?.id,
      dayOfWeek: day,
      startTime,
      endTime,
      active,
    });

    setPending(false);
    if (result.ok) onSaved();
    else setError(result.error);
  }

  return (
    <Modal title={period ? "Editar horario de reservas" : "Añadir horario de reservas"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="contents">
        <div className="thin-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <Field label="Día" required>
            <Select value={day} onChange={(event) => setDay(Number(event.target.value))}>
              {DAY_ORDER.map((index) => (
                <option key={index} value={index}>
                  {WEEKDAYS[index]}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Primera reserva" required>
              <Input
                required
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </Field>
            <Field label="Última reserva" required>
              <Input
                required
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </Field>
          </div>

          {/* spans_next_day is derived, never asked about in database terms. */}
          {overnight && (
            <p className="rounded-lg bg-info-soft px-3 py-2 text-xs leading-5 text-info">
              Este servicio termina después de medianoche, a las {endTime} de la
              mañana siguiente. Se guardará automáticamente.
            </p>
          )}

          <div className="rounded-lg bg-sunken px-3 py-2.5">
            <Toggle
              checked={active}
              onChange={setActive}
              label={active ? "Acepta reservas" : "En pausa"}
            />
            <p className="mt-1 text-[11px] leading-4 text-muted">
              Pausa un servicio para dejar de aceptar reservas sin perder el horario.
            </p>
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}
        </div>

        <footer className="flex gap-2 border-t border-line p-3">
          <Button type="button" onClick={onClose} className="flex-1 py-2">
            Descartar
          </Button>
          <Button type="submit" variant="primary" pending={pending} className="flex-1 py-2">
            {period ? "Guardar horario" : "Añadir horario"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

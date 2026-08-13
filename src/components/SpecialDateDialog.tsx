"use client";

import { useState } from "react";
import type { SpecialDate } from "@/lib/types";
import { saveSpecialDate } from "@/lib/config-actions";
import { impliesNextDay } from "@/lib/dates";
import {
  Button,
  ErrorNote,
  Field,
  Input,
  Modal,
  Segmented,
  Textarea,
} from "@/components/ui";

export function SpecialDateDialog({
  specialDate,
  minDate,
  onClose,
  onSaved,
}: {
  specialDate?: SpecialDate;
  minDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(specialDate?.date ?? minDate);
  const [mode, setMode] = useState<"closed" | "hours">(
    specialDate ? (specialDate.closed ? "closed" : "hours") : "closed"
  );
  const [startTime, setStartTime] = useState(specialDate?.startTime ?? "20:00");
  const [endTime, setEndTime] = useState(specialDate?.endTime ?? "23:30");
  const [note, setNote] = useState(specialDate?.note ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overnight =
    mode === "hours" &&
    /^\d{2}:\d{2}$/.test(startTime) &&
    /^\d{2}:\d{2}$/.test(endTime) &&
    impliesNextDay(startTime, endTime);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await saveSpecialDate({
      id: specialDate?.id,
      date,
      closed: mode === "closed",
      startTime,
      endTime,
      note,
    });

    setPending(false);
    if (result.ok) onSaved();
    else setError(result.error);
  }

  return (
    <Modal
      title={specialDate ? "Editar fecha especial" : "Añadir una fecha especial"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="contents">
        <div className="thin-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <Field label="Fecha" required>
            <Input
              required
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>

          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">
              En esta fecha el restaurante está
            </p>
            <Segmented
              fullWidth
              label="Qué ocurre en esta fecha"
              value={mode}
              options={[
                { value: "closed", label: "Cerrado" },
                { value: "hours", label: "Abierto, con otro horario" },
              ]}
              onChange={setMode}
            />
          </div>

          {mode === "hours" && (
            <>
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
              {overnight && (
                <p className="rounded-lg bg-info-soft px-3 py-2 text-xs leading-5 text-info">
                  El servicio termina después de medianoche, a las {endTime} de
                  la mañana siguiente.
                </p>
              )}
            </>
          )}

          <Field
            label="Nota"
            hint="Opcional. La verá tu equipo, por ejemplo, “Nochevieja” o “Evento privado”."
          >
            <Textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Día de Navidad"
            />
          </Field>

          {error && <ErrorNote>{error}</ErrorNote>}
        </div>

        <footer className="flex gap-2 border-t border-line p-3">
          <Button type="button" onClick={onClose} className="flex-1 py-2">
            Descartar
          </Button>
          <Button type="submit" variant="primary" pending={pending} className="flex-1 py-2">
            {specialDate ? "Guardar fecha" : "Añadir fecha"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

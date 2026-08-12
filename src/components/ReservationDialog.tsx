"use client";

import { useEffect, useState } from "react";
import type { AvailabilitySlot, Booking } from "@/lib/types";
import {
  createReservation,
  getAvailability,
  updateReservation,
} from "@/lib/actions";
import { AlertIcon, Spinner, XIcon } from "@/components/icons";
import { useDismiss } from "@/components/ui";

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none transition-colors placeholder:text-muted focus:border-ink";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-soft">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
    </label>
  );
}

type LoadedSlots = { key: string; slots?: AvailabilitySlot[]; error?: string };

function slotKey(slot: Pick<AvailabilitySlot, "date" | "time">) {
  return `${slot.date}|${slot.time}`;
}

export function ReservationDialog({
  mode,
  booking,
  minDate,
  initialDate,
  onClose,
  onSuccess,
}: {
  mode: "create" | "edit";
  booking?: Booking;
  minDate: string;
  /** Pre-selected date when creating from the calendar. */
  initialDate?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [date, setDate] = useState(
    booking?.date ?? (initialDate && initialDate >= minDate ? initialDate : minDate)
  );
  const [partySize, setPartySize] = useState(booking?.partySize || 2);
  const [selectedSlot, setSelectedSlot] = useState(
    booking ? slotKey({ date: booking.date, time: booking.time }) : ""
  );
  const [name, setName] = useState(booking?.name ?? "");
  const [phone, setPhone] = useState(booking?.phone ?? "");
  const [email, setEmail] = useState(booking?.email ?? "");
  const [notes, setNotes] = useState(booking?.notes ?? "");

  const [loaded, setLoaded] = useState<LoadedSlots | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validQuery = /^\d{4}-\d{2}-\d{2}$/.test(date) && partySize >= 1;
  const key = `${date}|${partySize}`;

  useEffect(() => {
    if (!validQuery) return;
    let stale = false;
    (async () => {
      const result = await getAvailability(date, partySize);
      if (stale) return;
      setLoaded(
        result.ok ? { key, slots: result.data } : { key, error: result.error }
      );
    })();
    return () => {
      stale = true;
    };
  }, [key, date, partySize, validQuery, attempt]);

  const { closing, requestClose } = useDismiss(onClose);

  const slotsLoading = validQuery && (!loaded || loaded.key !== key);
  const slotsError = !slotsLoading && loaded?.key === key ? loaded.error ?? null : null;
  const fetchedSlots =
    !slotsLoading && loaded?.key === key ? loaded.slots ?? [] : [];

  // When editing on the original date, the reservation's own slot stays
  // offered even though the backend reports it as taken.
  const shownSlots = (() => {
    const list = [...fetchedSlots];
    if (
      mode === "edit" &&
      booking &&
      date === booking.date &&
      booking.time &&
      !list.some(
        (slot) => slot.date === booking.date && slot.time === booking.time
      )
    ) {
      list.push({ date: booking.date, time: booking.time, nextDay: false });
      list.sort((a, b) => slotKey(a).localeCompare(slotKey(b)));
    }
    return list;
  })();

  // A previously chosen time silently becomes unselected if the new
  // availability no longer offers it.
  const effectiveSlot =
    shownSlots.find((slot) => slotKey(slot) === selectedSlot) ?? null;

  function retrySlots() {
    setLoaded(null);
    setAttempt((n) => n + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveSlot) {
      setSubmitError("Elige una franja horaria.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    const result =
      mode === "create"
        ? await createReservation({
            date: effectiveSlot.date,
            time: effectiveSlot.time,
            partySize,
            name,
            phone,
            email,
            notes,
          })
        : await updateReservation({
            bookingId: booking!.id,
            date: effectiveSlot.date,
            time: effectiveSlot.time,
            partySize,
          });

    setSubmitting(false);
    if (result.ok) {
      onSuccess();
    } else {
      setSubmitError(result.error);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={requestClose}
        className={`absolute inset-0 bg-ink/20 ${closing ? "overlay-out" : "overlay-in"}`}
      />
      <form
        onSubmit={handleSubmit}
        className={`relative flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-2xl bg-surface shadow-float md:rounded-2xl ${
          closing ? "sheet-out" : "sheet-in"
        }`}
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">
            {mode === "create" ? "Nueva reserva" : "Modificar reserva"}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Cerrar"
            className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
          >
            <XIcon size={15} />
          </button>
        </header>

        <div className="thin-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {mode === "edit" && booking && (
            <p className="rounded-lg bg-sunken px-3 py-2 text-xs text-ink-soft">
              {booking.name} · {booking.phone || "sin teléfono"}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label={mode === "create" ? "Fecha del servicio" : "Fecha"} required>
              <input
                type="date"
                required
                min={minDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Comensales" required>
              <div className="flex items-center rounded-lg border border-line">
                <button
                  type="button"
                  aria-label="Menos comensales"
                  onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                  className="px-2.5 py-1.5 text-sm text-muted hover:text-ink"
                >
                  −
                </button>
                <span className="flex-1 text-center text-[13px] font-medium tabular-nums">
                  {partySize}
                </span>
                <button
                  type="button"
                  aria-label="Más comensales"
                  onClick={() => setPartySize((n) => Math.min(50, n + 1))}
                  className="px-2.5 py-1.5 text-sm text-muted hover:text-ink"
                >
                  +
                </button>
              </div>
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-soft">
              Horas disponibles <span className="text-danger">*</span>
            </p>
            {!validQuery ? (
              <p className="rounded-lg bg-sunken px-3 py-2.5 text-xs text-muted">
                Elige una fecha para ver las horas disponibles.
              </p>
            ) : slotsLoading ? (
              <div className="flex items-center gap-2 rounded-lg bg-sunken px-3 py-2.5 text-xs text-muted">
                <Spinner size={13} /> Comprobando disponibilidad…
              </div>
            ) : slotsError ? (
              <div className="flex items-start justify-between gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-xs text-danger">
                <span className="inline-flex items-center gap-1.5">
                  <AlertIcon size={13} /> {slotsError}
                </span>
                <button
                  type="button"
                  onClick={retrySlots}
                  className="font-medium underline underline-offset-2"
                >
                  Reintentar
                </button>
              </div>
            ) : shownSlots.length === 0 ? (
              <p className="rounded-lg bg-sunken px-3 py-2.5 text-xs text-muted">
                No hay mesas disponibles para {partySize} comensales en esta
                fecha. Prueba con otra fecha u otro tamaño de grupo.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-1.5">
                  {shownSlots.map((slot) => (
                    <button
                      key={slotKey(slot)}
                      type="button"
                      onClick={() => setSelectedSlot(slotKey(slot))}
                      aria-pressed={selectedSlot === slotKey(slot)}
                      className={`rounded-lg border py-1.5 text-xs font-medium tabular-nums transition-colors ${
                        selectedSlot === slotKey(slot)
                          ? "border-ink bg-ink text-surface"
                          : "border-line bg-surface hover:border-line-strong"
                      }`}
                    >
                      <span className="block">{slot.time}</span>
                      {slot.nextDay && (
                        <span className="block text-[9px] font-normal opacity-75">
                          día siguiente
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {shownSlots.some((slot) => slot.nextDay) && (
                  <p className="mt-1.5 text-[11px] text-muted">
                    Las horas del “día siguiente” son posteriores a medianoche,
                    pero pertenecen a este servicio.
                  </p>
                )}
              </>
            )}
          </div>

          {mode === "create" && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nombre del cliente" required>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre completo"
                    className={inputClass}
                  />
                </Field>
                <Field label="Teléfono" required>
                  <input
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+34 600 000 000"
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Correo electrónico">
                <input
                  type="email"
                  value={email ?? ""}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cliente@ejemplo.com"
                  className={inputClass}
                />
              </Field>
              <Field label="Notas">
                <textarea
                  value={notes ?? ""}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Alergias, ocasión, preferencia de mesa…"
                  className={`${inputClass} resize-none`}
                />
              </Field>
            </>
          )}

          {submitError && (
            <p className="flex items-center gap-1.5 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
              <AlertIcon size={13} /> {submitError}
            </p>
          )}
        </div>

        <footer className="flex gap-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3">
          <button
            type="button"
            onClick={requestClose}
            className="flex-1 rounded-lg border border-line py-2 text-[13px] font-medium hover:bg-sunken"
          >
            Descartar
          </button>
          <button
            type="submit"
            disabled={submitting || !effectiveSlot}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-ink py-2 text-[13px] font-medium text-surface transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            {submitting && <Spinner size={13} />}
            {mode === "create" ? "Crear reserva" : "Guardar cambios"}
          </button>
        </footer>
      </form>
    </div>
  );
}

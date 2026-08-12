"use client";

import { useState } from "react";
import type { Booking } from "@/lib/types";
import { cancelReservation } from "@/lib/actions";
import { formatShortDay } from "@/lib/dates";
import { AlertIcon, Spinner } from "@/components/icons";
import { useDismiss } from "@/components/ui";

export function ConfirmCancelDialog({
  booking,
  onClose,
  onSuccess,
}: {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { closing, requestClose } = useDismiss(onClose);

  async function handleConfirm() {
    setPending(true);
    setError(null);
    const result = await cancelReservation(booking.id);
    setPending(false);
    if (result.ok) {
      onSuccess();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label="Cancelar reserva">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={requestClose}
        className={`absolute inset-0 bg-ink/20 ${closing ? "overlay-out" : "overlay-in"}`}
      />
      <div
        className={`relative w-full max-w-xs rounded-2xl bg-surface p-4 shadow-float ${
          closing ? "panel-out" : "panel-in"
        }`}
      >
        <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-danger-soft text-danger">
          <AlertIcon size={17} />
        </div>
        <h2 className="mt-2 text-center text-sm font-semibold">
          ¿Cancelar esta reserva?
        </h2>
        <p className="mt-1 text-center text-xs leading-5 text-muted">
          {booking.name} · {booking.time} · {formatShortDay(booking.date)} ·{" "}
          {booking.partySize} {booking.partySize === 1 ? "comensal" : "comensales"}
        </p>

        {error && (
          <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={requestClose}
            disabled={pending}
            className="flex-1 rounded-lg border border-line py-2 text-[13px] font-medium hover:bg-sunken disabled:opacity-40"
          >
            Conservar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-danger py-2 text-[13px] font-medium text-surface transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            {pending && <Spinner size={13} />}
            Cancelarla
          </button>
        </div>
      </div>
    </div>
  );
}

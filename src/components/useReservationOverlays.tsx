"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Booking } from "@/lib/types";
import { DetailDrawer } from "@/components/DetailDrawer";
import { ReservationDialog } from "@/components/ReservationDialog";
import { ConfirmCancelDialog } from "@/components/ConfirmCancelDialog";

type DialogState =
  | { mode: "create"; date?: string }
  | { mode: "edit"; booking: Booking }
  | null;

/**
 * Detail drawer, create/modify dialog and cancel confirmation, shared by every
 * page that lists reservations. `minDate` is today in the restaurant's
 * timezone, so staff cannot book into the past.
 */
export function useReservationOverlays(minDate: string) {
  const router = useRouter();
  const [selected, setSelected] = useState<Booking | null>(null);
  const [tableBookings, setTableBookings] = useState<Booking[]>([]);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);

  function refreshAndClose() {
    setDialog(null);
    setCancelTarget(null);
    setSelected(null);
    setTableBookings([]);
    router.refresh();
  }

  function select(booking: Booking) {
    setTableBookings([]);
    setSelected(booking);
  }

  function selectFromTable(booking: Booking, bookings: Booking[] = []) {
    setTableBookings(bookings);
    setSelected(booking);
  }

  const overlays = (
    <>
      <DetailDrawer
        booking={selected}
        bookings={tableBookings}
        onNavigate={setSelected}
        onClose={() => {
          setSelected(null);
          setTableBookings([]);
        }}
        onEdit={(booking) => setDialog({ mode: "edit", booking })}
        onCancel={(booking) => setCancelTarget(booking)}
      />
      {dialog && (
        <ReservationDialog
          mode={dialog.mode}
          booking={dialog.mode === "edit" ? dialog.booking : undefined}
          minDate={minDate}
          initialDate={dialog.mode === "create" ? dialog.date : undefined}
          onClose={() => setDialog(null)}
          onSuccess={refreshAndClose}
        />
      )}
      {cancelTarget && (
        <ConfirmCancelDialog
          booking={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onSuccess={refreshAndClose}
        />
      )}
    </>
  );

  return {
    selected,
    select,
    selectFromTable,
    /** Opens the create dialog, optionally pre-filled with a date. */
    openCreate: (date?: string) => setDialog({ mode: "create", date }),
    overlays,
  };
}

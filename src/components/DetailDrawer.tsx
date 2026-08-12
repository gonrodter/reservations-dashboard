"use client";

import { useEffect, useState } from "react";
import type { Booking } from "@/lib/types";
import { StatusChip } from "@/components/StatusChip";
import { formatDayLabel } from "@/lib/dates";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  MailIcon,
  NoteIcon,
  PencilIcon,
  PhoneIcon,
  TableIcon,
  UsersIcon,
  XIcon,
} from "@/components/icons";

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        <div className="mt-0.5 text-[13px] text-ink">{children}</div>
      </div>
    </div>
  );
}

export function DetailDrawer({
  booking,
  bookings = [],
  onNavigate,
  onClose,
  onEdit,
  onCancel,
  readOnly = false,
}: {
  booking: Booking | null;
  /** Reservations on the selected table, ordered from earliest to latest. */
  bookings?: Booking[];
  onNavigate?: (booking: Booking) => void;
  onClose: () => void;
  onEdit: (booking: Booking) => void;
  onCancel: (booking: Booking) => void;
  /**
   * Hides Modify and Cancel. Used by the admin table map: those actions resolve
   * the restaurant from the signed-in user's own membership, which a superadmin
   * looking at someone else's floor does not have.
   */
  readOnly?: boolean;
}) {
  const [transition, setTransition] = useState<{
    bookingId: string;
    direction: "previous" | "next";
  } | null>(null);

  useEffect(() => {
    if (!booking) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [booking, onClose]);

  if (!booking) return null;

  const bookingIndex = bookings.findIndex((candidate) => candidate.id === booking.id);
  const hasNavigation = bookingIndex >= 0 && bookings.length > 1 && onNavigate;
  const transitionClass =
    transition?.bookingId === booking.id
      ? transition.direction === "next"
        ? "reservation-enter-next"
        : "reservation-enter-previous"
      : "";

  function navigateTo(index: number, direction: "previous" | "next") {
    const nextBooking = bookings[index];
    if (!nextBooking || !onNavigate) return;
    setTransition({ bookingId: nextBooking.id, direction });
    onNavigate(nextBooking);
  }

  const actionable =
    !readOnly &&
    booking.status !== "cancelled" &&
    booking.status !== "completed";

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Reservation details">
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 bg-ink/20"
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col overflow-hidden bg-surface shadow-float md:inset-y-3 md:right-3 md:rounded-2xl">
        <header className="flex items-center gap-2 border-b border-line px-4 py-3">
          <div key={booking.id} className={`min-w-0 flex-1 ${transitionClass}`}>
            <p className="text-sm font-semibold">{booking.name}</p>
            <p className="text-xs text-muted tabular-nums">
              {booking.time} · {formatDayLabel(booking.date)}
            </p>
          </div>
          <span key={`status-${booking.id}`} className={transitionClass}>
            <StatusChip status={booking.status} />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
          >
            <XIcon size={15} />
          </button>
        </header>

        {hasNavigation && (
          <nav
            className="flex items-center justify-between border-b border-line bg-sunken/60 px-3 py-2"
            aria-label="Reservations on this table"
          >
            <button
              type="button"
              disabled={bookingIndex === 0}
              onClick={() => navigateTo(bookingIndex - 1, "previous")}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-soft hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-30"
              aria-label="Previous reservation"
            >
              <ChevronLeftIcon size={14} /> Earlier
            </button>
            <span className="text-[11px] font-medium tabular-nums text-muted" aria-live="polite">
              {bookingIndex + 1} of {bookings.length}
            </span>
            <button
              type="button"
              disabled={bookingIndex === bookings.length - 1}
              onClick={() => navigateTo(bookingIndex + 1, "next")}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-soft hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-30"
              aria-label="Next reservation"
            >
              Later <ChevronRightIcon size={14} />
            </button>
          </nav>
        )}

        <div key={`details-${booking.id}`} className={`flex min-h-0 flex-1 flex-col ${transitionClass}`}>
          <div className="thin-scroll flex-1 divide-y divide-line overflow-y-auto px-4">
            <Row icon={<CalendarIcon size={15} />} label="Date">
              {formatDayLabel(booking.date)}
            </Row>
            <Row icon={<ClockIcon size={15} />} label="Time">
              <span className="tabular-nums">{booking.time || "—"}</span>
            </Row>
            <Row icon={<UsersIcon size={15} />} label="Party size">
              {booking.partySize || "—"} {booking.partySize === 1 ? "guest" : "guests"}
            </Row>
            <Row icon={<PhoneIcon size={15} />} label="Phone">
              {booking.phone ? (
                <a href={`tel:${booking.phone}`} className="tabular-nums underline-offset-2 hover:underline">
                  {booking.phone}
                </a>
              ) : (
                "—"
              )}
            </Row>
            <Row icon={<MailIcon size={15} />} label="Email">
              {booking.email ? (
                <a href={`mailto:${booking.email}`} className="break-all underline-offset-2 hover:underline">
                  {booking.email}
                </a>
              ) : (
                "—"
              )}
            </Row>
            <Row icon={<TableIcon size={15} />} label="Tables">
              {booking.tables.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {booking.tables.map((table) => (
                    <span
                      key={table.id}
                      className="rounded-md border border-line bg-sunken px-1.5 py-0.5 text-xs font-medium"
                    >
                      {table.name}
                      {table.capacity ? ` · ${table.capacity}` : ""}
                    </span>
                  ))}
                </span>
              ) : (
                "Not assigned yet"
              )}
            </Row>
            <Row icon={<NoteIcon size={15} />} label="Notes">
              {booking.notes || "—"}
            </Row>
          </div>

          {actionable && (
            <footer className="flex gap-2 border-t border-line p-3">
              <button
                type="button"
                onClick={() => onEdit(booking)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface py-2 text-[13px] font-medium hover:bg-sunken"
              >
                <PencilIcon size={14} />
                Modify
              </button>
              <button
                type="button"
                onClick={() => onCancel(booking)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-danger/30 bg-danger-soft py-2 text-[13px] font-medium text-danger hover:border-danger/60"
              >
                Cancel reservation
              </button>
            </footer>
          )}
        </div>
      </aside>
    </div>
  );
}

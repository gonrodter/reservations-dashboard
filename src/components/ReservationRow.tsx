"use client";

import type { Booking } from "@/lib/types";
import { isCancelled } from "@/lib/types";
import { StatusChip } from "@/components/StatusChip";
import { TablePill } from "@/components/TablePill";
import { bookingColour } from "@/lib/table-colours";
import { TableIcon, UsersIcon } from "@/components/icons";

/**
 * One reservation as a table-like row. Used by the day-grouped lists on
 * Reservations; the columns collapse progressively so a phone still shows
 * time, guest, phone and status.
 */
export function ReservationRow({
  booking,
  selected,
  first,
  onSelect,
}: {
  booking: Booking;
  selected: boolean;
  first: boolean;
  onSelect: (booking: Booking) => void;
}) {
  const cancelled = isCancelled(booking);
  const colour = bookingColour(booking.tables);

  return (
    <button
      type="button"
      onClick={() => onSelect(booking)}
      aria-pressed={selected}
      className={`relative flex w-full items-center gap-3 py-2.5 pl-4 pr-3 text-left transition-colors hover:bg-sunken ${
        first ? "" : "border-t border-line"
      } ${cancelled ? "opacity-60" : ""} ${
        selected ? "bg-info-soft/40" : "bg-surface"
      }`}
    >
      {/* The table's colour, so the list scans in the same terms as the floor. */}
      {colour && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ backgroundColor: colour.ink }}
        />
      )}

      <span
        className={`w-11 shrink-0 text-[13px] font-semibold tabular-nums ${
          cancelled ? "line-through decoration-danger/60" : ""
        }`}
      >
        {booking.time || "—"}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{booking.name}</span>
        <span className="block truncate text-[11px] tabular-nums text-muted">
          {booking.phone || "Sin teléfono"}
          {booking.notes ? ` · ${booking.notes}` : ""}
        </span>
      </span>

      <span className="hidden items-center gap-1 text-xs text-muted sm:inline-flex">
        <UsersIcon size={13} />
        {booking.partySize}
      </span>

      {booking.tables.length > 0 && (
        <span className="hidden items-center gap-1 text-muted md:inline-flex">
          <TableIcon size={13} />
          {booking.tables.map((table) => (
            <TablePill key={table.id} table={table} />
          ))}
        </span>
      )}

      <StatusChip status={booking.status} />
    </button>
  );
}

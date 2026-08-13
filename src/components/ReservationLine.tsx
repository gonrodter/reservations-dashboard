"use client";

import type { Booking } from "@/lib/types";
import { isCancelled } from "@/lib/types";
import { statusLabel } from "@/components/StatusChip";
import { tableColour } from "@/lib/table-colours";

// One shared grid for the head and every line under it, so the four figures a
// service needs — hora, cliente, mesa, pax — line up down the whole list.
const COLUMNS = "grid grid-cols-[3.25rem_1fr_4.5rem_2.25rem] px-3";

/** The column head a list of reservations sits under. */
export function ReservationColumns() {
  return (
    <div
      className={`${COLUMNS} border-b border-line bg-sunken text-[10px] font-semibold uppercase tracking-wide text-muted`}
    >
      <span className="py-1">Hora</span>
      <span className="py-1">Cliente</span>
      <span className="py-1">Mesa</span>
      <span className="py-1 text-right">Pax</span>
    </div>
  );
}

/** One reservation: the four figures a service needs, nothing else. */
export function ReservationLine({
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

  return (
    <button
      type="button"
      onClick={() => onSelect(booking)}
      aria-pressed={selected}
      className={`${COLUMNS} w-full items-center text-left transition-colors hover:bg-sunken ${
        first ? "" : "border-t border-line"
      } ${selected ? "bg-sunken" : ""} ${cancelled ? "opacity-70" : ""}`}
    >
      <span
        className={`py-2 text-[13px] font-semibold tabular-nums ${
          cancelled ? "text-danger line-through" : ""
        }`}
      >
        {booking.time || "—"}
      </span>

      <span className="min-w-0 py-2 pr-2">
        <span className="block truncate text-[13px] font-medium">{booking.name}</span>
        {cancelled && (
          <span className="block truncate text-[11px] font-medium text-danger">
            {statusLabel(booking.status)}
          </span>
        )}
      </span>

      {/* Each name in its table's own colour, the same one the floor uses. */}
      <span className="truncate py-2 pr-2 text-[12px] font-medium text-muted">
        {booking.tables.length > 0
          ? booking.tables.map((table, index) => (
              <span key={table.id} style={{ color: tableColour(table.id, table.colour).ink }}>
                {index > 0 ? ", " : ""}
                {table.name}
              </span>
            ))
          : "—"}
      </span>

      <span className="py-2 text-right text-[13px] font-semibold tabular-nums">
        {booking.partySize}
      </span>
    </button>
  );
}

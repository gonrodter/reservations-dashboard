"use client";

import type { Booking } from "@/lib/types";
import { StatusChip } from "@/components/StatusChip";
import { PhoneIcon, TableIcon, UsersIcon } from "@/components/icons";

export function ReservationCard({
  booking,
  selected,
  onSelect,
}: {
  booking: Booking;
  selected: boolean;
  onSelect: (booking: Booking) => void;
}) {
  const cancelled = booking.status === "cancelled" || booking.status === "no_show";

  return (
    <button
      type="button"
      onClick={() => onSelect(booking)}
      aria-pressed={selected}
      className={`w-full rounded-xl border bg-surface p-3 text-left shadow-card transition-all active:scale-[0.99] active:bg-sunken ${
        selected
          ? "border-info ring-2 ring-info-soft"
          : "border-line hover:border-line-strong"
      } ${cancelled ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-sm font-semibold tabular-nums ${
            cancelled ? "line-through decoration-danger/60" : ""
          }`}
        >
          {booking.time || "—"}
        </span>
        <StatusChip status={booking.status} />
      </div>

      <p className="mt-1.5 truncate text-[13px] font-medium text-ink">
        {booking.name}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          <UsersIcon size={12} />
          {booking.partySize || "—"}
        </span>
        {booking.phone && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <PhoneIcon size={12} />
            {booking.phone}
          </span>
        )}
        {booking.tables.length > 0 && (
          <span className="ml-auto inline-flex items-center gap-1">
            <TableIcon size={12} />
            {booking.tables.map((table) => (
              <span
                key={table.id}
                className="rounded-md border border-line bg-sunken px-1.5 py-0.5 font-medium text-ink-soft"
              >
                {table.name}
              </span>
            ))}
          </span>
        )}
      </div>
    </button>
  );
}

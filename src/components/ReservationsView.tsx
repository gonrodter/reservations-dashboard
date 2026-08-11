"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Booking, BookingStatus, Restaurant } from "@/lib/types";
import { isCancelled } from "@/lib/types";
import { formatDayLabel } from "@/lib/dates";
import { TopBar } from "@/components/TopBar";
import { ReservationRow } from "@/components/ReservationRow";
import { EmptyState } from "@/components/EmptyState";
import { Card, Field, Input, Segmented, Select } from "@/components/ui";
import { ListIcon, SearchIcon, Spinner } from "@/components/icons";
import { useReservationOverlays } from "@/components/useReservationOverlays";
import { useLiveBookings } from "@/components/useLiveBookings";

export type RangePreset = "today" | "upcoming" | "week" | "month" | "past" | "custom";

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "past", label: "Past" },
  { value: "custom", label: "Custom" },
];

const STATUS_OPTIONS: { value: BookingStatus | "all" | "active"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active only" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending" },
  { value: "seated", label: "Seated" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
];

/** The date range lives in the URL so a filtered view can be shared or reloaded. */
const PAGE_SIZE = 60;

export function ReservationsView({
  restaurant,
  today,
  bookings,
  preset,
  from,
  to,
}: {
  restaurant: Restaurant;
  today: string;
  bookings: Booking[];
  preset: RangePreset;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<BookingStatus | "all" | "active">("all");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { selected, select, openCreate, overlays } = useReservationOverlays(today);
  useLiveBookings(restaurant.id);

  function applyRange(next: Partial<{ preset: RangePreset; from: string; to: string }>) {
    const params = new URLSearchParams();
    const nextPreset = next.preset ?? preset;
    params.set("range", nextPreset);
    if (nextPreset === "custom") {
      params.set("from", next.from ?? from);
      params.set("to", next.to ?? to);
    }
    startNavigation(() => router.replace(`/reservations?${params}`, { scroll: false }));
  }

  // Status and text filtering stay on the client so typing during service
  // feels instant; only the date range costs a round trip.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter((booking) => {
      if (status === "active" && isCancelled(booking)) return false;
      if (status !== "all" && status !== "active" && booking.status !== status) {
        return false;
      }
      if (!q) return true;
      return (
        booking.name.toLowerCase().includes(q) ||
        booking.phone.toLowerCase().includes(q)
      );
    });
  }, [bookings, query, status]);

  const visible = filtered.slice(0, limit);

  const groups = useMemo(() => {
    const byDate = new Map<string, Booking[]>();
    for (const booking of visible) {
      const list = byDate.get(booking.serviceDate) ?? [];
      list.push(booking);
      byDate.set(booking.serviceDate, list);
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  const covers = filtered
    .filter((booking) => !isCancelled(booking))
    .reduce((sum, booking) => sum + (booking.partySize || 0), 0);

  return (
    <>
      <TopBar
        title={restaurant.name}
        search={{
          value: query,
          onChange: (value) => {
            setQuery(value);
            setLimit(PAGE_SIZE);
          },
          placeholder: "Search by guest name or phone",
        }}
        onNew={() => openCreate(today >= from ? today : from)}
      />

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-3 py-4 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Reservations</h2>
            <p className="text-xs text-muted tabular-nums">
              {filtered.length} {filtered.length === 1 ? "reservation" : "reservations"} ·{" "}
              {covers} {covers === 1 ? "cover" : "covers"}
            </p>
          </div>

          {/* Filters */}
          <div className="mt-3 space-y-2">
            <div className="thin-scroll -mx-3 flex gap-2 overflow-x-auto px-3 md:mx-0 md:px-0">
              <Segmented
                label="Date range"
                value={preset}
                options={PRESETS}
                onChange={(value) => {
                  setLimit(PAGE_SIZE);
                  applyRange({ preset: value });
                }}
              />
              <div className="shrink-0">
                <Select
                  aria-label="Status"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as BookingStatus | "all" | "active");
                    setLimit(PAGE_SIZE);
                  }}
                  className="w-auto py-1"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              {navigating && (
                <span className="flex shrink-0 items-center text-muted">
                  <Spinner size={14} />
                </span>
              )}
            </div>

            {preset === "custom" && (
              <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
                <Field label="From">
                  <Input
                    type="date"
                    value={from}
                    max={to}
                    onChange={(event) => applyRange({ from: event.target.value })}
                  />
                </Field>
                <Field label="To">
                  <Input
                    type="date"
                    value={to}
                    min={from}
                    onChange={(event) => applyRange({ to: event.target.value })}
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Results */}
          {bookings.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                icon={<ListIcon size={18} />}
                title="No reservations in this period"
                body="Pick another date range, or create a reservation for a guest who called."
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                icon={<SearchIcon size={18} />}
                title="No matches"
                body="No reservation matches these filters. Try clearing the search or status."
              />
            </div>
          ) : (
            <>
              {groups.map(([date, list]) => (
                <section key={date} className="mt-5">
                  <h3 className="sticky top-0 z-10 -mx-3 bg-surface/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted backdrop-blur md:-mx-6 md:px-6">
                    {formatDayLabel(date)}
                    {date === today && (
                      <span className="ml-1.5 rounded bg-info-soft px-1 py-0.5 text-[10px] text-info">
                        Today
                      </span>
                    )}
                  </h3>
                  <Card className="mt-1 overflow-hidden">
                    {list.map((booking, index) => (
                      <ReservationRow
                        key={booking.id}
                        booking={booking}
                        selected={selected?.id === booking.id}
                        first={index === 0}
                        onSelect={select}
                      />
                    ))}
                  </Card>
                </section>
              ))}

              {filtered.length > visible.length && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setLimit((value) => value + PAGE_SIZE)}
                    className="rounded-lg border border-line px-4 py-2 text-[13px] font-medium hover:bg-sunken"
                  >
                    Show {Math.min(PAGE_SIZE, filtered.length - visible.length)} more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {overlays}
    </>
  );
}

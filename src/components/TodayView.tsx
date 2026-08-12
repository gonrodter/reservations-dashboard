"use client";

import { useMemo, useState } from "react";
import type { Booking, Restaurant, RestaurantTable } from "@/lib/types";
import { isCancelled } from "@/lib/types";
import { formatDayLabel } from "@/lib/dates";
import { TopBar } from "@/components/TopBar";
import { SummaryStats } from "@/components/SummaryStats";
import { ReservationCard } from "@/components/ReservationCard";
import { FloorView } from "@/components/FloorView";
import { EmptyState } from "@/components/EmptyState";
import { CalendarIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { useReservationOverlays } from "@/components/useReservationOverlays";
import { useLiveBookings } from "@/components/useLiveBookings";
import { Segmented } from "@/components/ui";

/** Phones show one pane at a time; both are side by side from large up. */
type MobilePane = "map" | "list";

export function TodayView({
  restaurant,
  today,
  bookings,
  tables,
  upcomingCount,
  defaultDurationMinutes,
  nowMs,
}: {
  restaurant: Restaurant;
  today: string;
  bookings: Booking[];
  tables: RestaurantTable[];
  upcomingCount: number;
  /** Fallback sitting length for bookings with no ends_at. */
  defaultDurationMinutes?: number;
  /** The server's clock, so the first paint matches on both sides. */
  nowMs: number;
}) {
  const [query, setQuery] = useState("");
  const [pane, setPane] = useState<MobilePane>("map");
  const { selected, select, selectFromTable, openCreate, overlays } =
    useReservationOverlays(today);
  useLiveBookings(restaurant.id);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter(
      (booking) =>
        booking.name.toLowerCase().includes(q) ||
        booking.phone.toLowerCase().includes(q)
    );
  }, [bookings, query]);

  const stats = useMemo(() => {
    const live = bookings.filter((booking) => !isCancelled(booking));
    const now = nowMs;
    const next = live.find(
      (booking) => booking.startsAt && Date.parse(booking.startsAt) >= now
    );
    const cancelledCount = bookings.length - live.length;

    // Labels stay short: the strip sits in a 360px panel beside the floor.
    return [
      { label: "Reservas", value: String(live.length) },
      {
        label: "Comensales",
        value: String(live.reduce((sum, booking) => sum + (booking.partySize || 0), 0)),
      },
      { label: "Próxima", value: next?.time ?? "—" },
      cancelledCount > 0
        ? { label: "Canceladas", value: String(cancelledCount), tone: "danger" as const }
        : { label: "Próximas", value: String(upcomingCount) },
    ];
  }, [bookings, upcomingCount, nowMs]);

  return (
    <>
      <TopBar
        title={restaurant.name}
        search={{
          value: query,
          onChange: setQuery,
          placeholder: "Buscar por nombre o teléfono",
        }}
        onNew={() => openCreate(today)}
      />

      {/* Pane switch, phones and tablets only */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2 lg:hidden">
        <p className="truncate text-xs text-muted">{formatDayLabel(today)}</p>
        <Segmented
          label="Vista"
          value={pane}
          options={[
            { value: "map", label: "Plano" },
            { value: "list", label: "Reservas" },
          ]}
          onChange={setPane}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Reservation list panel */}
        <aside
          className={`w-full min-w-0 flex-col border-line lg:flex lg:w-[360px] lg:shrink-0 lg:border-r xl:w-[380px] ${
            pane === "list" ? "flex" : "hidden"
          }`}
        >
          <div className="shrink-0 px-3 pb-2 pt-3 md:px-4">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Servicio de hoy</h2>
                <p className="text-xs text-muted">{formatDayLabel(today)}</p>
              </div>
              <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-ink-soft">
                {filtered.length}
              </span>
            </div>
            <div className="mt-3">
              <SummaryStats stats={stats} />
            </div>
          </div>

          <div className="thin-scroll flex-1 space-y-2 overflow-y-auto px-3 pb-4 md:px-4">
            {bookings.length === 0 ? (
              <EmptyState
                icon={<CalendarIcon size={18} />}
                title="No hay reservas para hoy"
                body="Las nuevas reservas de hoy aparecerán aquí cuando entren."
                action={
                  <button
                    type="button"
                    onClick={() => openCreate(today)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-surface hover:opacity-85"
                  >
                    <PlusIcon size={13} /> Nueva reserva
                  </button>
                }
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<SearchIcon size={18} />}
                title="Sin resultados"
                body={`Ninguna reserva coincide con “${query.trim()}”.`}
              />
            ) : (
              filtered.map((booking) => (
                <ReservationCard
                  key={booking.id}
                  booking={booking}
                  selected={selected?.id === booking.id}
                  onSelect={select}
                />
              ))
            )}
          </div>
        </aside>

        {/* Isometric floor */}
        <main
          className={`min-w-0 flex-1 lg:block ${pane === "map" ? "block" : "hidden"}`}
        >
          <FloorView
            tables={tables}
            bookings={bookings}
            selectedId={selected?.id ?? null}
            onSelect={selectFromTable}
            timezone={restaurant.timezone}
            arrangeable
            defaultDurationMinutes={defaultDurationMinutes}
            initialNow={nowMs}
          />
        </main>
      </div>

      {overlays}
    </>
  );
}

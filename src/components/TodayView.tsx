"use client";

import { useMemo, useState } from "react";
import type { Booking, Restaurant, RestaurantTable } from "@/lib/types";
import { isCancelled } from "@/lib/types";
import { formatDayLabel } from "@/lib/dates";
import { TopBar } from "@/components/TopBar";
import { ReservationColumns, ReservationLine } from "@/components/ReservationLine";
import { FloorView } from "@/components/FloorView";
import { EmptyState } from "@/components/EmptyState";
import { CalendarIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { useReservationOverlays } from "@/components/useReservationOverlays";
import { useLiveBookings } from "@/components/useLiveBookings";
import { Card, Segmented } from "@/components/ui";

/** Phones show one pane at a time; both are side by side from large up. */
type MobilePane = "map" | "list";

export function TodayView({
  restaurant,
  today,
  bookings,
  tables,
  defaultDurationMinutes,
  nowMs,
}: {
  restaurant: Restaurant;
  today: string;
  bookings: Booking[];
  tables: RestaurantTable[];
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

  // A cancelled reservation is not part of the service: the panel lists only
  // the ones that are still coming. The floor plan filters them out too.
  const live = useMemo(
    () => bookings.filter((booking) => !isCancelled(booking)),
    [bookings]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return live;
    return live.filter(
      (booking) =>
        booking.name.toLowerCase().includes(q) ||
        booking.phone.toLowerCase().includes(q)
    );
  }, [live, query]);

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
          </div>

          <div className="thin-scroll flex-1 overflow-y-auto px-3 pb-4 md:px-4">
            {live.length === 0 ? (
              <EmptyState
                icon={<CalendarIcon size={18} />}
                title="No hay reservas para hoy"
                body="Las nuevas reservas de hoy aparecerán aquí cuando entren."
                action={
                  <button
                    type="button"
                    onClick={() => openCreate(today)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-ok px-3 py-1.5 text-xs font-medium text-white hover:opacity-85"
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
              <Card className="overflow-hidden">
                <ReservationColumns />
                {filtered.map((booking, index) => (
                  <ReservationLine
                    key={booking.id}
                    booking={booking}
                    selected={selected?.id === booking.id}
                    first={index === 0}
                    onSelect={select}
                  />
                ))}
              </Card>
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

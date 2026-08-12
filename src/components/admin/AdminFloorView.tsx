"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminRestaurant, FloorSnapshot } from "@/lib/admin-data";
import type { Booking } from "@/lib/types";
import { isCancelled } from "@/lib/types";
import { formatDayLabel } from "@/lib/dates";
import { TopBar } from "@/components/TopBar";
import { SummaryStats } from "@/components/SummaryStats";
import { ReservationCard } from "@/components/ReservationCard";
import { FloorView } from "@/components/FloorView";
import { DetailDrawer } from "@/components/DetailDrawer";
import { EmptyState } from "@/components/EmptyState";
import { Segmented, Select } from "@/components/ui";
import { CalendarIcon, ChevronRightIcon, Spinner, TableIcon } from "@/components/icons";
import { useLiveBookings } from "@/components/useLiveBookings";

/**
 * The live table map for any restaurant, shown the way that restaurant's own
 * team sees it on their Today screen: same FloorView, same reservation cards,
 * same timezone.
 *
 * Reservations open in a read-only drawer. Modify and Cancel are deliberately
 * absent, because those actions resolve the restaurant from the signed-in
 * user's membership and a superadmin is not a member of the restaurants they
 * are looking at.
 */
export function AdminFloorView({
  restaurants,
  snapshot,
  nowMs,
}: {
  restaurants: AdminRestaurant[];
  snapshot: FloorSnapshot | null;
  /** The server's clock, so the first paint matches on both sides. */
  nowMs: number;
}) {
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const [selected, setSelected] = useState<Booking | null>(null);
  const [tableBookings, setTableBookings] = useState<Booking[]>([]);

  const restaurant = snapshot?.restaurant;

  const stats = useMemo(() => {
    const bookings = snapshot?.bookings ?? [];
    const live = bookings.filter((booking) => !isCancelled(booking));
    const now = nowMs;
    const next = live.find(
      (booking) => booking.startsAt && Date.parse(booking.startsAt) >= now
    );
    const cancelled = bookings.length - live.length;
    const inService = (snapshot?.tables ?? []).filter((table) => table.active);

    return [
      { label: "Reservas", value: String(live.length) },
      {
        label: "Comensales",
        value: String(live.reduce((sum, booking) => sum + (booking.partySize || 0), 0)),
      },
      { label: "Próxima", value: next?.time ?? "—" },
      cancelled > 0
        ? { label: "Canceladas", value: String(cancelled), tone: "danger" as const }
        : { label: "Mesas", value: String(inService.length) },
    ];
  }, [snapshot, nowMs]);

  function pick(id: string) {
    setSelected(null);
    setTableBookings([]);
    startSwitch(() => router.replace(`/admin/floors?restaurant=${id}`, { scroll: false }));
  }

  function select(booking: Booking, bookings: Booking[] = []) {
    setTableBookings(bookings);
    setSelected(booking);
  }

  if (restaurants.length === 0) {
    return (
      <>
        <TopBar title="Administración de Terron Studio" />
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            icon={<TableIcon size={18} />}
            title="Todavía no hay restaurantes activos"
            body="Cuando se active un restaurante, su plano de mesas aparecerá aquí."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        title="Administración de Terron Studio"
        extra={
          <>
            {switching && <Spinner size={14} className="text-muted" />}
            <Select
              aria-label="Restaurante"
              value={restaurant?.id ?? ""}
              onChange={(event) => pick(event.target.value)}
              className="w-auto max-w-44 py-1"
            >
              {restaurants.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </>
        }
      />

      {!snapshot ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            icon={<TableIcon size={18} />}
            title="Restaurante no encontrado"
            body="Elige otro restaurante de la lista superior."
          />
        </div>
      ) : (
        <FloorBody
          snapshot={snapshot}
          selected={selected}
          onSelect={select}
          stats={stats}
          nowMs={nowMs}
        />
      )}

      <DetailDrawer
        booking={selected}
        bookings={tableBookings}
        onNavigate={setSelected}
        readOnly
        onClose={() => {
          setSelected(null);
          setTableBookings([]);
        }}
        onEdit={() => {}}
        onCancel={() => {}}
      />
    </>
  );
}

function FloorBody({
  snapshot,
  selected,
  onSelect,
  stats,
  nowMs,
}: {
  snapshot: FloorSnapshot;
  selected: Booking | null;
  onSelect: (booking: Booking, tableBookings?: Booking[]) => void;
  stats: { label: string; value: string; tone?: "default" | "danger" }[];
  nowMs?: number;
}) {
  const { restaurant, tables, bookings, today } = snapshot;
  useLiveBookings(restaurant.id);

  const [pane, setPane] = useState<"map" | "list">("map");

  return (
    <>
    {/* Pane switch, phones and tablets only */}
    <div className="flex shrink-0 items-center justify-end border-b border-line px-3 py-2 lg:hidden">
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
      <aside
        className={`w-full min-w-0 flex-col border-line lg:flex lg:w-[360px] lg:shrink-0 lg:border-r xl:w-[380px] ${
          pane === "list" ? "flex" : "hidden"
        }`}
      >
        <div className="shrink-0 px-3 pb-2 pt-3 md:px-4">
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{restaurant.name}</h2>
              <p className="truncate text-xs text-muted">
                {restaurant.slug} · {formatDayLabel(today)}
              </p>
            </div>
            <Link
              href={`/admin/restaurants/${restaurant.id}`}
              className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-medium text-ink-soft hover:text-ink"
            >
              Configuración
              <ChevronRightIcon size={11} />
            </Link>
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
              body="Este restaurante no tiene reservas para hoy."
            />
          ) : (
            bookings.map((booking) => (
              <ReservationCard
                key={booking.id}
                booking={booking}
                selected={selected?.id === booking.id}
                onSelect={(nextBooking) => onSelect(nextBooking)}
              />
            ))
          )}
        </div>
      </aside>

      <main
        className={`min-w-0 flex-1 lg:block ${pane === "map" ? "block" : "hidden"}`}
      >
        <FloorView
          tables={tables}
          bookings={bookings}
          selectedId={selected?.id ?? null}
          onSelect={onSelect}
          timezone={restaurant.timezone}
          defaultDurationMinutes={snapshot.defaultDurationMinutes ?? undefined}
          initialNow={nowMs}
        />
      </main>
    </div>
    </>
  );
}

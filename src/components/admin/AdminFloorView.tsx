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
import { Select } from "@/components/ui";
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
      { label: "Bookings", value: String(live.length) },
      {
        label: "Covers",
        value: String(live.reduce((sum, booking) => sum + (booking.partySize || 0), 0)),
      },
      { label: "Next", value: next?.time ?? "—" },
      cancelled > 0
        ? { label: "Cancelled", value: String(cancelled), tone: "danger" as const }
        : { label: "Tables", value: String(inService.length) },
    ];
  }, [snapshot, nowMs]);

  function pick(id: string) {
    startSwitch(() => router.replace(`/admin/floors?restaurant=${id}`, { scroll: false }));
  }

  if (restaurants.length === 0) {
    return (
      <>
        <TopBar title="Terron Studio admin" />
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmptyState
            icon={<TableIcon size={18} />}
            title="No live restaurants yet"
            body="Once a restaurant is activated, its table map appears here."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        title="Terron Studio admin"
        extra={
          <>
            {switching && <Spinner size={14} className="text-muted" />}
            <Select
              aria-label="Restaurant"
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
            title="Restaurant not found"
            body="Pick another restaurant from the list above."
          />
        </div>
      ) : (
        <FloorBody
          snapshot={snapshot}
          selected={selected}
          onSelect={setSelected}
          stats={stats}
          nowMs={nowMs}
        />
      )}

      <DetailDrawer
        booking={selected}
        readOnly
        onClose={() => setSelected(null)}
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
  onSelect: (booking: Booking) => void;
  stats: { label: string; value: string; tone?: "default" | "danger" }[];
  nowMs?: number;
}) {
  const { restaurant, tables, bookings, today } = snapshot;
  useLiveBookings(restaurant.id);

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-full min-w-0 flex-col border-line lg:w-[360px] lg:shrink-0 lg:border-r xl:w-[380px]">
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
              Config
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
              title="No reservations today"
              body="This restaurant has nothing booked for today."
            />
          ) : (
            bookings.map((booking) => (
              <ReservationCard
                key={booking.id}
                booking={booking}
                selected={selected?.id === booking.id}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </aside>

      <main className="hidden min-w-0 flex-1 lg:block">
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
  );
}

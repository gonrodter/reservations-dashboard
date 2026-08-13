"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Booking, BookingStatus, Restaurant } from "@/lib/types";
import { isCancelled } from "@/lib/types";
import { formatDayLabel } from "@/lib/dates";
import { TopBar } from "@/components/TopBar";
import { ReservationColumns, ReservationLine } from "@/components/ReservationLine";
import { EmptyState } from "@/components/EmptyState";
import { Card, Field, Input, LoadingOverlay, Segmented, Select } from "@/components/ui";
import { ListIcon, SearchIcon } from "@/components/icons";
import { useReservationOverlays } from "@/components/useReservationOverlays";
import { useLiveBookings } from "@/components/useLiveBookings";

export type RangePreset = "today" | "upcoming" | "week" | "month" | "past" | "custom";

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "upcoming", label: "Próximas" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
  { value: "past", label: "Anteriores" },
  { value: "custom", label: "Personalizado" },
];

const STATUS_OPTIONS: { value: BookingStatus | "all" | "active"; label: string }[] = [
  { value: "all", label: "Todos los estados" },
  { value: "active", label: "Solo activas" },
  { value: "confirmed", label: "Confirmadas" },
  { value: "pending", label: "Pendientes" },
  { value: "seated", label: "En mesa" },
  { value: "completed", label: "Completadas" },
  { value: "cancelled", label: "Canceladas" },
  { value: "no_show", label: "No se presentaron" },
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
  // What the range switch shows while its navigation is in flight.
  const [pickedPreset, setPickedPreset] = useOptimistic(preset);
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
    // The control answers the tap straight away; the list behind it only
    // changes once the new range has arrived.
    startNavigation(() => {
      setPickedPreset(nextPreset);
      router.replace(`/reservations?${params}`, { scroll: false });
    });
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
          placeholder: "Buscar por nombre o teléfono",
        }}
        onNew={() => openCreate(today >= from ? today : from)}
      />

      <div className="relative min-h-0 flex-1">
      <div className="thin-scroll h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl px-3 py-4 md:px-6">
          {/* Filters */}
          <div className="space-y-2">
            <div className="thin-scroll -mx-3 flex gap-2 overflow-x-auto px-3 md:mx-0 md:px-0">
              <Segmented
                label="Intervalo de fechas"
                value={pickedPreset}
                options={PRESETS}
                onChange={(value) => {
                  setLimit(PAGE_SIZE);
                  applyRange({ preset: value });
                }}
              />
              <div className="shrink-0">
                <Select
                  aria-label="Estado"
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
            </div>

            {preset === "custom" && (
              <div className="grid grid-cols-2 gap-2 sm:max-w-xs">
                <Field label="Desde">
                  <Input
                    type="date"
                    value={from}
                    max={to}
                    onChange={(event) => applyRange({ from: event.target.value })}
                  />
                </Field>
                <Field label="Hasta">
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
                title="No hay reservas en este periodo"
                body="Elige otro intervalo de fechas o crea una reserva para un cliente que haya llamado."
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                icon={<SearchIcon size={18} />}
                title="Sin resultados"
                body="Ninguna reserva coincide con estos filtros. Prueba a borrar la búsqueda o el estado."
              />
            </div>
          ) : (
            <>
              {groups.map(([date, list]) => (
                <section key={date} className="mt-5">
                  <h3 className="sticky top-0 z-10 -mx-3 flex items-baseline gap-1.5 bg-surface/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted backdrop-blur md:-mx-6 md:px-6">
                    {formatDayLabel(date)}
                    {date === today && (
                      <span className="font-medium normal-case text-ink-soft">· Hoy</span>
                    )}
                  </h3>

                  <Card className="mt-1 overflow-hidden">
                    <ReservationColumns />

                    {list.map((booking, index) => (
                      <ReservationLine
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
                    className="rounded-lg border border-line bg-surface px-4 py-2 text-[13px] font-medium hover:bg-sunken"
                  >
                    Mostrar {Math.min(PAGE_SIZE, filtered.length - visible.length)} más
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {navigating && <LoadingOverlay />}
      </div>

      {overlays}
    </>
  );
}

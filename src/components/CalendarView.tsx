"use client";

import { useMemo, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Booking, BookingHour, Restaurant } from "@/lib/types";
import { isCancelled } from "@/lib/types";
import {
  addDays,
  formatDayLabel,
  formatShortDay,
  hhmmFromMinutes,
  minutesFromHHMM,
  todayISO,
  weekdayOf,
  weekStart,
  WEEKDAYS_SHORT,
} from "@/lib/dates";
import { TopBar } from "@/components/TopBar";
import { EmptyState } from "@/components/EmptyState";
import { ReservationColumns, ReservationLine } from "@/components/ReservationLine";
import { bookingColour } from "@/lib/table-colours";
import { Card, LoadingOverlay, Segmented } from "@/components/ui";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { useReservationOverlays } from "@/components/useReservationOverlays";
import { useLiveBookings } from "@/components/useLiveBookings";

export type CalendarMode = "day" | "week";

const HOUR_HEIGHT = 56; // px per hour on the timeline

interface Placed {
  booking: Booking;
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
}

/** A run of overlapping reservations that did not all fit side by side. */
interface Overflow {
  startMin: number;
  hidden: number;
}

interface DayLayout {
  placed: Placed[];
  overflows: Overflow[];
}

/**
 * Positions a day's reservations, splitting overlapping ones into side-by-side
 * lanes. Lanes are capped so a busy service cannot shrink each block into an
 * unreadable sliver; whatever does not fit is reported as an overflow count
 * that links through to the day view.
 */
function layoutDay(
  bookings: Booking[],
  fallbackMinutes: number,
  maxLanes: number
): DayLayout {
  const items = bookings
    .filter((booking) => booking.time)
    .map((booking) => {
      const startMin =
        minutesFromHHMM(booking.time) +
        (booking.date > booking.serviceDate ? 24 * 60 : 0);
      const durationMinutes =
        booking.startsAt && booking.endsAt
          ? Math.round(
              (new Date(booking.endsAt).getTime() -
                new Date(booking.startsAt).getTime()) /
                60000
            )
          : fallbackMinutes;
      const duration = Math.min(
        Math.max(Number.isFinite(durationMinutes) ? durationMinutes : fallbackMinutes, 30),
        480
      );
      return { booking, startMin, endMin: startMin + duration };
    })
    .sort((a, b) => a.startMin - b.startMin);

  // Group into clusters of mutually overlapping bookings, then assign lanes
  // within each cluster.
  const placed: Placed[] = [];
  const overflows: Overflow[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const assigned = cluster.map((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.endMin);
      } else {
        laneEnds[lane] = item.endMin;
      }
      return { ...item, lane };
    });

    const lanes = Math.min(laneEnds.length, maxLanes);
    const fitting = assigned.filter((item) => item.lane < lanes);
    const hidden = assigned.length - fitting.length;

    for (const item of fitting) placed.push({ ...item, lanes });
    if (hidden > 0) {
      overflows.push({ startMin: cluster[0].startMin, hidden });
    }

    cluster = [];
    clusterEnd = -1;
  };

  for (const item of items) {
    if (cluster.length > 0 && item.startMin >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();

  return { placed, overflows };
}

/** Timeline bounds: whole hours covering both the bookings and the open periods. */
function bounds(placed: Placed[], periods: BookingHour[]): [number, number] {
  let min = 24 * 60;
  let max = 0;

  for (const item of placed) {
    min = Math.min(min, item.startMin);
    max = Math.max(max, item.endMin);
  }
  for (const period of periods) {
    min = Math.min(min, minutesFromHHMM(period.startTime));
    max = Math.max(
      max,
      period.spansNextDay
        ? 24 * 60 + minutesFromHHMM(period.endTime)
        : minutesFromHHMM(period.endTime)
    );
  }
  if (min >= max) return [12 * 60, 24 * 60];

  return [
    Math.max(0, Math.floor(min / 60) * 60 - 60),
    Math.min(30 * 60, Math.ceil(max / 60) * 60 + 60),
  ];
}

function BookingBlock({
  item,
  start,
  compact,
  selected,
  onSelect,
}: {
  item: Placed;
  start: number;
  compact: boolean;
  selected: boolean;
  onSelect: (booking: Booking) => void;
}) {
  const cancelled = isCancelled(item.booking);
  const width = 100 / item.lanes;
  // The block takes the colour of its table, so a service reads as which
  // tables are busy when. Selection and cancellation override it.
  const colour = !selected && !cancelled ? bookingColour(item.booking.tables) : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(item.booking)}
      aria-pressed={selected}
      className={`absolute overflow-hidden rounded-lg border px-1.5 py-1 text-left transition-colors ${
        selected
          ? "border-info bg-info-soft"
          : cancelled
            ? "border-line bg-sunken opacity-60"
            : "border-line bg-surface hover:border-line-strong"
      }`}
      style={{
        top: ((item.startMin - start) / 60) * HOUR_HEIGHT,
        height: Math.max(((item.endMin - item.startMin) / 60) * HOUR_HEIGHT - 2, 22),
        left: `calc(${item.lane * width}% + 2px)`,
        width: `calc(${width}% - 4px)`,
        ...(colour && {
          backgroundColor: colour.fill,
          borderColor: colour.line,
        }),
      }}
    >
      <span className="flex items-baseline gap-1">
        <span
          className={`text-[11px] font-semibold tabular-nums ${
            cancelled ? "line-through decoration-danger/60" : ""
          }`}
        >
          {item.booking.time}
        </span>
        <span className="text-[10px] text-muted">·{item.booking.partySize}</span>
      </span>
      <span className="block truncate text-[11px] font-medium leading-4">
        {item.booking.name}
      </span>
      {!compact && item.booking.tables.length > 0 && (
        <span
          className="block truncate text-[10px] font-medium"
          style={{ color: colour?.ink ?? "var(--color-muted)" }}
        >
          {item.booking.tables.map((table) => table.name).join(", ")}
        </span>
      )}
    </button>
  );
}

function HourGrid({
  start,
  end,
  periods,
}: {
  start: number;
  end: number;
  periods: BookingHour[];
}) {
  const hours: number[] = [];
  for (let minute = start; minute < end; minute += 60) hours.push(minute);

  return (
    <>
      {/* Shaded bands for the hours the restaurant takes bookings */}
      {periods.map((period, index) => {
        const from = Math.max(minutesFromHHMM(period.startTime), start);
        const until = Math.min(
          period.spansNextDay
            ? 24 * 60 + minutesFromHHMM(period.endTime)
            : minutesFromHHMM(period.endTime),
          end
        );
        if (until <= from) return null;
        return (
          <div
            key={index}
            aria-hidden
            className="absolute inset-x-0 bg-sunken/70"
            style={{
              top: ((from - start) / 60) * HOUR_HEIGHT,
              height: ((until - from) / 60) * HOUR_HEIGHT,
            }}
          />
        );
      })}
      {hours.map((minute) => (
        <div
          key={minute}
          aria-hidden
          className="absolute inset-x-0 border-t border-line"
          style={{ top: ((minute - start) / 60) * HOUR_HEIGHT }}
        />
      ))}
    </>
  );
}

export function CalendarView({
  restaurant,
  mode,
  date,
  bookings,
  bookingHours,
  defaultDurationMinutes,
}: {
  restaurant: Restaurant;
  mode: CalendarMode;
  date: string;
  bookings: Booking[];
  bookingHours: BookingHour[];
  defaultDurationMinutes: number;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  // What the view switch shows while its navigation is in flight.
  const [pickedMode, setPickedMode] = useOptimistic(mode);
  const today = todayISO(restaurant.timezone);
  const { selected, select, openCreate, overlays } = useReservationOverlays(today);
  useLiveBookings(restaurant.id);

  const days = useMemo(() => {
    if (mode === "day") return [date];
    const start = weekStart(date);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [mode, date]);

  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const day of days) map.set(day, []);
    for (const booking of bookings) {
      const list = map.get(booking.serviceDate);
      if (list) list.push(booking);
    }
    return map;
  }, [bookings, days]);

  const activeCount = (day: string) =>
    (byDay.get(day) ?? []).filter((booking) => !isCancelled(booking)).length;

  const activePeriods = useMemo(
    () => bookingHours.filter((hour) => hour.active),
    [bookingHours]
  );

  // A single wide day column can carry many lanes; seven columns cannot.
  const maxLanes = mode === "day" ? 6 : 2;

  const layouts = useMemo(() => {
    const map = new Map<string, DayLayout>();
    for (const day of days) {
      map.set(day, layoutDay(byDay.get(day) ?? [], defaultDurationMinutes, maxLanes));
    }
    return map;
  }, [days, byDay, defaultDurationMinutes, maxLanes]);

  const [start, end] = useMemo(() => {
    const allPlaced = days.flatMap((day) => layouts.get(day)?.placed ?? []);
    const relevantPeriods = activePeriods.filter((hour) =>
      days.some((day) => weekdayOf(day) === hour.dayOfWeek)
    );
    return bounds(allPlaced, relevantPeriods);
  }, [days, layouts, activePeriods]);

  const step = mode === "day" ? 1 : 7;

  function go(target: string) {
    startNavigation(() =>
      router.replace(`/calendar?view=${mode}&date=${target}`, { scroll: false })
    );
  }

  /** Opens one day of the week in the day view, where every booking fits. */
  function goToDay(target: string) {
    startNavigation(() =>
      router.replace(`/calendar?view=day&date=${target}`, { scroll: false })
    );
  }

  function setMode(nextMode: CalendarMode) {
    // The control answers the tap straight away; the grid behind it only
    // changes once the new day or week has arrived.
    startNavigation(() => {
      setPickedMode(nextMode);
      router.replace(`/calendar?view=${nextMode}&date=${date}`, { scroll: false });
    });
  }

  const heading =
    mode === "day"
      ? formatDayLabel(date)
      : `${formatShortDay(days[0])} – ${formatShortDay(days[6])}`;

  const total = bookings.filter((booking) => !isCancelled(booking)).length;

  return (
    <>
      <TopBar
        title={restaurant.name}
        onNew={() => openCreate(date >= today ? date : today)}
      />

      {/* Date navigation */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-2 md:px-6">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => go(addDays(date, -step))}
            aria-label={mode === "day" ? "Día anterior" : "Semana anterior"}
            className="flex size-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-sunken hover:text-ink"
          >
            <ChevronLeftIcon size={15} />
          </button>
          <button
            type="button"
            onClick={() => go(addDays(date, step))}
            aria-label={mode === "day" ? "Día siguiente" : "Semana siguiente"}
            className="flex size-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-sunken hover:text-ink"
          >
            <ChevronRightIcon size={15} />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{heading}</p>
          <p className="text-[11px] text-muted tabular-nums">
            {total} {total === 1 ? "reserva" : "reservas"}
          </p>
        </div>

        {/* Its own line on phones, back on the row's end from tablet up. */}
        <div className="w-full md:ml-auto md:w-auto">
          <Segmented
            label="Vista del calendario"
            value={pickedMode}
            options={[
              { value: "day", label: "Día" },
              { value: "week", label: "Semana" },
            ]}
            onChange={setMode}
          />
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
      <div className="thin-scroll h-full overflow-y-auto pb-24">
        {bookings.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon size={18} />}
            title={mode === "day" ? "No hay reservas este día" : "No hay reservas esta semana"}
            body="Usa Nueva reserva para añadir una reserva hecha por teléfono."
          />
        ) : (
          <>
            {/* Timeline: day always, week from tablet up */}
            <div className={mode === "week" ? "hidden xl:block" : ""}>
              <div className="flex px-3 py-3 md:px-6">
                {/* Hour gutter */}
                <div className="w-11 shrink-0">
                  <div className="h-6" />
                  <div className="relative" style={{ height: ((end - start) / 60) * HOUR_HEIGHT }}>
                    {Array.from({ length: (end - start) / 60 }, (_, index) => (
                      <span
                        key={index}
                        className="absolute -translate-y-1/2 text-[10px] tabular-nums text-muted"
                        style={{ top: index * HOUR_HEIGHT }}
                      >
                        {hhmmFromMinutes(start + index * 60)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Day columns */}
                <div className="flex min-w-0 flex-1 gap-2">
                  {days.map((day) => (
                    <div key={day} className="min-w-0 flex-1">
                      <div className="flex h-6 items-baseline gap-1.5">
                        <span
                          className={`text-xs font-semibold ${
                            day === today ? "text-info" : "text-ink"
                          }`}
                        >
                          {mode === "day"
                            ? "Servicio"
                            : `${WEEKDAYS_SHORT[weekdayOf(day)]} ${day.slice(8)}`}
                        </span>
                        <span className="text-[10px] tabular-nums text-muted">
                          {activeCount(day) || ""}
                        </span>
                      </div>
                      <div
                        className="relative rounded-lg border border-line"
                        style={{ height: ((end - start) / 60) * HOUR_HEIGHT }}
                      >
                        <HourGrid
                          start={start}
                          end={end}
                          periods={activePeriods.filter(
                            (hour) => hour.dayOfWeek === weekdayOf(day)
                          )}
                        />
                        {(layouts.get(day)?.placed ?? []).map((item) => (
                          <BookingBlock
                            key={item.booking.id}
                            item={item}
                            start={start}
                            compact={mode === "week"}
                            selected={selected?.id === item.booking.id}
                            onSelect={select}
                          />
                        ))}
                        {(layouts.get(day)?.overflows ?? []).map((overflow) => (
                          <button
                            key={overflow.startMin}
                            type="button"
                            onClick={() => goToDay(day)}
                            title={`${overflow.hidden} más a esta hora — abrir la vista diaria`}
                            className="absolute right-1 z-10 rounded-md border border-line-strong bg-surface px-1 py-0.5 text-[10px] font-semibold text-ink-soft shadow-card hover:border-ink"
                            style={{
                              top:
                                ((overflow.startMin - start) / 60) * HOUR_HEIGHT + 2,
                            }}
                          >
                            +{overflow.hidden}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Week on phones: a readable list per day instead of seven thin columns */}
            {mode === "week" && (
              <div className="px-3 py-3 xl:hidden">
                {days.map((day) => {
                  const list = byDay.get(day) ?? [];
                  return (
                    <section key={day} className="mb-4">
                      <div className="mb-1 flex items-baseline justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                          {formatShortDay(day)}
                          {day === today && (
                            <span className="ml-1.5 rounded bg-info-soft px-1 py-0.5 text-[10px] normal-case text-info">
                              Hoy
                            </span>
                          )}
                        </h3>
                        <span className="text-[11px] tabular-nums text-muted">
                          {activeCount(day) || "—"}
                        </span>
                      </div>
                      {list.length > 0 && (
                        <Card className="overflow-hidden">
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
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      {navigating && <LoadingOverlay />}
      </div>

      {overlays}
    </>
  );
}

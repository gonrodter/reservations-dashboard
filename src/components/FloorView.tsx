"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Booking, RestaurantTable } from "@/lib/types";
import { zonedToInstant } from "@/lib/dates";
import { saveTableLayout } from "@/lib/config-actions";
import {
  CELL,
  GRID_SIZE,
  PLANE_PADDING,
  PLANE_SIZE,
  cellCentre,
  clampToGrid,
  defaultPosition,
  screenDeltaToGrid,
  type GridBasis,
  type GridPosition,
} from "@/lib/floor-grid";
import { EmptyState } from "@/components/EmptyState";
import { Spinner, TableIcon } from "@/components/icons";

/**
 * Last-resort sitting length, in minutes. Only used when a booking has neither
 * ends_at nor a configured default duration: the length of an existing booking
 * always comes from the database (ends_at − starts_at), never from a setting.
 */
const FALLBACK_MINUTES = 105;

function blockSize(capacity: number | null): number {
  const cap = capacity ?? 4;
  if (cap <= 2) return 56;
  if (cap <= 4) return 78;
  if (cap <= 6) return 96;
  return 110;
}

const CHAIR = 12;

/** Upcoming times printed on a table before they collapse into "+N". */
const MAX_UPCOMING = 2;

// Chair positions around the table footprint: capacity split between the
// north and south edges.
function chairSpots(size: number, capacity: number | null) {
  const cap = Math.max(1, Math.min(capacity ?? 4, 8));
  const north = Math.ceil(cap / 2);
  const south = cap - north;
  const spots: { x: number; y: number }[] = [];
  const row = (n: number, y: number) => {
    const gap = (size - n * CHAIR) / (n + 1);
    for (let i = 0; i < n; i++) spots.push({ x: gap * (i + 1) + CHAIR * i, y });
  };
  row(north, -CHAIR - 6);
  row(south, size + 6);
  return spots;
}

interface TableState {
  table: RestaurantTable;
  /** Whoever is sitting at the table right now. */
  seated: Booking | null;
  /** Every reservation still to come today, earliest first. */
  upcoming: Booking[];
}

/**
 * The window a booking occupies its table for.
 *
 * For a booking that exists, the length is whatever the database says:
 * ends_at − starts_at. The configured default duration is only a fallback for
 * rows without an end, so changing that setting never re-writes history.
 */
function occupancy(
  booking: Booking,
  timezone: string | undefined,
  fallbackMinutes: number
): { start: number; end: number } {
  const start = booking.startsAt
    ? Date.parse(booking.startsAt)
    : zonedToInstant(booking.date, booking.time, timezone).getTime();

  const end = booking.endsAt ? Date.parse(booking.endsAt) : Number.NaN;

  return {
    start,
    end: Number.isFinite(end) && end > start ? end : start + fallbackMinutes * 60_000,
  };
}

function key(position: GridPosition): string {
  return `${position.x},${position.y}`;
}

/** Saved positions where present, otherwise the map's default arrangement. */
function layoutFrom(tables: RestaurantTable[]): Map<string, GridPosition> {
  const taken = new Set<string>();
  const placed = new Map<string, GridPosition>();

  tables.forEach((table) => {
    if (table.gridX == null || table.gridY == null) return;
    const position = { x: clampToGrid(table.gridX), y: clampToGrid(table.gridY) };
    if (taken.has(key(position))) return; // ignore duplicates from bad data
    taken.add(key(position));
    placed.set(table.id, position);
  });

  // Anything unplaced falls into the first free default slot, so a floor that
  // has never been arranged looks exactly as it always did.
  let cursor = 0;
  tables.forEach((table) => {
    if (placed.has(table.id)) return;
    let position = defaultPosition(cursor);
    while (taken.has(key(position)) && cursor < GRID_SIZE * GRID_SIZE) {
      cursor += 1;
      position = defaultPosition(cursor);
    }
    cursor += 1;
    taken.add(key(position));
    placed.set(table.id, position);
  });

  return placed;
}

export function FloorView({
  tables,
  bookings,
  selectedId,
  onSelect,
  timezone,
  arrangeable = false,
  defaultDurationMinutes,
  initialNow,
}: {
  tables: RestaurantTable[];
  bookings: Booking[];
  selectedId: string | null;
  onSelect: (booking: Booking) => void;
  timezone?: string;
  /** Lets the restaurant's own team drag tables into their real layout. */
  arrangeable?: boolean;
  /**
   * Only used for bookings that have no ends_at. A booking with an end always
   * uses its own, so this never overrides what is stored.
   */
  defaultDurationMinutes?: number;
  /**
   * The server's clock at render time. Passing it keeps the first paint
   * identical on both sides; without it a minute boundary between rendering and
   * hydrating would make React discard the tree.
   */
  initialNow?: number;
}) {
  const router = useRouter();
  // Instants, not wall-clock strings: comparing timestamps is exact and keeps
  // working for a sitting that runs past midnight.
  const [now, setNow] = useState(() => initialNow ?? Date.now());

  useEffect(() => {
    // Take over from the server's clock right after mounting, then keep ticking.
    const catchUp = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearTimeout(catchUp);
      clearInterval(interval);
    };
  }, []);

  // Deactivated tables are kept out of service, so they are not drawn.
  const activeTables = useMemo(
    () => tables.filter((table) => table.active),
    [tables]
  );

  const fallbackMinutes = defaultDurationMinutes ?? FALLBACK_MINUTES;

  const states = useMemo<TableState[]>(() => {
    const live = bookings
      .filter((b) => b.status !== "cancelled" && b.status !== "no_show")
      .map((booking) => ({
        booking,
        window: occupancy(booking, timezone, fallbackMinutes),
      }))
      .sort((a, b) => a.window.start - b.window.start);

    return activeTables.map((table) => {
      const forTable = live.filter((entry) =>
        entry.booking.tables.some((t) => t.id === table.id)
      );

      const seated =
        forTable.find(
          (entry) => entry.window.start <= now && now < entry.window.end
        )?.booking ?? null;

      const upcoming = forTable
        .filter((entry) => entry.window.start > now)
        .map((entry) => entry.booking);

      return { table, seated, upcoming };
    });
  }, [activeTables, bookings, now, timezone, fallbackMinutes]);

  // ---------------------------------------------------------- arranging

  const saved = useMemo(() => layoutFrom(activeTables), [activeTables]);
  const savedKey = useMemo(
    () =>
      [...saved.entries()]
        .map(([id, position]) => `${id}:${position.x},${position.y}`)
        .sort()
        .join("|"),
    [saved]
  );

  const [arranging, setArranging] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The working copy is adjusted during render whenever the server sends a
  // different layout, except mid-drag, where resetting would yank the table out
  // from under the pointer.
  const [working, setWorking] = useState({ key: savedKey, positions: saved });
  if (working.key !== savedKey && !dragId) {
    setWorking({ key: savedKey, positions: saved });
  }
  const positions = working.positions;

  const setPositions = useCallback(
    (update: (current: Map<string, GridPosition>) => Map<string, GridPosition>) => {
      setWorking((current) => ({
        key: current.key,
        positions: update(current.positions),
      }));
    },
    []
  );

  const planeRef = useRef<HTMLDivElement>(null);
  const originRef = useRef<HTMLDivElement>(null);
  const stepXRef = useRef<HTMLDivElement>(null);
  const stepYRef = useRef<HTMLDivElement>(null);
  const basisRef = useRef<GridBasis | null>(null);
  const dragRef = useRef<{
    id: string;
    start: { x: number; y: number };
    from: GridPosition;
  } | null>(null);

  /**
   * The grid axes are measured from three probes rather than derived from the
   * CSS transform, so the drag maths stays correct if the projection or the
   * responsive scale ever changes.
   */
  const measureBasis = useCallback(() => {
    const origin = originRef.current?.getBoundingClientRect();
    const stepX = stepXRef.current?.getBoundingClientRect();
    const stepY = stepYRef.current?.getBoundingClientRect();
    if (!origin || !stepX || !stepY) return;

    const centre = (rect: DOMRect) => ({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    const o = centre(origin);
    const px = centre(stepX);
    const py = centre(stepY);

    basisRef.current = {
      ex: { x: px.x - o.x, y: px.y - o.y },
      ey: { x: py.x - o.x, y: py.y - o.y },
    };
  }, []);

  useEffect(() => {
    measureBasis();
    window.addEventListener("resize", measureBasis);
    return () => window.removeEventListener("resize", measureBasis);
  }, [measureBasis, arranging]);

  /**
   * Moves a table to a whole grid position. Two tables never stack: dropping
   * one onto another swaps them, which is what rearranging a room actually
   * feels like and avoids a dead end when the floor is full.
   */
  const moveTo = useCallback(
    (id: string, next: GridPosition) => {
      const target = { x: clampToGrid(next.x), y: clampToGrid(next.y) };
      setPositions((current) => {
        const from = current.get(id);
        if (!from) return current;
        if (from.x === target.x && from.y === target.y) return current;

        const holder = [...current.entries()].find(
          ([otherId, position]) =>
            otherId !== id && key(position) === key(target)
        );

        const updated = new Map(current);
        updated.set(id, target);
        if (holder) updated.set(holder[0], from);
        return updated;
      });
    },
    [setPositions]
  );

  const stopDragRef = useRef<(() => void) | null>(null);

  /**
   * Listeners are attached synchronously here rather than from an effect: an
   * effect runs after React commits, so a gesture whose move and release arrive
   * in the same task would be missed entirely.
   */
  function beginDrag(id: string, startX: number, startY: number) {
    const from = positions.get(id);
    if (!from) return;

    dragRef.current = { id, start: { x: startX, y: startY }, from };
    setDragId(id);

    const onMove = (event: PointerEvent | MouseEvent) => {
      const drag = dragRef.current;
      const basis = basisRef.current;
      if (!drag || !basis) return;

      const step = screenDeltaToGrid(
        basis,
        event.clientX - drag.start.x,
        event.clientY - drag.start.y
      );
      if (!step) return;

      moveTo(drag.id, { x: drag.from.x + step.x, y: drag.from.y + step.y });
    };

    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", stop);
      stopDragRef.current = null;
      dragRef.current = null;
      setDragId(null);
    };

    // Mouse events are handled too, because some embedded and automated
    // environments synthesize only those. The move is computed from the
    // absolute delta, so handling both streams is idempotent.
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stop);
    stopDragRef.current = stop;
  }

  function onPointerDown(
    event: React.PointerEvent | React.MouseEvent,
    id: string
  ) {
    if (!arranging) return;
    if (dragRef.current) return; // pointerdown and mousedown both fire
    event.preventDefault();
    event.stopPropagation();
    measureBasis();
    beginDrag(id, event.clientX, event.clientY);
  }

  // Never leave listeners behind if the map unmounts mid-drag.
  useEffect(() => () => stopDragRef.current?.(), []);

  function onKeyDown(event: React.KeyboardEvent, id: string) {
    if (!arranging) return;
    const deltas: Record<string, GridPosition> = {
      ArrowRight: { x: 1, y: 0 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowDown: { x: 0, y: 1 },
      ArrowUp: { x: 0, y: -1 },
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    const from = positions.get(id);
    if (!from) return;
    moveTo(id, { x: from.x + delta.x, y: from.y + delta.y });
  }

  const dirty = useMemo(() => {
    for (const [id, position] of positions) {
      const original = saved.get(id);
      if (!original || original.x !== position.x || original.y !== position.y) {
        return true;
      }
    }
    return false;
  }, [positions, saved]);

  async function save() {
    setSaving(true);
    setError(null);
    const payload = [...positions.entries()].map(([id, position]) => ({
      id,
      x: position.x,
      y: position.y,
    }));
    const result = await saveTableLayout(payload);
    setSaving(false);
    if (result.ok) {
      setArranging(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  function cancel() {
    setWorking({ key: savedKey, positions: saved });
    setArranging(false);
    setError(null);
  }

  if (activeTables.length === 0) {
    return (
      <EmptyState
        icon={<TableIcon size={18} />}
        title="No tables in service"
        body="Add tables under Tables and today's floor will appear here."
      />
    );
  }

  return (
    <div className="relative h-full overflow-hidden bg-sunken/60">
      {/* Isometric floor */}
      <div className="iso-stage flex h-full items-center justify-center">
        <div className="scale-[0.5] lg:scale-[0.62] xl:scale-[0.72] 2xl:scale-[0.82]">
          <div
            ref={planeRef}
            className="iso-plane relative"
            style={{ width: PLANE_SIZE, height: PLANE_SIZE }}
          >
            {/* Probes: one at the origin cell and one a single step along each
                grid axis, used to measure the on-screen axes. */}
            <div
              ref={originRef}
              aria-hidden
              className="pointer-events-none absolute size-px"
              style={cellCentre({ x: 0, y: 0 })}
            />
            <div
              ref={stepXRef}
              aria-hidden
              className="pointer-events-none absolute size-px"
              style={cellCentre({ x: 1, y: 0 })}
            />
            <div
              ref={stepYRef}
              aria-hidden
              className="pointer-events-none absolute size-px"
              style={cellCentre({ x: 0, y: 1 })}
            />

            {/* Cell hints while arranging, so the grid reads as positions */}
            {arranging &&
              Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
                const x = index % GRID_SIZE;
                const y = Math.floor(index / GRID_SIZE);
                return (
                  <div
                    key={index}
                    aria-hidden
                    className="pointer-events-none absolute rounded-md border border-dashed border-line-strong/70"
                    style={{
                      left: PLANE_PADDING + x * CELL + 6,
                      top: PLANE_PADDING + y * CELL + 6,
                      width: CELL - 12,
                      height: CELL - 12,
                    }}
                  />
                );
              })}

            {states.map(({ table, seated, upcoming }) => {
              const size = blockSize(table.capacity);
              const booking = seated ?? upcoming[0] ?? null;
              const selected =
                booking !== null && booking !== undefined && booking.id === selectedId;
              const position = positions.get(table.id) ?? { x: 0, y: 0 };
              const centre = cellCentre(position);
              const dragging = dragId === table.id;

              return (
                <div
                  key={table.id}
                  className="absolute [transform-style:preserve-3d]"
                  style={{
                    left: centre.left,
                    top: centre.top,
                    width: 0,
                    height: 0,
                    zIndex: dragging ? 30 : undefined,
                  }}
                >
                  <button
                    type="button"
                    disabled={!arranging && !booking}
                    onClick={() => {
                      if (!arranging && booking) onSelect(booking);
                    }}
                    onPointerDown={(event) => onPointerDown(event, table.id)}
                    onMouseDown={(event) => onPointerDown(event, table.id)}
                    onKeyDown={(event) => onKeyDown(event, table.id)}
                    data-clickable={!arranging && Boolean(booking)}
                    data-selected={selected}
                    data-state={seated ? "occupied" : upcoming.length > 0 ? "booked" : "free"}
                    className={`iso-block ${arranging ? "cursor-grab active:cursor-grabbing" : ""} ${
                      dragging ? "opacity-90" : ""
                    }`}
                    style={
                      {
                        width: size,
                        height: size,
                        marginLeft: -size / 2,
                        marginTop: -size / 2,
                        "--h": "16px",
                        touchAction: arranging ? "none" : undefined,
                      } as React.CSSProperties
                    }
                    aria-label={
                      arranging
                        ? `Table ${table.name}, position ${position.x + 1}, ${position.y + 1}. Use the arrow keys to move it.`
                        : booking
                          ? `Table ${table.name}: ${booking.name}, ${booking.partySize} guests at ${booking.time}`
                          : `Table ${table.name}, free`
                    }
                  >
                    {chairSpots(size, table.capacity).map((spot, i) => (
                      <span
                        key={i}
                        className="iso3 iso-chair"
                        style={
                          {
                            left: spot.x,
                            top: spot.y,
                            width: CHAIR,
                            height: CHAIR,
                            "--h": "7px",
                          } as React.CSSProperties
                        }
                      >
                        <span className="f-s" />
                        <span className="f-e" />
                        <span className="f-top" />
                      </span>
                    ))}

                    {/* Table body */}
                    <span className="iso3" style={{ inset: 0 }}>
                      <span className="f-ground" />
                      <span className="f-s" />
                      <span className="f-e" />
                      <span className="f-top">
                        {/* Label lies flat on the top face, like the reference map */}
                        <span className="absolute bottom-1 left-2 text-[11px] font-medium text-muted">
                          {table.name}
                        </span>
                      </span>
                    </span>

                    {/* Who is sitting there now, and what is still to come.
                        Both are shown: the count answers "is this table busy",
                        the times answer "when do I need it back". */}
                    {!arranging && (seated || upcoming.length > 0) && (
                      <span className="iso-badge flex flex-col items-center gap-1">
                        {seated && (
                          <span
                            className="flex size-7 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-surface shadow-float"
                            title={`${seated.name} · ${seated.partySize} guests, seated`}
                          >
                            {seated.partySize}
                          </span>
                        )}
                        {upcoming.length > 0 && (
                          <span className="flex items-center gap-0.5">
                            {upcoming.slice(0, MAX_UPCOMING).map((booking) => (
                              <span
                                key={booking.id}
                                title={`${booking.time} · ${booking.name} · ${booking.partySize} guests`}
                                className="rounded-full border border-line-strong bg-surface px-1.5 py-0.5 text-[10px] font-semibold tabular-nums shadow-card"
                              >
                                {booking.time}
                              </span>
                            ))}
                            {upcoming.length > MAX_UPCOMING && (
                              <span
                                title={`${upcoming.length - MAX_UPCOMING} more today`}
                                className="rounded-full border border-line-strong bg-sunken px-1.5 py-0.5 text-[10px] font-semibold text-muted shadow-card"
                              >
                                +{upcoming.length - MAX_UPCOMING}
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend, or the arranging controls in its place */}
      {arranging ? (
        <div className="absolute inset-x-4 bottom-4 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 shadow-float">
          <p className="text-[11px] leading-4 text-muted">
            Drag a table, or select one and use the arrow keys. Tables move one
            position at a time along the floor.
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-medium hover:bg-sunken disabled:opacity-40"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1 text-[11px] font-medium text-surface hover:opacity-85 disabled:opacity-40"
            >
              {saving && <Spinner size={11} />}
              Save layout
            </button>
          </div>
          {error && (
            <p className="w-full rounded-md bg-danger-soft px-2 py-1 text-[11px] leading-4 text-danger">
              {error}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-1.5 text-[11px] font-medium shadow-card">
            <span className="mr-1.5 inline-block size-1.5 rounded-full bg-danger align-middle" />
            Main floor
          </div>

          {arrangeable && (
            <button
              type="button"
              onClick={() => setArranging(true)}
              className="absolute bottom-4 right-4 z-10 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium shadow-card hover:border-line-strong"
            >
              Arrange tables
            </button>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The floor plan is a square grid laid out in the isometric plane's own
 * coordinates. Tables are placed with plain left/top inside that plane, so the
 * CSS transform does the projection for us and no maths is needed to render.
 *
 * Dragging is the other direction — a screen delta has to become a grid delta —
 * and for that the two grid axes are measured from the live DOM rather than
 * derived from the transform, so the maths cannot drift out of sync with the
 * stylesheet or the responsive scale.
 */

/** Positions per side. The plane fits GRID_SIZE × GRID_SIZE tables. */
export const GRID_SIZE = 6;

/**
 * Distance between two neighbouring positions, in plane pixels. Kept above the
 * widest table block (110px) so neighbours never overlap body to body; chairs
 * of adjacent tables may touch, which is what a real dining room looks like.
 */
export const CELL = 120;

/** Plane padding so edge tables do not sit on the border. */
export const PLANE_PADDING = 24;

export const PLANE_SIZE = PLANE_PADDING * 2 + GRID_SIZE * CELL;

export interface GridPosition {
  x: number;
  y: number;
}

export function clampToGrid(value: number): number {
  return Math.max(0, Math.min(GRID_SIZE - 1, Math.round(value)));
}

/** Centre of a grid cell, in the plane's own coordinate space. */
export function cellCentre({ x, y }: GridPosition): { left: number; top: number } {
  return {
    left: PLANE_PADDING + x * CELL + CELL / 2,
    top: PLANE_PADDING + y * CELL + CELL / 2,
  };
}

/**
 * Where a table sits when nobody has arranged the floor yet: four per row,
 * which reproduces the layout the map has always had.
 */
export function defaultPosition(index: number): GridPosition {
  const perRow = 4;
  // Offset so an unarranged floor sits centred on the plane rather than
  // hugging one corner.
  return {
    x: clampToGrid(1 + (index % perRow)),
    y: clampToGrid(1 + Math.floor(index / perRow)),
  };
}

/** The on-screen vector of one step along each grid axis. */
export interface GridBasis {
  ex: { x: number; y: number };
  ey: { x: number; y: number };
}

/**
 * Converts a drag in screen pixels into whole grid steps, by solving the 2×2
 * system built from the measured axes. Returns null when the basis is
 * degenerate (element not laid out yet).
 */
export function screenDeltaToGrid(
  basis: GridBasis,
  screenDx: number,
  screenDy: number
): GridPosition | null {
  const { ex, ey } = basis;
  const det = ex.x * ey.y - ey.x * ex.y;
  if (!Number.isFinite(det) || Math.abs(det) < 0.0001) return null;

  const x = (screenDx * ey.y - ey.x * screenDy) / det;
  const y = (ex.x * screenDy - screenDx * ex.y) / det;

  return { x: Math.round(x), y: Math.round(y) };
}

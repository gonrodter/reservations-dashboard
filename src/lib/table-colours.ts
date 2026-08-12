/**
 * One colour per table, used as the table's identity across the whole app: the
 * block on the floor plan, the pills on every reservation, the bar down the
 * side of a list row, the block on the calendar. Staff learn "mesa 4 is the
 * amber one" once and read it everywhere.
 *
 * Blue is deliberately absent: it means "selected" throughout the dashboard,
 * and the status chips own green, amber and red as *states*, so a table's
 * colour is always paired with its name to keep the two readings apart.
 */

export interface TableColour {
  /** Very light wash, for a block or pill background. */
  fill: string;
  /** Mid tone, for borders and the filled state of a table in use. */
  line: string;
  /** Readable text on `fill`. */
  ink: string;
}

const PALETTE: TableColour[] = [
  { fill: "#e2f3f1", line: "#b9e0db", ink: "#0f7d74" }, // teal
  { fill: "#eaf4e4", line: "#c8e3bd", ink: "#43852f" }, // green
  { fill: "#f3f3de", line: "#dedeb4", ink: "#77770f" }, // olive
  { fill: "#fbf1de", line: "#ecd7a8", ink: "#a4700d" }, // amber
  { fill: "#fbeee5", line: "#f0d2ba", ink: "#b35a2b" }, // orange
  { fill: "#fcecea", line: "#f3c9c5", ink: "#c0453c" }, // clay
  { fill: "#fceaef", line: "#f3c4d3", ink: "#c03a63" }, // rose
  { fill: "#f9e9f7", line: "#ecc4e8", ink: "#a5399f" }, // magenta
  { fill: "#f0eafc", line: "#d8c8f5", ink: "#7a4bd0" }, // purple
  { fill: "#f4efe9", line: "#ded0c1", ink: "#7b6350" }, // clay brown
];

/** Neutral stand-in for a reservation with no table assigned yet. */
export const UNASSIGNED_COLOUR: TableColour = {
  fill: "#f4f4f6",
  line: "#d5d6da",
  ink: "#8a8d93",
};

/**
 * Same table, same colour, for as long as the table exists: the hue comes from
 * the table's id rather than its position in a list, so adding or retiring a
 * table never repaints the room.
 */
export function tableColour(tableId: string): TableColour {
  let hash = 0;
  for (let i = 0; i < tableId.length; i++) {
    hash = (hash * 31 + tableId.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

/** Colour a reservation is filed under: the first table it holds. */
export function bookingColour(tables: { id: string }[]): TableColour | null {
  return tables.length > 0 ? tableColour(tables[0].id) : null;
}

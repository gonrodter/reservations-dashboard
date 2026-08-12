import { tableColour } from "@/lib/table-colours";

/**
 * A table's name in the table's own colour. Used wherever a reservation shows
 * what it is sitting at, so a glance ties the row back to the floor plan.
 */
export function TablePill({
  table,
  withCapacity = false,
}: {
  table: { id: string; name: string; capacity?: number | null };
  withCapacity?: boolean;
}) {
  const colour = tableColour(table.id);

  return (
    <span
      className="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4"
      style={{
        backgroundColor: colour.fill,
        borderColor: colour.line,
        color: colour.ink,
      }}
    >
      {table.name}
      {withCapacity && table.capacity ? ` · ${table.capacity}` : ""}
    </span>
  );
}

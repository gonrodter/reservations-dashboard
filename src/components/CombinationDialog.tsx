"use client";

import { useMemo, useState } from "react";
import type { RestaurantTable, TableCombination } from "@/lib/types";
import { saveCombination, type CombinationInput } from "@/lib/config-actions";
import type { ActionResult } from "@/lib/errors";
import { Button, ErrorNote, Field, Input, Modal, Toggle } from "@/components/ui";
import { CheckIcon } from "@/components/icons";

/**
 * Combinations are always explicit: staff pick exactly which physical tables
 * may be pushed together. Nothing is inferred automatically.
 */
export function CombinationDialog({
  combination,
  tables,
  onClose,
  onSaved,
  save = saveCombination,
}: {
  combination?: TableCombination;
  tables: RestaurantTable[];
  onClose: () => void;
  onSaved: () => void;
  /** Overridden by the admin area to write to a restaurant it names by id. */
  save?: (input: CombinationInput) => Promise<ActionResult>;
}) {
  const [name, setName] = useState(combination?.name ?? "");
  const [memberIds, setMemberIds] = useState<string[]>(combination?.memberIds ?? []);
  const [active, setActive] = useState(combination?.active ?? true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seatsOfMembers = useMemo(
    () =>
      tables
        .filter((table) => memberIds.includes(table.id))
        .reduce((sum, table) => sum + (table.capacity ?? 0), 0),
    [tables, memberIds]
  );

  // Seats default to the sum of the joined tables, but stay editable: pushing
  // tables together often loses or gains a cover.
  const [capacity, setCapacity] = useState(
    combination?.capacity != null ? String(combination.capacity) : ""
  );
  const effectiveCapacity = capacity === "" ? String(seatsOfMembers) : capacity;

  function toggleMember(tableId: string) {
    setMemberIds((current) =>
      current.includes(tableId)
        ? current.filter((id) => id !== tableId)
        : [...current, tableId]
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await save({
      id: combination?.id,
      name,
      capacity: Number(effectiveCapacity),
      active,
      memberIds,
    });

    setPending(false);
    if (result.ok) onSaved();
    else setError(result.error);
  }

  const grouped = useMemo(() => {
    const map = new Map<string, RestaurantTable[]>();
    for (const table of tables) {
      const key = table.zone ?? "Unassigned";
      const list = map.get(key) ?? [];
      list.push(table);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tables]);

  return (
    <Modal
      title={combination ? "Edit combination" : "New combination"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="contents">
        <div className="thin-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" required>
              <Input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Tables 1 + 2"
              />
            </Field>
            <Field
              label="Seats together"
              required
              hint={
                memberIds.length > 0 ? `Tables add up to ${seatsOfMembers}.` : undefined
              }
            >
              <Input
                required
                type="number"
                min={1}
                max={200}
                value={effectiveCapacity}
                onChange={(event) => setCapacity(event.target.value)}
              />
            </Field>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-ink-soft">
              Tables to join <span className="text-danger">*</span>
            </p>
            <p className="mb-2 text-[11px] leading-4 text-muted">
              Pick at least two. Only these tables will ever be joined for a
              large party.
            </p>

            {tables.length === 0 ? (
              <p className="rounded-lg bg-sunken px-3 py-2.5 text-xs text-muted">
                Add tables first, then you can define which ones may be joined.
              </p>
            ) : (
              <div className="space-y-3">
                {grouped.map(([zone, zoneTables]) => (
                  <div key={zone}>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">
                      {zone}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {zoneTables.map((table) => {
                        const picked = memberIds.includes(table.id);
                        return (
                          <button
                            key={table.id}
                            type="button"
                            onClick={() => toggleMember(table.id)}
                            aria-pressed={picked}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
                              picked
                                ? "border-ink bg-ink text-surface"
                                : "border-line bg-surface hover:border-line-strong"
                            } ${table.active ? "" : "opacity-60"}`}
                          >
                            {picked && <CheckIcon size={11} />}
                            {table.name}
                            <span
                              className={picked ? "text-surface/70" : "text-muted"}
                            >
                              {table.capacity ?? "?"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg bg-sunken px-3 py-2.5">
            <Toggle
              checked={active}
              onChange={setActive}
              label={active ? "Available for bookings" : "Not in use"}
            />
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}
        </div>

        <footer className="flex gap-2 border-t border-line p-3">
          <Button type="button" onClick={onClose} className="flex-1 py-2">
            Discard
          </Button>
          <Button
            type="submit"
            variant="primary"
            pending={pending}
            disabled={memberIds.length < 2}
            className="flex-1 py-2"
          >
            {combination ? "Save combination" : "Add combination"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

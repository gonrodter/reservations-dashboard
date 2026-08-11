"use client";

import { useState } from "react";
import type { RestaurantTable } from "@/lib/types";
import { saveTable, type TableInput } from "@/lib/config-actions";
import type { ActionResult } from "@/lib/errors";
import {
  Button,
  ErrorNote,
  Field,
  Input,
  Modal,
  Toggle,
} from "@/components/ui";

export function TableDialog({
  table,
  zones,
  onClose,
  onSaved,
  save = saveTable,
}: {
  table?: RestaurantTable;
  zones: string[];
  onClose: () => void;
  onSaved: () => void;
  /** Overridden by the admin area to write to a restaurant it names by id. */
  save?: (input: TableInput) => Promise<ActionResult>;
}) {
  const [name, setName] = useState(table?.name ?? "");
  const [capacity, setCapacity] = useState(String(table?.capacity ?? 4));
  const [zone, setZone] = useState(table?.zone ?? "");
  const [active, setActive] = useState(table?.active ?? true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await save({
      id: table?.id,
      name,
      capacity: Number(capacity),
      zone,
      active,
    });

    setPending(false);
    if (result.ok) onSaved();
    else setError(result.error);
  }

  return (
    <Modal title={table ? "Edit table" : "New table"} onClose={onClose}>
      <form id="table-form" onSubmit={handleSubmit} className="contents">
        <div className="thin-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Table name" required>
              <Input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. 12 or Window 2"
              />
            </Field>
            <Field label="Seats" required hint="How many guests fit comfortably.">
              <Input
                required
                type="number"
                min={1}
                max={50}
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Area"
            hint="Optional. Group tables by where they are, such as Terrace or Main room."
          >
            <Input
              list="zone-options"
              value={zone}
              onChange={(event) => setZone(event.target.value)}
              placeholder="e.g. Terrace"
            />
            <datalist id="zone-options">
              {zones.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </Field>

          <div className="rounded-lg bg-sunken px-3 py-2.5">
            <Toggle
              checked={active}
              onChange={setActive}
              label={active ? "Available for bookings" : "Out of service"}
            />
            <p className="mt-1 text-[11px] leading-4 text-muted">
              Tables out of service keep their past reservations but are not
              offered for new ones.
            </p>
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}
        </div>

        <footer className="flex gap-2 border-t border-line p-3">
          <Button type="button" onClick={onClose} className="flex-1 py-2">
            Discard
          </Button>
          <Button type="submit" variant="primary" pending={pending} className="flex-1 py-2">
            {table ? "Save table" : "Add table"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

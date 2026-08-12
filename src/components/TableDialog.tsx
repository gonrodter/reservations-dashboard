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
    <Modal title={table ? "Editar mesa" : "Nueva mesa"} onClose={onClose}>
      <form id="table-form" onSubmit={handleSubmit} className="contents">
        <div className="thin-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre de la mesa" required>
              <Input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="p. ej., 12 o Ventana 2"
              />
            </Field>
            <Field label="Plazas" required hint="Cuántos comensales caben cómodamente.">
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
            label="Zona"
            hint="Opcional. Agrupa las mesas por su ubicación, como Terraza o Sala principal."
          >
            <Input
              list="zone-options"
              value={zone}
              onChange={(event) => setZone(event.target.value)}
              placeholder="p. ej., Terraza"
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
              label={active ? "Disponible para reservas" : "Fuera de servicio"}
            />
            <p className="mt-1 text-[11px] leading-4 text-muted">
              Las mesas fuera de servicio conservan sus reservas anteriores,
              pero no se ofrecen para reservas nuevas.
            </p>
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}
        </div>

        <footer className="flex gap-2 border-t border-line p-3">
          <Button type="button" onClick={onClose} className="flex-1 py-2">
            Descartar
          </Button>
          <Button type="submit" variant="primary" pending={pending} className="flex-1 py-2">
            {table ? "Guardar mesa" : "Añadir mesa"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}

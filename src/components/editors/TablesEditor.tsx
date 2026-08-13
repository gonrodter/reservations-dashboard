"use client";

import { useMemo, useState } from "react";
import type { RestaurantTable } from "@/lib/types";
import type { TableInput } from "@/lib/config-actions";
import type { ActionResult } from "@/lib/errors";
import { TableDialog } from "@/components/TableDialog";
import { EmptyState } from "@/components/EmptyState";
import { Button, Card, ConfirmDialog, ErrorNote } from "@/components/ui";
import { tableColour } from "@/lib/table-colours";
import { GridIcon, PencilIcon, PlusIcon, Spinner, TrashIcon } from "@/components/icons";

export interface TablesActions {
  save: (input: TableInput) => Promise<ActionResult>;
  setActive: (tableId: string, active: boolean) => Promise<ActionResult>;
  /** Only offered where a table can still be safely discarded. */
  remove?: (tableId: string) => Promise<ActionResult>;
}

export function StateChip({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 ${
        active ? "bg-ok-soft text-ok" : "bg-sunken text-muted"
      }`}
    >
      <span className="size-1 rounded-full bg-current" aria-hidden />
      {active ? "En servicio" : "Fuera de servicio"}
    </span>
  );
}

/**
 * The physical tables editor, shared by the restaurant's Tables page and by
 * step 4 of admin onboarding.
 */
export function TablesEditor({
  tables,
  actions,
  onChanged,
}: {
  tables: RestaurantTable[];
  actions: TablesActions;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ table?: RestaurantTable } | null>(null);
  const [removing, setRemoving] = useState<RestaurantTable | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const zones = useMemo(
    () => [...new Set(tables.map((table) => table.zone).filter(Boolean))] as string[],
    [tables]
  );

  const byZone = useMemo(() => {
    const map = new Map<string, RestaurantTable[]>();
    for (const table of tables) {
      const key = table.zone ?? "Sin asignar";
      const list = map.get(key) ?? [];
      list.push(table);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tables]);

  async function toggle(table: RestaurantTable) {
    setBusyId(table.id);
    setError(null);
    const result = await actions.setActive(table.id, !table.active);
    setBusyId(null);
    if (result.ok) onChanged();
    else setError(result.error);
  }

  async function confirmRemove() {
    if (!removing || !actions.remove) return;
    setBusyId(removing.id);
    setRemoveError(null);
    const result = await actions.remove(removing.id);
    setBusyId(null);
    if (result.ok) {
      setRemoving(null);
      onChanged();
    } else {
      setRemoveError(result.error);
    }
  }

  return (
    <>
      {error && <div className="mb-3">{<ErrorNote>{error}</ErrorNote>}</div>}

      {tables.length === 0 ? (
        <EmptyState
          icon={<GridIcon size={18} />}
          title="Todavía no hay mesas"
          body="Añade las mesas de la sala para poder asignarlas a las reservas."
          action={
            <Button
              variant="primary"
              icon={<PlusIcon size={13} />}
              onClick={() => setDialog({})}
            >
              Añadir la primera mesa
            </Button>
          }
        />
      ) : (
        byZone.map(([zone, zoneTables]) => (
          <section key={zone} className="mt-4 first:mt-0">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {zone}
            </h3>
            <Card className="overflow-hidden">
              {zoneTables.map((table, index) => (
                <div
                  key={table.id}
                  className={`flex items-center gap-3 px-3 py-2.5 ${
                    index > 0 ? "border-t border-line" : ""
                  } ${table.active ? "" : "bg-sunken/40"}`}
                >
                  {/* The colour this table wears on the floor plan and on
                      every reservation assigned to it. */}
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full border"
                    style={{
                      backgroundColor: tableColour(table.id, table.colour).fill,
                      borderColor: tableColour(table.id, table.colour).ink,
                    }}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">
                      {table.name}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {table.capacity ?? "?"} plazas
                    </span>
                  </span>

                  <StateChip active={table.active} />

                  <button
                    type="button"
                    onClick={() => toggle(table)}
                    disabled={busyId === table.id}
                    className="rounded-lg border border-line px-2 py-1 text-[11px] font-medium hover:bg-sunken disabled:opacity-40"
                  >
                    {busyId === table.id ? (
                      <Spinner size={11} />
                    ) : table.active ? (
                      "Retirar"
                    ) : (
                      "Reactivar"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDialog({ table })}
                    aria-label={`Editar ${table.name}`}
                    className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
                  >
                    <PencilIcon size={14} />
                  </button>

                  {actions.remove && (
                    <button
                      type="button"
                      onClick={() => {
                        setRemoveError(null);
                        setRemoving(table);
                      }}
                      aria-label={`Eliminar ${table.name}`}
                      className="flex size-8 items-center justify-center rounded-lg text-danger hover:bg-danger-soft"
                    >
                      <TrashIcon size={14} />
                    </button>
                  )}
                </div>
              ))}
            </Card>
          </section>
        ))
      )}

      {dialog && (
        <TableDialog
          table={dialog.table}
          zones={zones}
          save={actions.save}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            onChanged();
          }}
        />
      )}

      {removing && (
        <ConfirmDialog
          title="¿Eliminar esta mesa?"
          body={`${removing.name} se eliminará por completo. Si ha tenido alguna reserva, retírala del servicio en su lugar.`}
          confirmLabel="Eliminar"
          destructive
          pending={busyId === removing.id}
          error={removeError}
          onConfirm={confirmRemove}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  );
}

/** Lets callers render their own "Add table" button that opens this editor. */
export function AddTableButton({
  zones,
  save,
  onSaved,
  label = "Añadir mesa",
}: {
  zones: string[];
  save: (input: TableInput) => Promise<ActionResult>;
  onSaved: () => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="primary"
        icon={<PlusIcon size={13} />}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      {open && (
        <TableDialog
          zones={zones}
          save={save}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onSaved();
          }}
        />
      )}
    </>
  );
}

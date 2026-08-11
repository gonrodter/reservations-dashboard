"use client";

import { useMemo, useState } from "react";
import type { RestaurantTable, TableCombination } from "@/lib/types";
import type { CombinationInput } from "@/lib/config-actions";
import type { ActionResult } from "@/lib/errors";
import { CombinationDialog } from "@/components/CombinationDialog";
import { EmptyState } from "@/components/EmptyState";
import { Button, Card, ConfirmDialog, ErrorNote } from "@/components/ui";
import { StateChip } from "@/components/editors/TablesEditor";
import { LayersIcon, PencilIcon, PlusIcon, Spinner, TrashIcon } from "@/components/icons";

export interface CombinationsActions {
  save: (input: CombinationInput) => Promise<ActionResult>;
  setActive: (combinationId: string, active: boolean) => Promise<ActionResult>;
  remove?: (combinationId: string) => Promise<ActionResult>;
}

/**
 * The explicit table-combination editor, shared by the restaurant's Tables page
 * and by step 5 of admin onboarding. Combinations are never inferred: the
 * restaurant names exactly which tables may be joined.
 */
export function CombinationsEditor({
  combinations,
  tables,
  actions,
  onChanged,
}: {
  combinations: TableCombination[];
  tables: RestaurantTable[];
  actions: CombinationsActions;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ combination?: TableCombination } | null>(null);
  const [removing, setRemoving] = useState<TableCombination | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const tableById = useMemo(
    () => new Map(tables.map((table) => [table.id, table])),
    [tables]
  );

  async function toggle(combination: TableCombination) {
    setBusyId(combination.id);
    setError(null);
    const result = await actions.setActive(combination.id, !combination.active);
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

      {combinations.length === 0 ? (
        <EmptyState
          icon={<LayersIcon size={18} />}
          title="No combinations yet"
          body="Define which tables may be pushed together for larger parties. Nothing is joined unless you say so."
          action={
            <Button
              variant="primary"
              icon={<PlusIcon size={13} />}
              onClick={() => setDialog({})}
              disabled={tables.length < 2}
            >
              Add a combination
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          {combinations.map((combination, index) => (
            <div
              key={combination.id}
              className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${
                index > 0 ? "border-t border-line" : ""
              } ${combination.active ? "" : "bg-sunken/40"}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">
                  {combination.name}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1">
                  <span className="text-[11px] text-muted">
                    {combination.capacity ?? "?"} seats together ·
                  </span>
                  {combination.memberIds.map((id) => (
                    <span
                      key={id}
                      className="rounded-md border border-line bg-sunken px-1.5 py-0.5 text-[11px] font-medium text-ink-soft"
                    >
                      {tableById.get(id)?.name ?? "Removed table"}
                    </span>
                  ))}
                </span>
              </span>

              <StateChip active={combination.active} />

              <button
                type="button"
                onClick={() => toggle(combination)}
                disabled={busyId === combination.id}
                className="rounded-lg border border-line px-2 py-1 text-[11px] font-medium hover:bg-sunken disabled:opacity-40"
              >
                {busyId === combination.id ? (
                  <Spinner size={11} />
                ) : combination.active ? (
                  "Take out"
                ) : (
                  "Put back"
                )}
              </button>

              <button
                type="button"
                onClick={() => setDialog({ combination })}
                aria-label={`Edit ${combination.name}`}
                className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
              >
                <PencilIcon size={14} />
              </button>

              {actions.remove && (
                <button
                  type="button"
                  onClick={() => {
                    setRemoveError(null);
                    setRemoving(combination);
                  }}
                  aria-label={`Delete ${combination.name}`}
                  className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"
                >
                  <TrashIcon size={14} />
                </button>
              )}
            </div>
          ))}
        </Card>
      )}

      {dialog && (
        <CombinationDialog
          combination={dialog.combination}
          tables={tables}
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
          title="Delete this combination?"
          body={`${removing.name} will no longer be offered for large parties. The physical tables are not affected.`}
          confirmLabel="Delete"
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

/** Lets callers place their own "Add combination" button. */
export function AddCombinationButton({
  tables,
  save,
  onSaved,
  label = "Add combination",
}: {
  tables: RestaurantTable[];
  save: (input: CombinationInput) => Promise<ActionResult>;
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
        disabled={tables.length < 2}
      >
        {label}
      </Button>
      {open && (
        <CombinationDialog
          tables={tables}
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

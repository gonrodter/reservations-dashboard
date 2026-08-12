"use client";

import { useState } from "react";
import type { ActionResult } from "@/lib/errors";
import { Button, Card, ErrorNote, Toggle } from "@/components/ui";
import { CheckIcon } from "@/components/icons";

export function TableCapacityPolicy({
  enabled,
  save,
  onSaved,
}: {
  enabled: boolean;
  save: (enabled: boolean) => Promise<ActionResult>;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(enabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await save(value);
    setPending(false);

    if (result.ok) {
      setSaved(true);
      onSaved();
    } else {
      setError(result.error);
    }
  }

  return (
    <Card className="mb-5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Table assignment rule
          </h3>
          <div className="mt-2">
            <Toggle
              checked={value}
              onChange={(next) => {
                setValue(next);
                setSaved(false);
              }}
              label="Match parties closely to table capacity"
            />
          </div>
          <p className="mt-1 pl-10 text-[11px] leading-4 text-muted">
            When on, a party can only use a table with its exact number of seats
            or one spare seat. If all eligible tables are occupied, that time is
            not offered even when a larger table is free.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          pending={pending}
          disabled={value === enabled}
          onClick={handleSave}
        >
          Save rule
        </Button>
      </div>
      {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
      {saved && !pending && (
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-ok">
          <CheckIcon size={13} /> Saved
        </span>
      )}
    </Card>
  );
}

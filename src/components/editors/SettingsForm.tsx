"use client";

import { useState } from "react";
import type { RestaurantSettings } from "@/lib/types";
import type { SettingsInput } from "@/lib/config-actions";
import type { ActionResult } from "@/lib/errors";
import { Button, Card, ErrorNote, Field, Input } from "@/components/ui";
import { CheckIcon } from "@/components/icons";

// Every setting is described in the words restaurant staff already use; the
// database column each one maps to stays out of the interface.
const SUGGESTED = {
  slotIntervalMinutes: 15,
  defaultBookingDurationMinutes: 90,
  maxOnlinePartySize: 8,
  minAdvanceMinutes: 60,
  maxAdvanceDays: 90,
};

function timezoneOptions(current: string): string[] {
  const supported =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [];
  const list = supported.length > 0 ? supported : [current, "UTC"];
  return [...new Set([current, ...list].filter(Boolean))];
}

/**
 * The restaurant_settings form, shared by the restaurant's Settings page and by
 * step 2 of admin onboarding.
 *
 * `prefill` decides what happens when there is no settings row yet. The
 * restaurant's own page fills in the usual values so the form is never blank.
 * Onboarding leaves them empty with the suggestion as a placeholder, so a
 * superadmin has to look at each number and accept it rather than inheriting
 * invented production values.
 */
export function SettingsForm({
  settings,
  fallbackName,
  fallbackTimezone,
  showName = true,
  prefill = true,
  submitLabel = "Save settings",
  save,
  onSaved,
}: {
  settings: RestaurantSettings | null;
  fallbackName: string;
  fallbackTimezone: string;
  showName?: boolean;
  prefill?: boolean;
  submitLabel?: string;
  save: (input: SettingsInput) => Promise<ActionResult>;
  onSaved?: () => void;
}) {
  const initial = (value: number | null | undefined, suggested: number) =>
    value != null ? String(value) : prefill ? String(suggested) : "";

  const [restaurantName, setRestaurantName] = useState(
    settings?.restaurantName ?? fallbackName
  );
  const [timezone, setTimezone] = useState(
    settings?.timezone ?? (prefill ? fallbackTimezone : "")
  );
  const [slotInterval, setSlotInterval] = useState(
    initial(settings?.slotIntervalMinutes, SUGGESTED.slotIntervalMinutes)
  );
  const [duration, setDuration] = useState(
    initial(
      settings?.defaultBookingDurationMinutes,
      SUGGESTED.defaultBookingDurationMinutes
    )
  );
  const [maxParty, setMaxParty] = useState(
    initial(settings?.maxOnlinePartySize, SUGGESTED.maxOnlinePartySize)
  );
  const [minNotice, setMinNotice] = useState(
    initial(settings?.minAdvanceMinutes, SUGGESTED.minAdvanceMinutes)
  );
  const [maxAdvance, setMaxAdvance] = useState(
    initial(settings?.maxAdvanceDays, SUGGESTED.maxAdvanceDays)
  );

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const result = await save({
      restaurantName,
      timezone,
      slotIntervalMinutes: Number(slotInterval),
      defaultBookingDurationMinutes: Number(duration),
      maxOnlinePartySize: Number(maxParty),
      minAdvanceMinutes: Number(minNotice),
      maxAdvanceDays: Number(maxAdvance),
    });

    setPending(false);
    if (result.ok) {
      setSaved(true);
      onSaved?.();
    } else {
      setError(result.error);
    }
  }

  const noticeHours = Number(minNotice) / 60;
  const noticeHint =
    minNotice === "" || !Number.isFinite(noticeHours)
      ? "How soon before a sitting a guest may still book."
      : noticeHours === 0
        ? "Guests can book right up to the sitting."
        : noticeHours < 1
          ? `About ${Math.round(noticeHours * 60)} minutes ahead.`
          : `About ${noticeHours % 1 === 0 ? noticeHours : noticeHours.toFixed(1)} ${
              noticeHours === 1 ? "hour" : "hours"
            } ahead.`;

  return (
    <form onSubmit={handleSubmit}>
      <Card className="divide-y divide-line">
        <div className="space-y-4 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {showName ? "The restaurant" : "Where the restaurant is"}
          </h3>
          {showName && (
            <Field label="Restaurant name" required>
              <Input
                required
                value={restaurantName}
                onChange={(event) => setRestaurantName(event.target.value)}
              />
            </Field>
          )}
          <Field
            label="Timezone"
            required
            hint="All reservation times are shown and booked in this timezone."
          >
            <Input
              required
              list="timezone-options"
              placeholder={fallbackTimezone}
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            />
            <datalist id="timezone-options">
              {timezoneOptions(fallbackTimezone).map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
          </Field>
        </div>

        <div className="space-y-4 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Booking slots
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Time between available slots (minutes)"
              required
              hint={
                slotInterval
                  ? `Guests see a time every ${slotInterval} minutes.`
                  : `Commonly ${SUGGESTED.slotIntervalMinutes} minutes.`
              }
            >
              <Input
                required
                type="number"
                min={5}
                max={240}
                step={5}
                placeholder={String(SUGGESTED.slotIntervalMinutes)}
                value={slotInterval}
                onChange={(event) => setSlotInterval(event.target.value)}
              />
            </Field>
            <Field
              label="Default reservation duration (minutes)"
              required
              hint={
                duration
                  ? "How long a table is held for one sitting."
                  : `Commonly ${SUGGESTED.defaultBookingDurationMinutes} minutes.`
              }
            >
              <Input
                required
                type="number"
                min={15}
                max={600}
                step={15}
                placeholder={String(SUGGESTED.defaultBookingDurationMinutes)}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            What guests can book online
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Maximum online party size"
              required
              hint="Bigger groups have to call the restaurant."
            >
              <Input
                required
                type="number"
                min={1}
                max={100}
                placeholder={String(SUGGESTED.maxOnlinePartySize)}
                value={maxParty}
                onChange={(event) => setMaxParty(event.target.value)}
              />
            </Field>
            <Field
              label="Minimum booking notice (minutes)"
              required
              hint={noticeHint}
            >
              <Input
                required
                type="number"
                min={0}
                max={10080}
                step={15}
                placeholder={String(SUGGESTED.minAdvanceMinutes)}
                value={minNotice}
                onChange={(event) => setMinNotice(event.target.value)}
              />
            </Field>
          </div>
          <Field
            label="How far in advance customers can book (days)"
            required
            hint="Bookings further out than this are not offered."
          >
            <Input
              required
              type="number"
              min={1}
              max={730}
              placeholder={String(SUGGESTED.maxAdvanceDays)}
              value={maxAdvance}
              onChange={(event) => setMaxAdvance(event.target.value)}
              className="sm:max-w-40"
            />
          </Field>
        </div>
      </Card>

      {error && <div className="mt-3">{<ErrorNote>{error}</ErrorNote>}</div>}

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" variant="primary" pending={pending}>
          {submitLabel}
        </Button>
        {saved && !pending && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ok">
            <CheckIcon size={13} /> Saved
          </span>
        )}
      </div>
    </form>
  );
}

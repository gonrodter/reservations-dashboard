"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RestaurantConfig } from "@/lib/admin-data";
import {
  deleteCombinationFor,
  deletePeriodFor,
  deleteTableFor,
  saveCombinationFor,
  savePeriodFor,
  saveSettingsFor,
  saveStrictTableCapacityFor,
  saveTableFor,
  setCombinationActiveFor,
  setPeriodActiveFor,
  setRestaurantActive,
  setTableActiveFor,
  updateRestaurantBasics,
} from "@/lib/admin-actions";
import { periodLabel, WEEKDAYS } from "@/lib/dates";
import {
  STEP_LABELS,
  WIZARD_STEPS,
  type WizardStep,
} from "@/lib/wizard-steps";
import { TopBar } from "@/components/TopBar";
import { Button, Card, ErrorNote, PageHeading } from "@/components/ui";
import { BasicsForm } from "@/components/admin/BasicsForm";
import { SettingsForm } from "@/components/editors/SettingsForm";
import { TableCapacityPolicy } from "@/components/editors/TableCapacityPolicy";
import { ScheduleEditor } from "@/components/editors/ScheduleEditor";
import {
  AddTableButton,
  TablesEditor,
} from "@/components/editors/TablesEditor";
import {
  AddCombinationButton,
  CombinationsEditor,
} from "@/components/editors/CombinationsEditor";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "@/components/icons";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function StepDot({ state }: { state: "done" | "current" | "todo" }) {
  if (state === "done") {
    return (
      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-ok text-surface">
        <CheckIcon size={10} />
      </span>
    );
  }
  return (
    <span
      className={`size-4 shrink-0 rounded-full border-2 ${
        state === "current" ? "border-ink" : "border-line-strong"
      }`}
    />
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5">
      <dt className="w-44 shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-[13px]">{children}</dd>
    </div>
  );
}

/**
 * The onboarding wizard, which doubles as the editor for an existing
 * restaurant. Every step reuses the same editor component the restaurant's own
 * dashboard uses, with the write actions swapped for id-scoped admin ones.
 *
 * Step completion comes from `config.status`, computed from the rows in
 * Supabase, so leaving and returning later resumes exactly where the data left
 * off — the wizard keeps no progress of its own.
 */
export function RestaurantWizard({
  config,
  step,
}: {
  config: RestaurantConfig;
  step: WizardStep;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  const { restaurant, owner, settings, bookingHours, tables, combinations, status } =
    config;
  const refresh = () => router.refresh();

  function go(next: WizardStep) {
    startNavigation(() =>
      router.replace(`/admin/restaurants/${restaurant.id}?step=${next}`, {
        scroll: false,
      })
    );
  }

  const stepState = (candidate: WizardStep): "done" | "current" | "todo" => {
    if (candidate === step) return "current";
    switch (candidate) {
      case "restaurant":
        return status.owner ? "done" : "todo";
      case "settings":
        return status.settings ? "done" : "todo";
      case "schedule":
        return status.schedule ? "done" : "todo";
      case "tables":
        return status.tables ? "done" : "todo";
      case "combinations":
        return status.combinations ? "done" : "todo";
      case "review":
        return restaurant.active ? "done" : "todo";
    }
  };

  const index = WIZARD_STEPS.indexOf(step);
  const previous = index > 0 ? WIZARD_STEPS[index - 1] : null;
  const next = index < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[index + 1] : null;

  const zones = [
    ...new Set(tables.map((table) => table.zone).filter(Boolean)),
  ] as string[];

  async function toggleActive(active: boolean) {
    setActivating(true);
    setActivateError(null);
    const result = await setRestaurantActive(restaurant.id, active);
    setActivating(false);
    if (result.ok) refresh();
    else setActivateError(result.error);
  }

  return (
    <>
      <TopBar title="Terron Studio admin" />

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-3 py-4 md:px-6">
          <Link
            href="/admin/restaurants"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
          >
            <ChevronLeftIcon size={13} /> All restaurants
          </Link>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{restaurant.name}</h2>
              <p className="text-xs text-muted">{restaurant.slug || "No domain yet"}</p>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${
                restaurant.active
                  ? "bg-ok-soft text-ok"
                  : "bg-warn-soft text-warn"
              }`}
            >
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              {restaurant.active ? "Live" : "Not live yet"}
            </span>
          </div>

          <div className="mt-4 gap-6 lg:flex">
            {/* Step list: sidebar on desktop, scrolling pills on phones */}
            <nav
              aria-label="Onboarding steps"
              className="thin-scroll -mx-3 mb-4 flex gap-1.5 overflow-x-auto px-3 lg:mx-0 lg:mb-0 lg:w-52 lg:shrink-0 lg:flex-col lg:overflow-visible lg:px-0"
            >
              {WIZARD_STEPS.map((candidate, position) => {
                const state = stepState(candidate);
                return (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() => go(candidate)}
                    aria-current={candidate === step ? "step" : undefined}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors lg:w-full ${
                      candidate === step
                        ? "bg-ink text-surface"
                        : "text-ink-soft hover:bg-sunken"
                    }`}
                  >
                    <StepDot state={state} />
                    <span className="truncate">
                      <span
                        className={
                          candidate === step ? "text-surface/60" : "text-muted"
                        }
                      >
                        {position + 1}.
                      </span>{" "}
                      {STEP_LABELS[candidate]}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="min-w-0 flex-1">
              {step === "restaurant" && (
                <>
                  <PageHeading
                    title="Restaurant"
                    description="The restaurant identity and the owner account that can access its dashboard."
                  />
                  <div className="mt-4">
                    <BasicsForm
                      initialName={restaurant.name}
                      initialDomain={restaurant.slug}
                      initialOwnerEmail={owner?.email}
                      submitLabel="Save restaurant"
                      save={(input) => updateRestaurantBasics(restaurant.id, input)}
                      onSaved={refresh}
                    />
                  </div>
                </>
              )}

              {step === "settings" && (
                <>
                  <PageHeading
                    title="Booking settings"
                    description="Review each value with the restaurant before saving. Nothing here is filled in for you."
                  />
                  <div className="mt-4">
                    <SettingsForm
                      settings={settings}
                      fallbackName={restaurant.name}
                      fallbackTimezone={restaurant.timezone ?? "Europe/Madrid"}
                      showName={false}
                      prefill={false}
                      submitLabel="Save booking settings"
                      save={(input) =>
                        saveSettingsFor(restaurant.id, {
                          ...input,
                          restaurantName: restaurant.name,
                        })
                      }
                      onSaved={refresh}
                    />
                  </div>
                </>
              )}

              {step === "schedule" && (
                <>
                  <PageHeading
                    title="Weekly schedule"
                    description="The hours guests can book, for each day. A day with no hours takes no bookings. An end time earlier than the start means service runs past midnight."
                  />
                  <div className="mt-4">
                    <ScheduleEditor
                      bookingHours={bookingHours}
                      actions={{
                        save: (input) => savePeriodFor(restaurant.id, input),
                        setActive: (periodId, active) =>
                          setPeriodActiveFor(restaurant.id, periodId, active),
                        remove: (periodId) => deletePeriodFor(restaurant.id, periodId),
                      }}
                      onChanged={refresh}
                    />
                  </div>
                </>
              )}

              {step === "tables" && (
                <>
                  <PageHeading
                    title="Tables"
                    description="Every physical table in the dining room, with how many guests it seats."
                    action={
                      <AddTableButton
                        zones={zones}
                        save={(input) => saveTableFor(restaurant.id, input)}
                        onSaved={refresh}
                      />
                    }
                  />
                  <div className="mt-4">
                    <TableCapacityPolicy
                      enabled={settings?.strictTableCapacity ?? false}
                      save={(enabled) =>
                        saveStrictTableCapacityFor(restaurant.id, enabled)
                      }
                      onSaved={refresh}
                    />
                    <TablesEditor
                      tables={tables}
                      actions={{
                        save: (input) => saveTableFor(restaurant.id, input),
                        setActive: (tableId, active) =>
                          setTableActiveFor(restaurant.id, tableId, active),
                        remove: (tableId) => deleteTableFor(restaurant.id, tableId),
                      }}
                      onChanged={refresh}
                    />
                  </div>
                </>
              )}

              {step === "combinations" && (
                <>
                  <PageHeading
                    title="Table combinations"
                    description="Optional. Only the tables you name here will ever be joined for a larger party."
                    action={
                      tables.length >= 2 ? (
                        <AddCombinationButton
                          tables={tables}
                          save={(input) => saveCombinationFor(restaurant.id, input)}
                          onSaved={refresh}
                        />
                      ) : undefined
                    }
                  />
                  {tables.length < 2 ? (
                    <p className="mt-4 rounded-lg bg-sunken px-3 py-2.5 text-xs text-muted">
                      Add at least two tables first, then you can define which
                      ones may be joined. You can also skip this step.
                    </p>
                  ) : (
                    <div className="mt-4">
                      <CombinationsEditor
                        combinations={combinations}
                        tables={tables}
                        actions={{
                          save: (input) => saveCombinationFor(restaurant.id, input),
                          setActive: (id, active) =>
                            setCombinationActiveFor(restaurant.id, id, active),
                          remove: (id) => deleteCombinationFor(restaurant.id, id),
                        }}
                        onChanged={refresh}
                      />
                    </div>
                  )}
                </>
              )}

              {step === "review" && (
                <>
                  <PageHeading
                    title="Review & activate"
                    description="Check the configuration, then switch the restaurant on. Activation makes it bookable through the existing reservation system straight away."
                  />

                  <Card className="mt-4 divide-y divide-line">
                    <SummaryRow label="Restaurant">{restaurant.name}</SummaryRow>
                    <SummaryRow label="Domain / identifier">
                      <span className="font-medium">{restaurant.slug}</span>
                    </SummaryRow>
                    <SummaryRow label="Owner account">
                      {owner?.email ?? <Missing />}
                    </SummaryRow>
                    <SummaryRow label="Timezone">
                      {settings?.timezone ?? <Missing />}
                    </SummaryRow>
                    <SummaryRow label="Slot interval">
                      {settings?.slotIntervalMinutes != null ? (
                        `${settings.slotIntervalMinutes} minutes`
                      ) : (
                        <Missing />
                      )}
                    </SummaryRow>
                    <SummaryRow label="Reservation duration">
                      {settings?.defaultBookingDurationMinutes != null ? (
                        `${settings.defaultBookingDurationMinutes} minutes`
                      ) : (
                        <Missing />
                      )}
                    </SummaryRow>
                    <SummaryRow label="Max online party">
                      {settings?.maxOnlinePartySize != null ? (
                        `${settings.maxOnlinePartySize} guests`
                      ) : (
                        <Missing />
                      )}
                    </SummaryRow>
                    <SummaryRow label="Table capacity rule">
                      {settings?.strictTableCapacity
                        ? "Exact capacity or one spare seat"
                        : "Flexible table assignment"}
                    </SummaryRow>
                    <SummaryRow label="Advance rules">
                      {settings?.minAdvanceMinutes != null &&
                      settings?.maxAdvanceDays != null ? (
                        `At least ${settings.minAdvanceMinutes} minutes ahead, up to ${settings.maxAdvanceDays} days out`
                      ) : (
                        <Missing />
                      )}
                    </SummaryRow>
                  </Card>

                  <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
                    Weekly schedule
                  </h3>
                  <Card className="mt-1 divide-y divide-line">
                    {DAY_ORDER.map((day) => {
                      const periods = bookingHours.filter(
                        (hour) => hour.dayOfWeek === day && hour.active
                      );
                      return (
                        <SummaryRow key={day} label={WEEKDAYS[day]}>
                          {periods.length === 0 ? (
                            <span className="text-muted">Closed</span>
                          ) : (
                            <span className="tabular-nums">
                              {periods
                                .map((period) =>
                                  periodLabel(
                                    period.startTime,
                                    period.endTime,
                                    period.spansNextDay
                                  )
                                )
                                .join("  ·  ")}
                            </span>
                          )}
                        </SummaryRow>
                      );
                    })}
                  </Card>

                  <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
                    Tables ({tables.filter((table) => table.active).length} in service)
                  </h3>
                  <Card className="mt-1 p-4">
                    {tables.length === 0 ? (
                      <p className="text-[13px] text-muted">No tables configured.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {tables.map((table) => (
                          <span
                            key={table.id}
                            className={`rounded-md border border-line bg-sunken px-1.5 py-0.5 text-[11px] font-medium ${
                              table.active ? "text-ink-soft" : "text-muted line-through"
                            }`}
                          >
                            {table.name} · {table.capacity ?? "?"}
                            {table.zone ? ` · ${table.zone}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>

                  <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
                    Combinations
                  </h3>
                  <Card className="mt-1 p-4">
                    {combinations.length === 0 ? (
                      <p className="text-[13px] text-muted">
                        None configured. That is fine — this step is optional.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {combinations.map((combination) => (
                          <li key={combination.id} className="text-[13px]">
                            <span className="font-medium">{combination.name}</span>{" "}
                            <span className="text-muted">
                              — {combination.capacity ?? "?"} seats,{" "}
                              {combination.memberIds.length} tables
                              {combination.active ? "" : " (not in use)"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>

                  {!status.readyToActivate && (
                    <div className="mt-4 rounded-lg bg-warn-soft px-3 py-2.5 text-xs leading-5 text-warn">
                      Before activating, this restaurant still needs{" "}
                      {joinPhrases([
                        !status.owner && "an owner account",
                        !status.settings && "its booking settings saved",
                        !status.schedule && "at least one day of booking hours",
                        !status.tables && "at least one table in service",
                      ])}
                      .
                    </div>
                  )}

                  {activateError && (
                    <div className="mt-3">{<ErrorNote>{activateError}</ErrorNote>}</div>
                  )}

                  {restaurant.active ? (
                    <Card className="mt-4 p-4">
                      <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ok">
                        <CheckIcon size={14} /> This restaurant is live
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        Bookings for <span className="font-medium">{restaurant.slug}</span>{" "}
                        are being accepted by the reservation system.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="danger"
                          pending={activating}
                          onClick={() => toggleActive(false)}
                        >
                          Deactivate restaurant
                        </Button>
                        <Link
                          href="/admin/restaurants"
                          className="inline-flex items-center rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium hover:bg-sunken"
                        >
                          Back to all restaurants
                        </Link>
                      </div>
                    </Card>
                  ) : (
                    <div className="mt-4">
                      <Button
                        variant="primary"
                        pending={activating}
                        disabled={!status.readyToActivate}
                        onClick={() => toggleActive(true)}
                      >
                        Activate restaurant
                      </Button>
                    </div>
                  )}
                </>
              )}

              {/* Step navigation */}
              <div className="mt-6 flex items-center justify-between gap-2 border-t border-line pt-4">
                {previous ? (
                  <Button
                    icon={<ChevronLeftIcon size={13} />}
                    onClick={() => go(previous)}
                    disabled={navigating}
                  >
                    {STEP_LABELS[previous]}
                  </Button>
                ) : (
                  <span />
                )}
                {next && (
                  <button
                    type="button"
                    onClick={() => go(next)}
                    disabled={navigating}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[13px] font-medium text-surface transition-opacity hover:opacity-85 disabled:opacity-40"
                  >
                    {STEP_LABELS[next]}
                    <ChevronRightIcon size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** "a, b and c" from a list that may contain falsy entries. */
function joinPhrases(parts: (string | false)[]): string {
  const kept = parts.filter(Boolean) as string[];
  if (kept.length <= 1) return kept.join("");
  return `${kept.slice(0, -1).join(", ")} and ${kept[kept.length - 1]}`;
}

function Missing() {
  return (
    <span className="inline-flex items-center gap-1 text-warn">
      <PlusIcon size={11} /> Not set
    </span>
  );
}

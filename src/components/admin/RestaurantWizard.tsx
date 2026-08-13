"use client";

import { useOptimistic, useState, useTransition } from "react";
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
import { Button, Card, ErrorNote, LoadingOverlay, PageHeading } from "@/components/ui";
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
  // The step list answers the tap straight away; the panel beside it only
  // changes once the step has been fetched.
  const [pickedStep, setPickedStep] = useOptimistic(step);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  const { restaurant, owner, settings, bookingHours, tables, combinations, status } =
    config;
  const refresh = () => router.refresh();

  function go(next: WizardStep) {
    startNavigation(() => {
      setPickedStep(next);
      router.replace(`/admin/restaurants/${restaurant.id}?step=${next}`, {
        scroll: false,
      });
    });
  }

  const stepState = (candidate: WizardStep): "done" | "current" | "todo" => {
    if (candidate === pickedStep) return "current";
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
      <TopBar title="Administración de Terron Studio" />

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-3 py-4 md:px-6">
          <Link
            href="/admin/restaurants"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
          >
            <ChevronLeftIcon size={13} /> Todos los restaurantes
          </Link>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{restaurant.name}</h2>
              <p className="text-xs text-muted">{restaurant.slug || "Sin dominio"}</p>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${
                restaurant.active
                  ? "bg-ok-soft text-ok"
                  : "bg-warn-soft text-warn"
              }`}
            >
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              {restaurant.active ? "Activo" : "Todavía no está activo"}
            </span>
          </div>

          <div className="mt-4 gap-6 lg:flex">
            {/* Step list: sidebar on desktop, scrolling pills on phones */}
            <nav
              aria-label="Pasos de configuración"
              className="thin-scroll -mx-3 mb-4 flex gap-1.5 overflow-x-auto px-3 lg:mx-0 lg:mb-0 lg:w-52 lg:shrink-0 lg:flex-col lg:overflow-visible lg:px-0"
            >
              {WIZARD_STEPS.map((candidate, position) => {
                const state = stepState(candidate);
                return (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() => go(candidate)}
                    aria-current={candidate === pickedStep ? "step" : undefined}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors lg:w-full ${
                      candidate === pickedStep
                        ? "bg-ink text-surface"
                        : "text-ink-soft hover:bg-sunken"
                    }`}
                  >
                    <StepDot state={state} />
                    <span className="truncate">
                      <span
                        className={
                          candidate === pickedStep ? "text-surface/60" : "text-muted"
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

            <div className="relative min-w-0 flex-1">
              {navigating && <LoadingOverlay />}
              {step === "restaurant" && (
                <>
                  <PageHeading
                    title="Restaurante"
                    description="La identidad del restaurante y la cuenta del propietario que puede acceder a su panel."
                  />
                  <div className="mt-4">
                    <BasicsForm
                      initialName={restaurant.name}
                      initialDomain={restaurant.slug}
                      initialOwnerEmail={owner?.email}
                      submitLabel="Guardar restaurante"
                      save={(input) => updateRestaurantBasics(restaurant.id, input)}
                      onSaved={refresh}
                    />
                  </div>
                </>
              )}

              {step === "settings" && (
                <>
                  <PageHeading
                    title="Ajustes de reservas"
                    description="Revisa cada valor con el restaurante antes de guardarlo. Nada se completa automáticamente."
                  />
                  <div className="mt-4">
                    <SettingsForm
                      settings={settings}
                      fallbackName={restaurant.name}
                      fallbackTimezone={restaurant.timezone ?? "Europe/Madrid"}
                      showName={false}
                      prefill={false}
                      submitLabel="Guardar ajustes de reservas"
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
                    title="Horario semanal"
                    description="Las horas en las que los clientes pueden reservar cada día. Los días sin horario no aceptan reservas. Una hora de fin anterior a la de inicio indica que el servicio termina después de medianoche."
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
                    title="Mesas"
                    description="Todas las mesas físicas de la sala y el número de comensales que admite cada una."
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
                    title="Combinaciones de mesas"
                    description="Opcional. Solo se unirán para grupos grandes las mesas que indiques aquí."
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
                      Añade al menos dos mesas primero para poder definir cuáles
                      se pueden unir. También puedes omitir este paso.
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
                    title="Revisar y activar"
                    description="Comprueba la configuración y activa el restaurante. Al activarlo, podrá recibir reservas inmediatamente a través del sistema existente."
                  />

                  <Card className="mt-4 divide-y divide-line">
                    <SummaryRow label="Restaurante">{restaurant.name}</SummaryRow>
                    <SummaryRow label="Dominio / identificador">
                      <span className="font-medium">{restaurant.slug}</span>
                    </SummaryRow>
                    <SummaryRow label="Cuenta del propietario">
                      {owner?.email ?? <Missing />}
                    </SummaryRow>
                    <SummaryRow label="Zona horaria">
                      {settings?.timezone ?? <Missing />}
                    </SummaryRow>
                    <SummaryRow label="Intervalo entre franjas">
                      {settings?.slotIntervalMinutes != null ? (
                        `${settings.slotIntervalMinutes} minutos`
                      ) : (
                        <Missing />
                      )}
                    </SummaryRow>
                    <SummaryRow label="Duración de la reserva">
                      {settings?.defaultBookingDurationMinutes != null ? (
                        `${settings.defaultBookingDurationMinutes} minutos`
                      ) : (
                        <Missing />
                      )}
                    </SummaryRow>
                    <SummaryRow label="Grupo máximo en línea">
                      {settings?.maxOnlinePartySize != null ? (
                        `${settings.maxOnlinePartySize} comensales`
                      ) : (
                        <Missing />
                      )}
                    </SummaryRow>
                    <SummaryRow label="Regla de capacidad de mesas">
                      {settings?.strictTableCapacity
                        ? "Capacidad exacta o una plaza libre"
                        : "Asignación flexible de mesas"}
                    </SummaryRow>
                    <SummaryRow label="Reglas de antelación">
                      {settings?.minAdvanceMinutes != null &&
                      settings?.maxAdvanceDays != null ? (
                        `Al menos ${settings.minAdvanceMinutes} minutos de antelación y hasta ${settings.maxAdvanceDays} días`
                      ) : (
                        <Missing />
                      )}
                    </SummaryRow>
                  </Card>

                  <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
                    Horario semanal
                  </h3>
                  <Card className="mt-1 divide-y divide-line">
                    {DAY_ORDER.map((day) => {
                      const periods = bookingHours.filter(
                        (hour) => hour.dayOfWeek === day && hour.active
                      );
                      return (
                        <SummaryRow key={day} label={WEEKDAYS[day]}>
                          {periods.length === 0 ? (
                            <span className="text-muted">Cerrado</span>
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
                    Mesas ({tables.filter((table) => table.active).length} en servicio)
                  </h3>
                  <Card className="mt-1 p-4">
                    {tables.length === 0 ? (
                      <p className="text-[13px] text-muted">No hay mesas configuradas.</p>
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
                    Combinaciones
                  </h3>
                  <Card className="mt-1 p-4">
                    {combinations.length === 0 ? (
                      <p className="text-[13px] text-muted">
                        No hay ninguna configurada. No pasa nada: este paso es opcional.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {combinations.map((combination) => (
                          <li key={combination.id} className="text-[13px]">
                            <span className="font-medium">{combination.name}</span>{" "}
                            <span className="text-muted">
                              — {combination.capacity ?? "?"} plazas,{" "}
                              {combination.memberIds.length} mesas
                              {combination.active ? "" : " (fuera de uso)"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>

                  {!status.readyToActivate && (
                    <div className="mt-4 rounded-lg bg-warn-soft px-3 py-2.5 text-xs leading-5 text-warn">
                      Antes de activarlo, este restaurante todavía necesita{" "}
                      {joinPhrases([
                        !status.owner && "una cuenta de propietario",
                        !status.settings && "guardar sus ajustes de reservas",
                        !status.schedule && "al menos un día con horario de reservas",
                        !status.tables && "al menos una mesa en servicio",
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
                        <CheckIcon size={14} /> Este restaurante está activo
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        El sistema de reservas está aceptando reservas para{" "}
                        <span className="font-medium">{restaurant.slug}</span>.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="danger"
                          pending={activating}
                          onClick={() => toggleActive(false)}
                        >
                          Desactivar restaurante
                        </Button>
                        <Link
                          href="/admin/restaurants"
                          className="inline-flex items-center rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium hover:bg-sunken"
                        >
                          Volver a todos los restaurantes
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
                        Activar restaurante
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
                    className="inline-flex items-center gap-1.5 rounded-lg bg-ok px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40"
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
  return `${kept.slice(0, -1).join(", ")} y ${kept[kept.length - 1]}`;
}

function Missing() {
  return (
    <span className="inline-flex items-center gap-1 text-warn">
      <PlusIcon size={11} /> Sin configurar
    </span>
  );
}

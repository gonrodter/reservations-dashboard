/**
 * Onboarding step vocabulary, shared by the server page that reads the ?step=
 * parameter and the client wizard that renders it.
 *
 * This lives in a plain module on purpose. Exporting it from the "use client"
 * wizard would send a client reference across the boundary instead of the real
 * array, and server code calling WIZARD_STEPS.includes() would fail at runtime.
 */

export type WizardStep =
  | "restaurant"
  | "settings"
  | "schedule"
  | "tables"
  | "combinations"
  | "review";

export const WIZARD_STEPS: WizardStep[] = [
  "restaurant",
  "settings",
  "schedule",
  "tables",
  "combinations",
  "review",
];

export const STEP_LABELS: Record<WizardStep, string> = {
  restaurant: "Restaurant",
  settings: "Booking settings",
  schedule: "Weekly schedule",
  tables: "Tables",
  combinations: "Combinations",
  review: "Review & activate",
};

export function isWizardStep(value: unknown): value is WizardStep {
  return typeof value === "string" && (WIZARD_STEPS as string[]).includes(value);
}

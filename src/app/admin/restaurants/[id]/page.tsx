import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRestaurantConfig } from "@/lib/admin-data";
import { RestaurantWizard } from "@/components/admin/RestaurantWizard";
import { isWizardStep, type WizardStep } from "@/lib/wizard-steps";

export const metadata: Metadata = {
  title: "Restaurant setup · Admin",
};

/**
 * One page serves both onboarding and later editing: the step comes from the
 * URL and completion comes from the data, so a half-configured restaurant
 * resumes exactly where it was left.
 */
export default async function AdminRestaurantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { id } = await params;
  const { step: stepParam } = await searchParams;

  const config = await getRestaurantConfig(id);
  if (!config) notFound();

  const requested = isWizardStep(stepParam) ? stepParam : null;

  // Without an explicit step, drop the superadmin on the first thing still
  // missing, so "continue onboarding" needs no thought.
  const nextIncomplete: WizardStep = !config.status.settings
    ? "settings"
    : !config.status.schedule
      ? "schedule"
      : !config.status.tables
        ? "tables"
        : "review";

  const step = requested ?? (config.restaurant.active ? "restaurant" : nextIncomplete);

  return <RestaurantWizard config={config} step={step} />;
}

import Link from "next/link";
import { listRestaurants, requireSuperadmin } from "@/lib/admin-data";
import { TopBar } from "@/components/TopBar";
import { SummaryStats } from "@/components/SummaryStats";
import { Card, PageHeading } from "@/components/ui";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";

export default async function AdminOverviewPage() {
  const [{ fullName }, restaurants] = await Promise.all([
    requireSuperadmin(),
    listRestaurants(),
  ]);

  const live = restaurants.filter((restaurant) => restaurant.active);
  const settingUp = restaurants.filter((restaurant) => !restaurant.active);

  return (
    <>
      <TopBar title="Terron Studio admin" />

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-3 py-4 md:px-6">
          <PageHeading
            title={fullName ? `Welcome back, ${fullName}` : "Overview"}
            description="Onboard restaurants into the reservation system and keep their configuration up to date."
          />

          <div className="mt-4">
            <SummaryStats
              stats={[
                { label: "Restaurants", value: String(restaurants.length) },
                { label: "Live", value: String(live.length) },
                { label: "Setting up", value: String(settingUp.length) },
              ]}
            />
          </div>

          <Link
            href="/admin/restaurants/new"
            className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-line-strong"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-ink text-surface">
              <PlusIcon size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">
                Onboard a new restaurant
              </span>
              <span className="block text-xs text-muted">
                Name, domain, booking rules, hours and tables — then activate.
              </span>
            </span>
            <ChevronRightIcon size={15} />
          </Link>

          {settingUp.length > 0 && (
            <section className="mt-6">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                Unfinished onboarding
              </h3>
              <Card className="overflow-hidden">
                {settingUp.slice(0, 6).map((restaurant, index) => (
                  <Link
                    key={restaurant.id}
                    href={`/admin/restaurants/${restaurant.id}?step=settings`}
                    className={`flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-sunken ${
                      index > 0 ? "border-t border-line" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">
                        {restaurant.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {restaurant.slug || "No domain"}
                      </span>
                    </span>
                    <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-[11px] font-medium text-warn">
                      Continue
                    </span>
                    <ChevronRightIcon size={14} />
                  </Link>
                ))}
              </Card>
            </section>
          )}

          <section className="mt-6">
            <div className="mb-1 flex items-baseline justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Live restaurants
              </h3>
              <Link
                href="/admin/restaurants"
                className="text-xs font-medium text-muted hover:text-ink"
              >
                View all
              </Link>
            </div>
            {live.length === 0 ? (
              <p className="rounded-lg bg-sunken px-3 py-2.5 text-xs text-muted">
                No restaurants are live yet.
              </p>
            ) : (
              <Card className="overflow-hidden">
                {live.slice(0, 8).map((restaurant, index) => (
                  <Link
                    key={restaurant.id}
                    href={`/admin/restaurants/${restaurant.id}`}
                    className={`flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-sunken ${
                      index > 0 ? "border-t border-line" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">
                        {restaurant.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {restaurant.slug}
                      </span>
                    </span>
                    <span className="rounded-md bg-ok-soft px-1.5 py-0.5 text-[11px] font-medium text-ok">
                      Live
                    </span>
                    <ChevronRightIcon size={14} />
                  </Link>
                ))}
              </Card>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

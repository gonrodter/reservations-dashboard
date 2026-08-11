"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminRestaurant } from "@/lib/admin-data";
import { setRestaurantActive } from "@/lib/admin-actions";
import { TopBar } from "@/components/TopBar";
import { EmptyState } from "@/components/EmptyState";
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorNote,
  PageHeading,
  Segmented,
} from "@/components/ui";
import {
  ChevronRightIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  Spinner,
} from "@/components/icons";

type Filter = "all" | "live" | "onboarding";

function formatCreated(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function RestaurantsList({
  restaurants,
}: {
  restaurants: AdminRestaurant[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<AdminRestaurant | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return restaurants.filter((restaurant) => {
      if (filter === "live" && !restaurant.active) return false;
      if (filter === "onboarding" && restaurant.active) return false;
      if (!q) return true;
      return (
        restaurant.name.toLowerCase().includes(q) ||
        restaurant.slug.toLowerCase().includes(q)
      );
    });
  }, [restaurants, filter, query]);

  const liveCount = restaurants.filter((restaurant) => restaurant.active).length;

  async function activate(restaurant: AdminRestaurant) {
    setBusyId(restaurant.id);
    setError(null);
    const result = await setRestaurantActive(restaurant.id, true);
    setBusyId(null);
    if (result.ok) router.refresh();
    else setError(result.error);
  }

  async function confirmDeactivate() {
    if (!deactivating) return;
    setBusyId(deactivating.id);
    setError(null);
    const result = await setRestaurantActive(deactivating.id, false);
    setBusyId(null);
    if (result.ok) {
      setDeactivating(null);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <>
      <TopBar
        title="Terron Studio admin"
        search={{
          value: query,
          onChange: setQuery,
          placeholder: "Search by name or domain",
        }}
        onNew={() => router.push("/admin/restaurants/new")}
        newLabel="New restaurant"
      />

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-3 py-4 md:px-6">
          <PageHeading
            title="Restaurants"
            description={`${restaurants.length} total · ${liveCount} live · ${
              restaurants.length - liveCount
            } still being set up`}
            action={
              <Segmented
                label="Filter"
                value={filter}
                options={[
                  { value: "all", label: "All" },
                  { value: "live", label: "Live" },
                  { value: "onboarding", label: "Setting up" },
                ]}
                onChange={setFilter}
              />
            }
          />

          {error && <div className="mt-3">{<ErrorNote>{error}</ErrorNote>}</div>}

          {restaurants.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                icon={<ListIcon size={18} />}
                title="No restaurants yet"
                body="Onboard the first client to get them booking."
                action={
                  <Link
                    href="/admin/restaurants/new"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-[13px] font-medium text-surface hover:opacity-85"
                  >
                    <PlusIcon size={13} /> New restaurant
                  </Link>
                }
              />
            </div>
          ) : visible.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                icon={<SearchIcon size={18} />}
                title="No matches"
                body="No restaurant matches this filter or search."
              />
            </div>
          ) : (
            <Card className="mt-4 overflow-hidden">
              {visible.map((restaurant, index) => (
                <div
                  key={restaurant.id}
                  className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${
                    index > 0 ? "border-t border-line" : ""
                  } ${restaurant.active ? "" : "bg-sunken/40"}`}
                >
                  <Link
                    href={`/admin/restaurants/${restaurant.id}`}
                    className="group min-w-0 flex-1"
                  >
                    <span className="block truncate text-[13px] font-medium group-hover:underline">
                      {restaurant.name}
                    </span>
                    <span className="block truncate text-[11px] text-muted">
                      {restaurant.slug || "No domain"} · added{" "}
                      {formatCreated(restaurant.createdAt)}
                    </span>
                  </Link>

                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4 ${
                      restaurant.active
                        ? "bg-ok-soft text-ok"
                        : "bg-warn-soft text-warn"
                    }`}
                  >
                    <span className="size-1 rounded-full bg-current" aria-hidden />
                    {restaurant.active ? "Live" : "Setting up"}
                  </span>

                  {restaurant.active ? (
                    <button
                      type="button"
                      onClick={() => setDeactivating(restaurant)}
                      disabled={busyId === restaurant.id}
                      className="rounded-lg border border-line px-2 py-1 text-[11px] font-medium hover:bg-sunken disabled:opacity-40"
                    >
                      {busyId === restaurant.id ? <Spinner size={11} /> : "Deactivate"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => activate(restaurant)}
                      disabled={busyId === restaurant.id}
                      className="rounded-lg border border-line px-2 py-1 text-[11px] font-medium hover:bg-sunken disabled:opacity-40"
                    >
                      {busyId === restaurant.id ? <Spinner size={11} /> : "Activate"}
                    </button>
                  )}

                  <Link
                    href={`/admin/restaurants/${restaurant.id}?step=${
                      restaurant.active ? "restaurant" : "settings"
                    }`}
                    className="inline-flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1 text-[11px] font-medium text-surface hover:opacity-85"
                  >
                    {restaurant.active ? "Edit" : "Continue setup"}
                    <ChevronRightIcon size={11} />
                  </Link>
                </div>
              ))}
            </Card>
          )}

          <div className="mt-4">
            <Button
              variant="primary"
              icon={<PlusIcon size={13} />}
              onClick={() => router.push("/admin/restaurants/new")}
            >
              New restaurant
            </Button>
          </div>
        </div>
      </div>

      {deactivating && (
        <ConfirmDialog
          title="Deactivate this restaurant?"
          body={`${deactivating.name} will stop accepting new bookings through ${deactivating.slug}. Existing reservations are not affected.`}
          confirmLabel="Deactivate"
          destructive
          pending={busyId === deactivating.id}
          error={error}
          onConfirm={confirmDeactivate}
          onClose={() => setDeactivating(null)}
        />
      )}
    </>
  );
}

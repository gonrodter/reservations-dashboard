"use client";

import { Shell, type NavItem } from "@/components/Shell";
import {
  ClockIcon,
  LayersIcon,
  ListIcon,
  TableIcon,
} from "@/components/icons";

// The admin area reuses the dashboard chrome exactly; only the destinations
// differ. The second group is the way back out to a restaurant dashboard.
const ADMIN_GROUPS: NavItem[][] = [
  [
    { href: "/admin", label: "Overview", icon: LayersIcon },
    { href: "/admin/restaurants", label: "Restaurants", icon: ListIcon },
    { href: "/admin/floors", label: "Table map", icon: TableIcon },
  ],
  [{ href: "/", label: "Restaurant dashboard", icon: ClockIcon }],
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <Shell restaurantName="Terron Studio" groups={ADMIN_GROUPS}>
      {children}
    </Shell>
  );
}

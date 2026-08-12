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
    { href: "/admin", label: "Resumen", icon: LayersIcon },
    { href: "/admin/restaurants", label: "Restaurantes", icon: ListIcon },
    { href: "/admin/floors", label: "Plano de mesas", icon: TableIcon },
  ],
  [{ href: "/", label: "Panel del restaurante", icon: ClockIcon }],
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <Shell restaurantName="Terron Studio" groups={ADMIN_GROUPS}>
      {children}
    </Shell>
  );
}

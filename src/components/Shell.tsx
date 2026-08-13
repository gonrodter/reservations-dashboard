"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions";
import { LoadingOverlay } from "@/components/ui";
import {
  CalendarIcon,
  GridIcon,
  LayersIcon,
  ListIcon,
  LogoMark,
  LogoutIcon,
  SettingsIcon,
  StarDateIcon,
  TableIcon,
  WeekIcon,
} from "@/components/icons";

/** How a nav link tells the shell that its navigation is in flight. */
const ReportNavigation = createContext<(href: string, pending: boolean) => void>(
  () => {}
);

/**
 * A tapped destination has to answer immediately, even though its data is
 * fetched on the server. The icon itself stays put: the wait is reported to
 * the shell, which shows it over the content that is about to change. Only
 * meaningful inside a `Link`.
 */
function NavIcon({
  icon: Icon,
  size,
  href,
}: {
  icon: (props: { size?: number }) => React.ReactElement;
  size: number;
  href: string;
}) {
  const { pending } = useLinkStatus();
  const report = useContext(ReportNavigation);

  useEffect(() => {
    report(href, pending);
    return () => report(href, false);
  }, [href, pending, report]);

  return <Icon size={size} />;
}

export interface NavItem {
  href: string;
  label: string;
  icon: (props: { size?: number }) => React.ReactElement;
}

// Two groups: what is happening during service, then how the restaurant is
// configured. The rail shows the split as a hairline divider.
const OPERATIONS: NavItem[] = [
  { href: "/", label: "Hoy", icon: TableIcon },
  { href: "/reservations", label: "Reservas", icon: ListIcon },
  { href: "/calendar", label: "Calendario", icon: CalendarIcon },
];

const CONFIGURATION: NavItem[] = [
  { href: "/tables", label: "Mesas", icon: GridIcon },
  { href: "/schedule", label: "Horario", icon: WeekIcon },
  { href: "/special-dates", label: "Fechas especiales", icon: StarDateIcon },
  { href: "/settings", label: "Ajustes", icon: SettingsIcon },
];

const RESTAURANT_GROUPS: NavItem[][] = [OPERATIONS, CONFIGURATION];

function isActive(pathname: string, href: string): boolean {
  // Exact match for section roots that are prefixes of their children.
  if (href === "/" || href === "/admin") return pathname === href;
  return pathname.startsWith(href);
}

export function Shell({
  restaurantName,
  groups = RESTAURANT_GROUPS,
  canAccessAdmin = false,
  children,
}: {
  restaurantName: string;
  /** Rail groups, rendered with a divider between them. */
  groups?: NavItem[][];
  /** Shows a direct switch to the protected admin area for superadmins. */
  canAccessAdmin?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const all = groups.flat();

  const [pendingHrefs, setPendingHrefs] = useState<string[]>([]);
  const report = useCallback((href: string, pending: boolean) => {
    setPendingHrefs((current) => {
      const listed = current.includes(href);
      if (pending === listed) return current;
      return pending ? [...current, href] : current.filter((item) => item !== href);
    });
  }, []);

  // A tapped destination takes the highlight before its page arrives, so the
  // order is always: the control moves, the wait shows, the content follows.
  const target = pendingHrefs[pendingHrefs.length - 1];
  const current = (href: string) =>
    target ? href === target : isActive(pathname, href);

  return (
    <ReportNavigation value={report}>
    <div className="canvas-decor h-dvh p-0 md:p-4">
      <div className="flex h-full flex-col overflow-hidden bg-surface shadow-frame md:flex-row md:rounded-2xl">
        {/* Desktop and tablet icon rail */}
        <nav
          aria-label="Navegación principal"
          className="hidden w-14 shrink-0 flex-col items-center border-r border-line py-3 md:flex"
        >
          <div className="flex size-8 items-center justify-center rounded-lg bg-ink text-surface">
            <LogoMark size={18} />
          </div>

          {groups.map((group, index) => (
            <div key={index} className="flex flex-col items-center">
              {index === 0 ? (
                <div className="mt-6" />
              ) : (
                <div className="my-2.5 h-px w-6 bg-line" />
              )}
              <div className="flex flex-col gap-1.5">
                {group.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    title={label}
                    aria-current={current(href) ? "page" : undefined}
                    className={`flex size-9 items-center justify-center rounded-lg transition-colors ${
                      current(href)
                        ? "bg-ink text-surface"
                        : "text-muted hover:bg-sunken hover:text-ink"
                    }`}
                  >
                    <NavIcon icon={Icon} size={17} href={href} />
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-auto flex flex-col gap-1.5">
            {canAccessAdmin && (
              <Link
                href="/admin"
                title="Administración"
                aria-label="Abrir administración"
                className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink"
              >
                <LayersIcon size={17} />
              </Link>
            )}
            <form action={logout}>
              <button
                type="submit"
                title="Cerrar sesión"
                className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink"
              >
                <LogoutIcon size={17} />
              </button>
            </form>
          </div>
        </nav>

        {/* Phone header: identity row, then a scrollable section row so all
            seven destinations stay reachable one-handed. */}
        <div className="shrink-0 border-b border-line md:hidden">
          <div className="flex items-center gap-2 px-3 pt-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-ink text-surface">
              <LogoMark size={15} />
            </div>
            <span className="truncate text-sm font-semibold">{restaurantName}</span>
            {canAccessAdmin && (
              <Link
                href="/admin"
                className="ml-auto inline-flex items-center gap-1 rounded-lg bg-sunken px-2 py-1.5 text-xs font-medium text-ink-soft"
              >
                <LayersIcon size={14} />
                Administración
              </Link>
            )}
            <form action={logout} className={canAccessAdmin ? "" : "ml-auto"}>
              <button
                type="submit"
                title="Cerrar sesión"
                className="flex size-8 items-center justify-center rounded-lg text-muted"
              >
                <LogoutIcon size={16} />
              </button>
            </form>
          </div>

          <nav
            aria-label="Secciones"
            className="thin-scroll flex gap-1 overflow-x-auto px-3 py-2"
          >
            {all.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={current(href) ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all active:scale-[0.97] ${
                  current(href)
                    ? "bg-ink text-surface"
                    : "bg-sunken text-muted"
                }`}
              >
                <NavIcon icon={Icon} size={13} href={href} />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* min-w-0 lets this column shrink below its content's natural width,
            so intrinsically wide children scroll inside their own container
            instead of being clipped by the frame. */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {children}
          {pendingHrefs.length > 0 && <LoadingOverlay />}
        </div>
      </div>
    </div>
    </ReportNavigation>
  );
}

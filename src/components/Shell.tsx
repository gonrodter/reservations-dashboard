"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions";
import {
  CalendarIcon,
  GridIcon,
  ListIcon,
  LogoMark,
  LogoutIcon,
  SettingsIcon,
  StarDateIcon,
  TableIcon,
  WeekIcon,
} from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: (props: { size?: number }) => React.ReactElement;
}

// Two groups: what is happening during service, then how the restaurant is
// configured. The rail shows the split as a hairline divider.
const OPERATIONS: NavItem[] = [
  { href: "/", label: "Today", icon: TableIcon },
  { href: "/reservations", label: "Reservations", icon: ListIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
];

const CONFIGURATION: NavItem[] = [
  { href: "/tables", label: "Tables", icon: GridIcon },
  { href: "/schedule", label: "Schedule", icon: WeekIcon },
  { href: "/special-dates", label: "Special dates", icon: StarDateIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
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
  children,
}: {
  restaurantName: string;
  /** Rail groups, rendered with a divider between them. */
  groups?: NavItem[][];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const all = groups.flat();

  return (
    <div className="canvas-decor h-dvh p-0 md:p-4">
      <div className="flex h-full flex-col overflow-hidden bg-surface shadow-frame md:flex-row md:rounded-2xl">
        {/* Desktop and tablet icon rail */}
        <nav
          aria-label="Main"
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
                    aria-current={isActive(pathname, href) ? "page" : undefined}
                    className={`flex size-9 items-center justify-center rounded-lg transition-colors ${
                      isActive(pathname, href)
                        ? "bg-ink text-surface"
                        : "text-muted hover:bg-sunken hover:text-ink"
                    }`}
                  >
                    <Icon size={17} />
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <form action={logout} className="mt-auto">
            <button
              type="submit"
              title="Sign out"
              className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <LogoutIcon size={17} />
            </button>
          </form>
        </nav>

        {/* Phone header: identity row, then a scrollable section row so all
            seven destinations stay reachable one-handed. */}
        <div className="shrink-0 border-b border-line md:hidden">
          <div className="flex items-center gap-2 px-3 pt-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-ink text-surface">
              <LogoMark size={15} />
            </div>
            <span className="truncate text-sm font-semibold">{restaurantName}</span>
            <form action={logout} className="ml-auto">
              <button
                type="submit"
                title="Sign out"
                className="flex size-8 items-center justify-center rounded-lg text-muted"
              >
                <LogoutIcon size={16} />
              </button>
            </form>
          </div>

          <nav
            aria-label="Sections"
            className="thin-scroll flex gap-1 overflow-x-auto px-3 py-2"
          >
            {all.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive(pathname, href)
                    ? "bg-ink text-surface"
                    : "bg-sunken text-muted"
                }`}
              >
                <Icon size={13} />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* min-w-0 lets this column shrink below its content's natural width,
            so intrinsically wide children scroll inside their own container
            instead of being clipped by the frame. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

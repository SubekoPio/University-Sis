"use client";

// Purpose: Render the responsive branded navigation rail and mobile drawer.
// Used by: AppShell for all protected role workspaces.
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppRole } from "@/lib/auth-role";
import { NAV_CONFIG } from "@/lib/nav.config";

interface NavigationRailProps {
  role: AppRole;
  collapsed: boolean;
  mobileOpen: boolean;
  permissions: readonly string[];
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}

/**
 * Renders grouped role navigation as a fixed desktop rail or mobile slide-over.
 *
 * @param props - Current role, viewport state, and rail callbacks.
 * @returns The accessible navigation landmark.
 */
export function NavigationRail({
  role,
  collapsed,
  mobileOpen,
  permissions,
  onToggleCollapsed,
  onCloseMobile,
}: NavigationRailProps) {
  const pathname = usePathname();
  const sections = NAV_CONFIG[role];

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-ink/40 md:hidden"
        />
      )}

      <aside
        aria-label={`${role} navigation`}
        className={[
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-brand text-card transition-[width,transform]",
          "md:sticky md:top-0 md:z-30 md:h-screen md:shrink-0",
          collapsed ? "md:w-[5rem]" : "md:w-[17rem]",
          mobileOpen ? "w-[18rem] translate-x-0" : "w-[18rem] -translate-x-full",
          "md:translate-x-0",
        ].join(" ")}
      >
        {/* Brand identity remains visible in both desktop rail widths. */}
        <div className="flex h-16 items-center border-b border-card/20 px-4">
          <Link
            href={NAV_CONFIG[role][0]?.items[0]?.href ?? "/"}
            onClick={onCloseMobile}
            className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-card font-bold text-brand">
              US
            </span>
            {(!collapsed || mobileOpen) && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">University SIS</span>
                <span className="block truncate text-xs text-card/75">
                  Student information system
                </span>
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation drawer"
            className="ml-auto grid size-9 place-items-center rounded-lg text-card hover:bg-card/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card md:hidden"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        {/* Grouped role destinations form the primary navigation landmark. */}
        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.label} className="mb-5">
              {(!collapsed || mobileOpen) && (
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-card/70">
                  {section.label}
                </p>
              )}
              <ul className="space-y-1">
                {section.items
                  .filter((navItem) => navItem.enabled)
                  .filter(
                    (navItem) =>
                      navItem.permission === null ||
                      permissions.length === 0 ||
                      permissions.includes(navItem.permission),
                  )
                  .map((NavItem) => {
                    const active =
                      pathname === NavItem.href ||
                      (NavItem.href !== `/${role}` && pathname.startsWith(`${NavItem.href}/`));
                    const Icon = NavItem.icon;
                    return (
                      <li key={NavItem.href}>
                        <Link
                          href={NavItem.href}
                          onClick={onCloseMobile}
                          aria-current={active ? "page" : undefined}
                          title={collapsed && !mobileOpen ? NavItem.label : undefined}
                          className={[
                            "group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                            "text-card transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card",
                            active ? "bg-card/15" : "hover:bg-card/10",
                          ].join(" ")}
                        >
                          <Icon aria-hidden="true" className="size-5 shrink-0" />
                          {(!collapsed || mobileOpen) && (
                            <span className="truncate">{NavItem.label}</span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Collapse control is intentionally keyboard accessible and desktop-only. */}
        <div className="hidden border-t border-card/20 p-3 md:block">
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand navigation rail" : "Collapse navigation rail"}
            title={collapsed ? "Expand navigation rail" : "Collapse navigation rail"}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg text-card hover:bg-card/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-card"
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-5" />
            ) : (
              <>
                <PanelLeftClose aria-hidden="true" className="size-5" />
                <span className="text-sm">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

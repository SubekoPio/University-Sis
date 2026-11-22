"use client";

// Purpose: Compose the shared desktop/mobile app shell for protected role routes.
// Used by: Student, lecturer, registrar, admissions, finance, and admin layouts.
import type { ReactNode } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { getCurrentAuthUser, subscribeToAuthState } from "@/lib/api-client";
import {
  clearActiveRole,
  getActiveRole,
  resolveSessionRoles,
  setActiveRole,
  type AppRole,
} from "@/lib/auth-role";
import { NavigationRail } from "@/components/layout/navigation-rail";
import { TopBar } from "@/components/layout/top-bar";

interface AppShellProps {
  role: AppRole;
  children: ReactNode;
}

/**
 * Applies session, role, and active-role guards around a protected workspace.
 *
 * @param props - Required role and route content.
 * @returns The full app shell or a denied/loading view.
 */
export function AppShell({ role, children }: AppShellProps) {
  const router = useRouter();
  const user = useSyncExternalStore(subscribeToAuthState, getCurrentAuthUser, () => null);
  const [resolvedRoles, setResolvedRoles] = useState<AppRole[]>([]);
  const [resolved, setResolved] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (user === null) {
      router.replace("/login");
      return;
    }
    if (user.mustChangePassword === true) {
      router.replace("/change-password");
      return;
    }

    let active = true;
    void resolveSessionRoles().then((roles) => {
      if (!active) return;
      setResolvedRoles(roles);
      if (roles.includes(role)) {
        const selected = getActiveRole();
        if (selected === null || !roles.includes(selected)) {
          setActiveRole(role);
        }
      }
      setResolved(true);
    });
    return () => {
      active = false;
    };
  }, [role, router, user]);

  useEffect(() => {
    if (user === null) clearActiveRole();
  }, [user]);

  if (user === null || user.mustChangePassword === true || !resolved) {
    return (
      <section
        aria-label="Checking workspace access"
        className="flex min-h-[calc(100svh-5rem)] items-center justify-center bg-surface"
      >
        {/* Visible loading text pairs with the icon for accessible status. */}
        <p role="status" className="flex items-center gap-2 text-sm text-ink/70">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Checking workspace access…
        </p>
      </section>
    );
  }

  if (!resolvedRoles.includes(role)) {
    return (
      <section
        aria-labelledby="forbidden-title"
        className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-3xl items-center px-4 py-10 sm:px-6"
      >
        <div className="w-full rounded-xl border border-error/20 bg-error-soft p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-error">
            403 Forbidden
          </p>
          <h1 id="forbidden-title" className="mt-2 text-2xl font-semibold text-ink">
            You cannot access this workspace
          </h1>
          <p className="mt-3 text-sm text-ink/70">
            Your account is not assigned to this role. Switch to an available role or sign in with
            another account.
          </p>
        </div>
      </section>
    );
  }

  const permissions = user.permissions ?? [];

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Major page regions remain distinct for keyboard and landmark navigation. */}
      <NavigationRail
        role={role}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        permissions={permissions}
        onToggleCollapsed={() => setCollapsed((current) => !current)}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="min-w-0 flex-1">
        <TopBar
          userName={user.email}
          roles={resolvedRoles}
          activeRole={role}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <section tabIndex={-1} className="min-h-[calc(100svh-5rem)] outline-none">
          {children}
        </section>
      </div>
    </div>
  );
}

"use client";

// Purpose: Select the admissions officer or admissions head shell role.
// Used by: The shared /admissions route family.
import type { ReactNode } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getCurrentAuthUser, subscribeToAuthState } from "@/lib/api-client";
import { resolveSessionRoles, type AppRole } from "@/lib/auth-role";
import { AppShell } from "@/components/layout/app-shell";

interface AdmissionsRoleShellProps {
  children: ReactNode;
}

/**
 * Resolves the admissions-specific role before mounting the app shell.
 *
 * @param props - Admissions route content.
 * @returns The admissions head/officer shell or a denied workspace.
 */
export function AdmissionsRoleShell({ children }: AdmissionsRoleShellProps) {
  const user = useSyncExternalStore(subscribeToAuthState, getCurrentAuthUser, () => null);
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    let active = true;
    void resolveSessionRoles().then((roles) => {
      if (!active) return;
      if (roles.includes("admissions_head")) setRole("admissions_head");
      else if (roles.includes("admissions_officer")) setRole("admissions_officer");
      else setRole(null);
    });
    return () => {
      active = false;
    };
  }, [user]);

  if (role === null) {
    return (
      <section
        aria-labelledby="forbidden-title"
        className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-3xl items-center px-4 py-10"
      >
        <div className="w-full rounded-xl border border-error/20 bg-error-soft p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-error">
            403 Forbidden
          </p>
          <h1 id="forbidden-title" className="mt-2 text-2xl font-semibold text-ink">
            Admissions access is not assigned
          </h1>
        </div>
      </section>
    );
  }

  return <AppShell role={role}>{children}</AppShell>;
}

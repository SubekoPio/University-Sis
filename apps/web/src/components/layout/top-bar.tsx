"use client";

// Purpose: Render the protected workspace top bar, profile menu, and role switcher.
// Used by: AppShell.
import { ChevronDown, LogOut, Menu, Settings, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import type { AppRole } from "@/lib/auth-role";
import { getRoleRoute, setActiveRole } from "@/lib/auth-role";
import { logout } from "@/lib/api-client";

interface TopBarProps {
  userName: string;
  roles: readonly AppRole[];
  activeRole: AppRole;
  onOpenMobile: () => void;
}

/** Formats role names for readable profile and switcher labels. */
function roleLabel(role: AppRole): string {
  const labels: Record<AppRole, string> = {
    student: "Student",
    lecturer: "Lecturer",
    registrar: "Registrar",
    admin: "Administrator",
    admissions_officer: "Admissions officer",
    admissions_head: "Admissions head",
    bursar: "Bursar",
  };
  return labels[role];
}

/**
 * Renders the current intake, mobile menu trigger, role switcher, and profile menu.
 *
 * @param props - Account, roles, and mobile drawer callback.
 * @returns A branded top navigation bar.
 */
export function TopBar({ userName, roles, activeRole, onOpenMobile }: TopBarProps) {
  const router = useRouter();

  async function signOut(): Promise<void> {
    await logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-card px-4 sm:px-6">
      {/* Mobile navigation trigger is the only menu control that appears on small screens. */}
      <button
        type="button"
        onClick={onOpenMobile}
        aria-label="Open navigation"
        className="grid size-10 place-items-center rounded-lg text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      {/* Current academic context remains visible across protected workspaces. */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">2026/2027</p>
        <p className="truncate text-xs text-ink/65">Current intake: Intake 1</p>
      </div>

      {/* Multi-role users can switch their active role without changing account identity. */}
      {roles.length > 1 && (
        <label className="hidden items-center gap-2 sm:flex">
          <span className="text-xs font-medium text-ink/70">Role</span>
          <select
            value={activeRole}
            onChange={(event) => {
              if (event.target.value === activeRole) return;
              if (!isAppRoleString(event.target.value)) return;
              setActiveRole(event.target.value);
              router.replace(getRoleRoute(event.target.value));
            }}
            className="h-9 rounded-lg border border-field bg-card px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Native details keeps the profile menu keyboard and pointer accessible. */}
      <details className="group relative">
        <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-1 text-ink outline-none hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <span className="grid size-9 place-items-center rounded-full bg-brand text-sm font-semibold text-card">
            {userName.slice(0, 1).toUpperCase()}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 transition-transform group-open:rotate-180"
          />
          <span className="sr-only">Open profile menu</span>
        </summary>
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-card p-2 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => router.push("/profile")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <UserRound aria-hidden="true" className="size-4" />
            Profile
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => router.push("/settings")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Settings aria-hidden="true" className="size-4" />
            Settings
          </button>
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-error hover:bg-error-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Sign out
          </button>
        </div>
      </details>
    </header>
  );
}

/** Type guard shared by the role switcher. */
function isAppRoleString(value: string): value is AppRole {
  return (
    value === "student" ||
    value === "lecturer" ||
    value === "registrar" ||
    value === "admin" ||
    value === "admissions_officer" ||
    value === "admissions_head" ||
    value === "bursar"
  );
}

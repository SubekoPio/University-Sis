// Purpose: Resolve role redirects and frontend route authorization from the auth session.
// Used by: Login, app shell, role layouts, and profile role switching.
import { apiRequest, getAuthSession, updateAuthAuthorization } from "@/lib/api-client";

/** Application roles represented by the shared web shell. */
export type AppRole =
  | "student"
  | "lecturer"
  | "registrar"
  | "admin"
  | "admissions_officer"
  | "admissions_head"
  | "bursar";

const ACTIVE_ROLE_KEY = "university-sis.active-role";

/** Maps an application role to its protected route prefix. */
export function getRoleRoute(role: AppRole): string {
  const routes: Record<AppRole, string> = {
    student: "/student",
    lecturer: "/lecturer",
    registrar: "/registrar",
    admin: "/admin",
    admissions_officer: "/admissions",
    admissions_head: "/admissions",
    bursar: "/finance",
  };
  return routes[role];
}

/**
 * Chooses the highest-priority role destination for a multi-role session.
 *
 * @param roles - Roles carried or resolved for the current account.
 * @returns A role-safe route, or null when no role could be identified.
 */
export function getDefaultRoleRoute(roles: readonly AppRole[]): string | null {
  const priority: readonly AppRole[] = [
    "admin",
    "registrar",
    "admissions_head",
    "admissions_officer",
    "bursar",
    "lecturer",
    "student",
  ];
  const selected = priority.find((role) => roles.includes(role));
  return selected === undefined ? null : getRoleRoute(selected);
}

/** Stores the role selected by a multi-role account. */
export function setActiveRole(role: AppRole): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(ACTIVE_ROLE_KEY, role);
  }
}

/** Reads the role selected by a multi-role account. */
export function getActiveRole(): AppRole | null {
  if (typeof window === "undefined") {
    return null;
  }
  const role = window.sessionStorage.getItem(ACTIVE_ROLE_KEY);
  return isAppRole(role) ? role : null;
}

/** Clears the selected role when the auth session ends. */
export function clearActiveRole(): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(ACTIVE_ROLE_KEY);
  }
}

/**
 * Resolves roles from optional login claims or read-only role home endpoints.
 * It never assumes that UI access is server authorization.
 *
 * @returns Unique roles inferred for the browser session.
 */
export async function resolveSessionRoles(): Promise<AppRole[]> {
  const session = getAuthSession();
  if (session === null) {
    return [];
  }

  const claimedRoles = session.user.roles?.filter(isAppRole) ?? [];
  const claimedPermissions = session.user.permissions ?? [];
  if (claimedRoles.length > 0) {
    return claimedRoles;
  }

  // A future login payload may expose permissions before role names. Keep these
  // mappings explicit and separate from UI hiding.
  const permissionRoles: AppRole[] = [];
  if (claimedPermissions.includes("academic:unit:select")) permissionRoles.push("student");
  if (claimedPermissions.includes("academic:session:manage")) permissionRoles.push("lecturer");
  if (claimedPermissions.includes("academic:structure:manage")) permissionRoles.push("registrar");
  if (claimedPermissions.includes("admin:user:manage")) permissionRoles.push("admin");
  if (claimedPermissions.includes("admissions:application:manage")) {
    permissionRoles.push("admissions_officer");
  }
  if (claimedPermissions.includes("admissions:admit")) permissionRoles.push("admissions_head");
  if (claimedPermissions.includes("admissions:fee:confirm")) permissionRoles.push("bursar");

  if (permissionRoles.length > 0) {
    const unique = [...new Set(permissionRoles)];
    updateAuthAuthorization({ roles: unique, permissions: claimedPermissions });
    return unique;
  }

  const probes: ReadonlyArray<{ role: AppRole; path: string }> = [
    { role: "student", path: "/student/me/home" },
    { role: "lecturer", path: "/lecturer/me/home" },
    { role: "registrar", path: "/academic/me/home" },
    { role: "admin", path: "/admin/users" },
  ];
  const resolved: AppRole[] = [];
  for (const probe of probes) {
    try {
      await apiRequest(probe.path);
      resolved.push(probe.role);
    } catch {
      // A denied or unavailable probe does not identify the account as that role.
    }
  }

  if (resolved.length > 0) {
    updateAuthAuthorization({ roles: resolved, permissions: [] });
  }
  return resolved;
}

/** Checks whether a string belongs to one of the web shell's role names. */
export function isAppRole(value: unknown): value is AppRole {
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

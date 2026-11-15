// Purpose: Apply the RBAC matrix's OWN record-scope rule.
import type { AuthenticatedUser } from "./rbac.types.js";

/** Returns whether a resource belongs to the authenticated user. */
export function isOwnResource(
  resourceOwnerId: string | null | undefined,
  currentUser: AuthenticatedUser | null | undefined,
): boolean {
  return (
    currentUser !== null &&
    currentUser !== undefined &&
    resourceOwnerId !== null &&
    resourceOwnerId !== undefined &&
    resourceOwnerId === currentUser.id
  );
}

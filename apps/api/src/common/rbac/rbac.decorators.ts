// Purpose: Attach role and permission requirements to controller metadata.
import { SetMetadata } from "@nestjs/common";

/** Metadata key consumed by RolesGuard. */
export const ROLES_METADATA_KEY = "rbac:roles";

/** Metadata key consumed by PermissionsGuard. */
export const PERMISSIONS_METADATA_KEY = "rbac:permissions";

/** Declares roles allowed to access a handler; any listed role is sufficient. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_METADATA_KEY, roles);

/** Declares permission keys that must all be granted to access a handler. */
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);

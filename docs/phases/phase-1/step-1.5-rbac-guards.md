# Phase 1 / Step 1.5: RBAC Guards

## Goal

Add reusable access-token authentication, role and permission decorators and
guards, Redis-cached authorization resolution, and the RBAC matrix's `OWN`
resource-scope helper without applying guards to existing controllers.

## What Was Built

- Added `@Roles()`, `@Permissions()`, and `@CurrentUser()` metadata/parameter
  decorators.
- Added `JwtAuthGuard`, which verifies HS256 access tokens, checks required
  claims, verifies the session is active, and sets the request user.
- Added `RolesGuard` and `PermissionsGuard`; both deny requests when their
  required metadata or authenticated user is missing.
- Added a Prisma repository and authorization service that resolve role names
  and permission keys through the existing `UserRole` and `RolePermission`
  relations.
- Added Redis-backed caching of each user's roles and effective permissions.
- Added `isOwnResource()` to compare a resource owner ID with the current user.
- Registered the RBAC module in the application without applying its guards to
  any controller.

### Files created or changed

- `apps/api/src/common/rbac/rbac.decorators.ts`,
  `apps/api/src/common/rbac/current-user.decorator.ts`,
  `apps/api/src/common/rbac/jwt-auth.guard.ts`,
  `apps/api/src/common/rbac/roles.guard.ts`,
  `apps/api/src/common/rbac/permissions.guard.ts`,
  `apps/api/src/common/rbac/own-scope.ts`
- `apps/api/src/common/rbac/rbac.types.ts`,
  `apps/api/src/common/rbac/rbac.repository.ts`,
  `apps/api/src/common/rbac/rbac.service.ts`,
  `apps/api/src/common/rbac/redis-cache.service.ts`,
  `apps/api/src/common/rbac/rbac.module.ts`
- `apps/api/src/app.module.ts`, `apps/api/src/auth/auth.module.ts`,
  `.env.example`, `apps/api/package.json`, `pnpm-lock.yaml`

## Key Decisions

- Permission snapshots are cached for 60 seconds by default. Configure this
  with `RBAC_CACHE_TTL_SECONDS`; provide `REDIS_URL` or use `REDIS_PORT` on
  localhost.
- Redis connection and cache failures are not bypassed with database-only or
  allow-all fallbacks.
- Role checks accept any one required role; permission checks require all
  declared permission keys.
- Active session validation checks the database so logout, refresh-token reuse
  revocation, expired sessions, and inactive accounts invalidate access tokens
  immediately.
- This is opt-in infrastructure; no production controller is protected by
  these guards yet. The E2E tests use test-only protected routes.

## Business Rules

- Unannotated or empty role/permission requirements are denied by their
  respective guards.
- `@CurrentUser()` rejects requests without an authenticated identity.
- `isOwnResource()` returns `false` when either the owner or current user is
  absent; it grants scope only for an exact user-ID match.
- Role and permission values are resolved from persisted role grants rather
  than trusted from JWT claims.

## How to Run & Test

- Start Redis with `docker compose up -d redis` and configure `REDIS_URL` or
  `REDIS_PORT` in the repository-root `.env`.
- `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
- `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
- `corepack pnpm@12.21.0 --filter @school/api build` — passed.
- Guard and protected-route tests are recorded in Phase 1 / Step 1.7.

## Data/Permissions Impact

No Prisma schema, migration, seed, or RBAC matrix changes. Authorization reads
the roles and permissions already represented by the persisted schema.

## Known Limitations

- Guards are available through `RbacModule` but are intentionally not applied
  to the existing authentication controller or any other controller.
- Role/permission cache entries expire after the configured TTL; no role-change
  mutation flow currently performs immediate cache invalidation.
- The `OWN` helper is not wired into a production resource query or endpoint.

## Copilot Usage

Copilot implemented the RBAC components against the current Prisma schema and
RBAC matrix. Guard defaults, Redis failure behavior, and session revocation
checks were reviewed to ensure missing or unavailable authorization state does
not grant access.

The implementation corresponds to the proposed decision in
[`0002-rbac-enforcement.md`](../../adr/0002-rbac-enforcement.md).

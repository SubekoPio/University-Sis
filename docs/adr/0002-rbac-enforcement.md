# ADR 0002: Resolve RBAC from Persisted Grants

- **Status:** Proposed
- **Date:** 2026-11-15

## Context

The permission matrix defines role and record-scope policy. The API needs to
resolve effective grants from persisted assignments while avoiding an
allow-all fallback when authorization data is absent or unavailable.

## Decision

Resolve role names and permission keys through `UserRole` and `RolePermission`
records. Use the `JwtAuthGuard` to validate the access JWT and its active
session, then use explicit role or permission metadata with `RolesGuard` and
`PermissionsGuard`. A role requirement accepts any declared role; a permission
requirement requires every declared permission. Cache effective grants in
Redis for 60 seconds by default, configurable through
`RBAC_CACHE_TTL_SECONDS`.

Treat missing guard requirements and Redis failures as denial/error, not as a
database-only or allow-all fallback. Keep `OWN` record checks in the owning
service/query; `isOwnResource()` is only a comparison helper.

## Alternatives

- **Trust role/permission claims embedded in the access JWT:** rejected because
  grant changes would remain stale until the token expires.
- **Query the database for every grant resolution:** not selected because it
  adds repeated role/permission joins to the request path.
- **Allow requests when Redis is unavailable:** rejected because cache
  unavailability must not grant access.

## Consequences

- Grant updates may take up to the configured cache TTL to become visible;
  there is no role-change mutation flow that immediately invalidates cache
  entries.
- Redis availability is required by the current application module at startup.
- The guards are opt-in and are not yet applied to production controllers.
  Test-only protected routes exercise them; production route coverage remains
  future work.
- The institution boundary and administrative audit requirements in
  `docs/RBAC_MATRIX.md` are not backed by current tenant or audit models.

The current implementation is in `apps/api/src/common/rbac/`.

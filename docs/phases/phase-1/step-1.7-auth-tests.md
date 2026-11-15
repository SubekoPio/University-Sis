# Phase 1 / Step 1.7: Authentication Tests

## Goal

Add isolated tests for the auth service and password hashing behavior without
requiring a database or exposing HTTP endpoints.

## What Was Built

- Added auth service, password-hashing, recovery repository/service, controller,
  Mailpit provider, and Supertest coverage.
- Added tests for login success/failure, refresh rotation and reuse detection,
  expiry, logout, reset-token single use, verified-email gating, enumeration-
  safe recovery, validation/throttling, and role-restricted test routes.
- Mocked email delivery and persistence; E2E protected routes exist only in the
  test module.

### Files created or changed

- `apps/api/src/auth/auth.service.spec.ts`,
  `apps/api/src/auth/password-hashing.service.spec.ts`,
  `apps/api/src/auth/auth.controller.spec.ts`,
  `apps/api/src/auth/password-recovery.repository.spec.ts`,
  `apps/api/src/auth/password-recovery.service.spec.ts`,
  `apps/api/src/auth/email/mailpit-email.service.spec.ts`
- `apps/api/src/auth/auth.e2e-spec.ts`,
  `apps/api/vitest.config.e2e.ts`,
  `apps/api/package.json`

## Key Decisions

- The API package uses Vitest (rather than Jest) and Supertest; tests use
  mocked persistence/provider dependencies and an in-memory Nest app.
- The E2E suite uses the production auth controller and guards with test-only
  protected controllers.

## Business Rules

- Registration sends only a password hash to user persistence and omits the
  hash from the returned user.
- Login stores a refresh-token digest, not the bearer token, and signs a
  short-lived access JWT.
- Refresh reuse is rejected and revokes remaining active user sessions.
- Logout revokes only the session associated with the supplied refresh token.
- Missing/expired authentication returns 401; authenticated requests without
  the required role return 403.

## How to Run & Test

- `corepack pnpm@12.21.0 --filter @school/api exec vitest run src/auth` —
  passed; 6 files, 28 tests.
- `corepack pnpm@12.21.0 --filter @school/api exec vitest run --config vitest.config.e2e.ts` — passed; 1 file, 6 tests.
- `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
- `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
- `corepack pnpm@12.21.0 --filter @school/api build` — passed.

## Data/Permissions Impact

No schema, migration, seed, or permission changes. Tests mock repositories and
do not modify persistent data.

## Known Limitations

- Guard and access-token behavior is tested with in-memory dependencies and
  test-only routes, not against live Redis or PostgreSQL.
- Email and database dependencies are mocked; no external provider or live
  migration is exercised.

## Copilot Usage

Copilot added tests against the service contracts implemented in Phase 1 /
Steps 1.3–1.6. Test scope was reviewed to ensure cases use isolated fakes and
do not depend on local credentials or external services.

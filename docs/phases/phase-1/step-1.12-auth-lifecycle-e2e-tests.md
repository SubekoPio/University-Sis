# Phase 1 / Step 1.12: Auth Lifecycle and E2E Tests

## Goal

Add focused unit and Supertest coverage for authentication, refresh-token
lifecycle, password-reset single use, and protected-route authorization without
changing production code.

## What Was Built

- Extended `AuthService` tests for invalid-password login and expired refresh
  tokens, alongside the existing login, rotation, and reuse cases.
- Added a password-reset repository test proving a token can be consumed only
  once.
- Added Supertest coverage for login success/failure, refresh rotation and
  reuse, logout, expired access tokens, unauthenticated protected requests, and
  role-restricted access.
- Mocked the email provider and persistence dependencies in the E2E test app;
  test-only protected controllers are not part of production modules.

## Key Decisions

- The API package is configured for Vitest, so the tests use Vitest APIs and
  Supertest rather than introducing a separate Jest runner.
- The E2E app uses the real auth controller, services, JWT verification guard,
  and roles guard with in-memory dependency fakes.

## Business Rules

- Invalid credentials and expired refresh tokens cannot create or retain
  authenticated sessions.
- A rotated refresh token differs from the original; reuse of the original is
  rejected.
- Password reset persistence accepts a token claim once and performs no second
  password or session update.
- Missing/expired authentication returns 401; an authenticated user without
  the required role receives 403.

## How to Run & Test

- `corepack pnpm@12.21.0 --filter @school/api exec vitest run src/auth` —
  passed; 6 files, 28 tests.
- `corepack pnpm@12.21.0 --filter @school/api exec vitest run --config vitest.config.e2e.ts` —
  passed; 1 file, 6 tests.
- `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
- `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
- `corepack pnpm@12.21.0 exec prettier --check apps/api/src/auth` — passed.

## Data/Permissions Impact

No schema, migration, seed, permission, or production route changes. E2E
protected routes exist only inside the test module, and all persistence and
email dependencies are mocked.

## Known Limitations

- Tests do not exercise PostgreSQL transaction isolation or a real Redis
  authorization cache.
- No production-code bug was exposed by these tests; this is not a full security
  or database integration audit.

## Copilot Usage

Copilot added tests against the existing auth contracts and reviewed the
test-only routes to ensure they cannot be registered by the production module.

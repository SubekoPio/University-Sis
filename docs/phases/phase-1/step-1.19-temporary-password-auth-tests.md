<!-- Purpose: Document tests for forced temporary-password authentication behavior. -->

# Phase 1 / Step 1.19: Temporary-Password Authentication Tests

## Goal

Verify the public registration removal and the behavior of administrator-issued
temporary credentials through service, repository, controller, and HTTP tests.

## What Was Built

- Extended auth service tests for expired login, refresh restrictions, password
  reuse rejection, successful changes, and expired changes.
- Updated controller tests for the registration 404, change-password
  delegation, DTO validation, and rate limiting.
- Added repository tests for atomic password-state updates, email verification,
  active-session preservation, and revoking other sessions.
- Extended HTTP tests for `MUST_CHANGE_PASSWORD`, logout allowance, and expired
  temporary-password guidance.

## Key Decisions

- Tests use the existing Vitest, Nest testing-module, and Supertest patterns.
- Repository behavior is verified through Prisma transaction mocks; no live
  database or migration is required.
- HTTP tests run the optional temporary-password guard alongside the existing
  JWT guard to confirm the restriction crosses public and protected routes.

## Business Rules

- `POST /auth/register` is absent and returns 404.
- An expired temporary password cannot create a session or be changed without
  administrator assistance.
- A forced-change session receives `MUST_CHANGE_PASSWORD` on all disallowed
  endpoints, while logout and the throttled password-change route remain
  available.
- A password change rejects reuse, marks email verified, clears temporary
  state, preserves the current session, and revokes other sessions.

## How to Run & Test

- From `apps/api`, `corepack pnpm@12.21.0 run test` — passed (10 files, 58 tests).
- From `apps/api`, `corepack pnpm@12.21.0 run test:e2e -- src\auth\auth.e2e-spec.ts` — passed (1 file, 8 tests).
- From `apps/api`, `corepack pnpm@12.21.0 run typecheck` — passed.
- From `apps/api`, `corepack pnpm@12.21.0 run lint` — passed.
- From `apps/api`, `corepack pnpm@12.21.0 run build` — passed.
- Prettier check for changed source, test, and documentation files — passed.

## Data/Permissions Impact

No schema, migration, seed, or permission changes. The tests validate the
existing `User` lifecycle fields and session behavior.

## Known Limitations

The repository tests mock Prisma transactions; database integration remains
dependent on the separately managed PostgreSQL environment.

## Copilot Usage

Copilot added focused tests after the implementation step and ran the API unit,
HTTP, type-check, lint, build, and formatting checks.

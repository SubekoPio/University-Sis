<!-- Purpose: Record regression and E2E coverage for Phase 1 account lifecycle behavior. -->

# Phase 1 / Step 1.14: Authentication and Account Lifecycle Tests

## Goal

Verify admin account provisioning, forced password changes, expiry,
deactivation, permissions, and HTTP behavior without adding production logic.

## What Was Built

- Added service and repository coverage for random temporary credentials,
  email failure, audit records, session revocation, and lifecycle safeguards.
- Added auth tests for removed registration, expiry, password reuse, allowed
  forced-change routes, and session revocation.
- Added controller and E2E coverage for user management, including denied
  non-admin access and admin create/list/role/deactivate workflows.

## Key Decisions

- Used the existing Vitest and Supertest patterns. Repository tests mock Prisma
  transactions; HTTP E2E tests use in-memory persistence.
- Kept tests separate from their implementation steps.

## Business Rules

- `POST /auth/register` returns 404; expired temporary credentials are denied.
- Forced-change sessions may change password or log out, but otherwise receive
  `MUST_CHANGE_PASSWORD`.
- Admin routes require `admin:user:manage`; users cannot deactivate themselves.
- Email failure preserves the created account for credential resend.

## How to Run & Test

Run from `apps/api`:

- `corepack pnpm@12.21.0 run test` — passed (11 files, 64 tests).
- `corepack pnpm@12.21.0 run test:e2e` — passed (3 files, 11 tests).
- `corepack pnpm@12.21.0 run typecheck` — passed.
- `corepack pnpm@12.21.0 run lint` — passed.
- `node .github/scripts/check-permissions-matrix.mjs` — passed; checked one
  `@Permissions` decorator across the repository TypeScript files.

## Data/Permissions Impact

No schema, seed, permission, or runtime changes. Tests exercise the
`admin:user:manage` permission and existing User lifecycle fields.

## Known Limitations

Repository tests mock Prisma transactions; they do not prove migration
application or behavior against a live database.

## Copilot Usage

Copilot added focused tests and ran the API unit, E2E, typecheck, lint, and
permission-matrix checks. Test results are reported as recorded by the
implementation session.

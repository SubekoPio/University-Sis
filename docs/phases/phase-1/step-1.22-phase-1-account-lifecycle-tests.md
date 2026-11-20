<!-- Purpose: Record Phase 1 account lifecycle unit and HTTP end-to-end coverage. -->

# Phase 1 / Step 1.22: Account Lifecycle and Administration Tests

## Goal

Verify Phase 1 account provisioning, forced password changes, session revocation,
and administrator user-management behavior without changing production code.

## What Was Built

- Extended `admin-users.service.spec.ts` to assert forced-password-change state,
  distinct URL-safe temporary credentials, and credential resend persistence
  before delivery.
- Added `auth/phase1-updates.e2e-spec.ts` to verify registration returns 404,
  forced-password sessions are restricted, logout and password change remain
  available, normal access resumes after the change, and other sessions are
  revoked.
- Added `users/admin-users.e2e-spec.ts` to verify non-admin requests receive
  403 and an administrator can create, list, change roles, and deactivate an
  account.
- Retained existing coverage for email delivery failure without account
  rollback, credential and deactivation session revocation, self-deactivation
  denial, and expired temporary-password rejection.

## Key Decisions

- Added new E2E spec files rather than editing existing auth test files. The
  existing auth controller test already verifies the registration route returns 404.
- Used HTTP requests with real JWT and permission guards; in-memory persistence
  doubles keep these tests isolated from external services.
- Kept atomic Prisma behavior covered by the existing focused repository tests.

## Business Rules

- Admin-created accounts require a forced password change and receive distinct
  temporary credentials through email; delivery failure leaves the account
  available for resend.
- Forced-change sessions cannot access ordinary or recovery routes; successful
  password changes keep the current session and revoke other sessions.
- Only a caller with `admin:user:manage` can use administrator account routes.
- Self-deactivation is denied, and deactivation revokes active sessions.

## How to Run & Test

Run these commands from `apps/api`:

- `corepack pnpm@12.21.0 run test` — passed (11 test files, 64 tests).
- `corepack pnpm@12.21.0 run test:e2e` — passed (3 test files, 11 tests).
- `corepack pnpm@12.21.0 run typecheck` — passed.
- `corepack pnpm@12.21.0 run lint` — passed.

## Data/Permissions Impact

No schema, migration, seed, permission, or production-code changes. Tests use
the existing `admin:user:manage` permission.

## Known Limitations

The HTTP E2E suites use in-memory repository doubles; Prisma transaction
semantics are verified by the existing repository unit tests. No production
bugs were identified by these tests.

## Copilot Usage

Copilot added the focused service assertions and new HTTP E2E suites, preserved
the existing auth test files, ran the API unit and E2E suites, typecheck, and
lint, and recorded the results here.

# Phase 1 / Step 1.9: Account Recovery Tests

## Goal

Verify the recovery and email-verification behavior from Phase 1 / Step 1.6
with isolated API tests that do not require PostgreSQL, Redis, or Resend.

## What Was Built

- Extended auth service tests for registration-time verification delivery and
  the unverified-email login gate.
- Added recovery service tests for hashed tokens, one-hour and 24-hour
  expirations, generic forgot-password results during provider errors, and
  invalid-token rejection.
- Added repository transaction tests for password updates and revoking active
  sessions, including a failed conditional token claim.
- Extended controller tests for recovery/verification delegation, DTO
  validation, and resend-verification throttling.

## Key Decisions

- Use the API's existing Vitest and Nest testing-module patterns with mocked
  repositories, email service, and Prisma transaction client.
- Keep provider/network and live-database behavior outside the unit-test scope.

## Business Rules

- Unverified accounts cannot create login sessions.
- Email content exposes raw one-time tokens only to the mocked transport; the
  repository receives token digests.
- A successful password reset updates the password and revokes active sessions
  together; a failed token claim performs neither update.
- Forgot-password responses remain the same when email delivery fails, and
  resend-verification is throttled.

## How to Run & Test

- `corepack pnpm@12.21.0 --filter @school/api exec vitest run src/auth` —
  passed; 5 files, 21 tests.
- `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
- `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
- `corepack pnpm@12.21.0 exec prettier --check apps/api/src/auth docs/phases/phase-1/step-1.6-password-recovery-email-verification.md docs/phases/phase-1/step-1.9-account-recovery-tests.md` — passed.

## Data/Permissions Impact

No schema, migration, seed, or permission changes in this test step. Tests use
in-memory mocks and do not connect to persistent services.

## Known Limitations

- Tests do not exercise a live PostgreSQL transaction, an actual Resend
  request, or an end-to-end migration application.

## Copilot Usage

Copilot added behavior-focused tests against the Phase 1 / Step 1.6 workflows.
Test fixtures and assertions were reviewed to ensure secrets are not logged and
tests remain independent of external services.

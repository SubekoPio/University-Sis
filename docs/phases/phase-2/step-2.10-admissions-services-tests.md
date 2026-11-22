<!-- Purpose: Record the separately scoped Phase 2.10 admissions service tests. -->

# Phase 2 / Step 2.10: Admissions Services Tests

## Goal

Verify admissions eligibility, transactional writes, fee handling, security,
credential delivery, and the website integration boundaries independently of
the feature implementation step.

## What Was Built

- Added focused unit tests for website idempotency, document approval, fee
  threshold and duplicate handling, fee maker-checker behavior, admission
  gating and separation of duties, and API-key/HMAC validation.
- Added repository coverage for creating the student profile, admission,
  programme enrollment, intake registration, and prompted curriculum through
  the caller's transaction.
- Added account-service and repository tests for student-role provisioning,
  failed post-commit credential email auditing, and credential resend.

## Key Decisions

- Tests use deterministic fixtures and mocked Prisma, RBAC, and email services;
  no database or external provider is required.
- Admission credential email ordering is asserted relative to the transaction
  callback's successful completion, including the failure outcome.

## Business Rules

- A missing required document or fee prevents admission; no user who approved
  any application document may admit the same application.
- Optional `OTHER` document rejection does not block approval.
- Fee values are validated as integer minor units, exact configured amounts
  confirm the fee, duplicate bank references conflict, and recorders cannot
  void their own deposits.
- Invalid API keys and signatures fail closed, while valid API keys and HMACs
  are accepted.

## How to Run & Test

- `corepack pnpm@12.21.0 --filter @school/api exec vitest run src/admissions/admissions.service.spec.ts src/admissions/admissions.repository.spec.ts src/admissions/website-integration.guard.spec.ts src/users/admin-users.service.spec.ts src/users/admin-users.repository.spec.ts` — passed; 5 files and 37 tests.
- `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
- `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
- `corepack pnpm@12.21.0 --filter @school/api exec prettier --check --print-width 100 src/admissions` — passed.
- `git diff --check` — passed.

## Data/Permissions Impact

No schema, migration, seed, or permission changes. Tests cover the existing
admissions permission keys and repository contracts.

## Known Limitations

The website's per-IP rate limit is configured on the controller; this focused
unit suite tests its guard authentication but does not exercise repeated HTTP
requests against the throttler.

## Copilot Usage

Tests were written after the admissions implementation and were reviewed
against the canonical RBAC matrix, database schema, and API test conventions.

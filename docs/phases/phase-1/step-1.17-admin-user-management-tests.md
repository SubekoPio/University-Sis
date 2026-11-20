<!-- Purpose: Record focused tests for administrator user-management behavior. -->

# Phase 1 / Step 1.17: Administrator User-Management Tests

## Goal

Verify administrator user-management behavior independently from the Step 1.16
implementation, including permission checks, credential handling, audit writes,
session revocation, and lifecycle safeguards.

## What Was Built

- Added `admin-users.service.spec.ts` for temporary credentials, email failures,
  permission-based authorization, role changes, self-protection, and listing.
- Added `admin-users.repository.spec.ts` for atomic credential rotation,
  session revocation, deactivation, and role-change audit records.

## Key Decisions

- Tests use the API's existing Vitest and Nest testing-module patterns.
- Repository tests mock Prisma transactions and do not require a live database.
- Plain temporary passwords are inspected only in test memory to verify the
  email content; they are not returned or persisted.

## Business Rules

- Users without `admin:user:manage` are denied even if a role label suggests
  administrator access.
- Admin-capability changes require a separate second administrator; an
  administrator also cannot remove their own administrator access.
- Failed credential delivery leaves the account available for resend and
  records a failure event without returning the temporary password.
- Resending credentials and deactivation revoke active sessions; lifecycle
  reasons and role deltas are audited.

## How to Run & Test

- From `apps/api`, `corepack pnpm@12.21.0 exec vitest run src/users/admin-users.service.spec.ts src/users/admin-users.repository.spec.ts` — passed (2 files, 14 tests).
- From `apps/api`, `corepack pnpm@12.21.0 run test` — passed (9 files, 47 tests).
- `node --test .github/scripts/check-permissions-matrix.test.mjs` — passed (4 tests).
- `node .github/scripts/check-permissions-matrix.mjs` — passed (0 permission decorators currently exist to inspect).
- From `apps/api`, `corepack pnpm@12.21.0 run typecheck` — passed.
- From `apps/api`, `corepack pnpm@12.21.0 run lint` — passed.
- From `apps/api`, `corepack pnpm@12.21.0 run build` — passed.
- `corepack pnpm@12.21.0 exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --types node prisma/seed.ts` — passed.

## Data/Permissions Impact

No schema, seed, or permission changes were made in this test step. The tests
exercise the Step 1.16 service and repository contracts.

## Known Limitations

- There is no admin-user controller yet, so these tests do not cover HTTP
  routing or `@Permissions` guards for this feature.
- Prisma-backed behavior is tested with transaction mocks; database migration
  execution remains a separate operational step.

## Copilot Usage

Copilot added focused unit/repository tests, ran the API regression suite and
RBAC checker, and reviewed the resulting test and permission behavior.

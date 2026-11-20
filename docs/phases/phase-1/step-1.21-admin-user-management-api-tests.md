<!-- Purpose: Record controller-level tests for the administrator user-management API. -->

# Phase 1 / Step 1.21: Administrator User-Management API Tests

## Goal

Verify the administrator user-management HTTP adapter in a separate test step
from its implementation.

## What Was Built

- Added focused Supertest coverage in
  `apps/api/src/users/admin-users.controller.spec.ts`.
- Verified delegation for all six endpoints, including authenticated actor IDs,
  transformed query pagination, and request DTO validation.
- Verified the controller declares JWT and permission guards and the
  `admin:user:manage` permission.
- Verified generated OpenAPI request schemas, bearer authorization, summaries,
  and query parameters.
- Exercised the real resend throttler and confirmed the sixth request in a
  minute is rejected before service delegation.

## Key Decisions

- Kept tests separate from the controller implementation step, consistent with
  the API test instructions.
- Replaced JWT and permission guard behavior with test doubles so these tests
  focus on the HTTP adapter; separately asserted the controller's guard and
  permission metadata.
- Kept the actual throttler active to verify the configured endpoint limit
  over HTTP.

## Business Rules

- All tested service calls receive the authenticated administrator's ID.
- Request validation rejects malformed emails, invalid user IDs, and invalid
  pagination before service calls.
- Credential resends are limited to five per minute.

## How to Run & Test

Run these commands from `apps/api`:

- `corepack pnpm@12.21.0 exec vitest run src/users/admin-users.controller.spec.ts`
  — passed (1 test file, 4 tests).
- `corepack pnpm@12.21.0 run test` — passed (11 test files, 62 tests).
- `corepack pnpm@12.21.0 run typecheck` — passed.
- `corepack pnpm@12.21.0 run lint` — passed.

## Data/Permissions Impact

No schema, migration, seed, permission, or runtime behavior changes. Tests
assert the existing `admin:user:manage` controller metadata.

## Known Limitations

JWT and permission enforcement are represented by guard metadata assertions in
this controller suite; the guards themselves are replaced with test doubles.
The resend throttler remains enabled and is tested with real HTTP requests.

## Copilot Usage

Copilot added and reviewed the focused test file, ran the API test suite,
typecheck, and lint, and recorded the results in this step document.

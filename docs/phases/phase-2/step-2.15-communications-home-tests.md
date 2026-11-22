<!-- Purpose: Record Phase 2.15 service tests separately from implementation. -->

# Phase 2 / Step 2.15: Communications and Home Service Tests

## Goal

Verify announcement, calendar, storage, home aggregation, cache, and cache
invalidation behavior in a test step separate from implementation.

## What Was Tested

- Server-side removal of executable announcement markup, image key persistence
  through the storage abstraction, and rejection of lecturer announcements for
  offerings outside their assignment scope.
- Calendar inclusion of institution-wide events, selected-offering sessions,
  and registered provider events; exclusion of unrelated audiences; omission of
  meeting URLs; and rejection of ranges longer than 62 days.
- Student home `canAttend` behavior for an online student whose next online
  session falls within the attendance window, plus reuse of a valid cached
  response.
- The home cache's per-user key, 60-second expiration, and explicit
  invalidation after unit selection, unit drops, and attendance computation.
- MinIO rejection of image bytes with a mismatched signature and traversal-like
  object keys, plus required storage configuration validation.

## How to Run & Test

- `corepack pnpm@12.21.0 --filter @school/api exec vitest run src/academic/announcements-calendar.service.spec.ts src/academic/home.service.spec.ts src/academic/home-cache.service.spec.ts src/storage/minio-storage.service.spec.ts src/academic/attendance.service.spec.ts src/academic/unit-selection.service.spec.ts src/config/environment.config.spec.ts` — passed; 7 files and 37 tests.
- `corepack pnpm@12.21.0 --filter @school/api test` — passed; 28 files and 152 tests.
- `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
- `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
- `corepack pnpm@12.21.0 --filter @school/api build` — passed.
- `corepack pnpm@12.21.0 exec prettier --config .prettierrc.json --check "apps/api/src/academic/announcements*.ts" "apps/api/src/academic/calendar*.ts" "apps/api/src/academic/communications*.ts" "apps/api/src/academic/home*.ts" "apps/api/src/storage/*.ts" apps/api/src/academic/academic.module.ts apps/api/src/academic/attendance.repository.ts apps/api/src/academic/attendance.service.ts apps/api/src/academic/attendance.service.spec.ts apps/api/src/academic/unit-selection.service.ts apps/api/src/academic/unit-selection.service.spec.ts apps/api/src/common/rbac/rbac-core.module.ts apps/api/src/config/environment.config.ts apps/api/src/config/environment.config.spec.ts` — passed.
- `corepack pnpm@12.21.0 exec prettier --config .prettierrc.json --check docs/DEVELOPMENT_LOG.md docs/phases/phase-2/step-2.15-communications-home-services.md docs/phases/phase-2/step-2.15-communications-home-tests.md` — passed.
- `git diff --check` — passed.

## Data/Permissions Impact

No persisted data or permissions changed. Tests verify lecturer own-offering
scope and existing self-scoped home access.

## Copilot Usage

Tests were added separately from implementation, following the API Vitest
patterns and canonical RBAC and schema contracts.

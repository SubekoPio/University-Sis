<!-- Purpose: Record Phase 2.14 attendance-engine behavioral tests separately. -->

# Phase 2 / Step 2.14: Attendance Engine Tests

## Goal

Verify continuous-presence boundaries and attendance-service workflows in a
separate test step from the Phase 2.14 implementation.

## What Was Tested

- Continuous-presence threshold inclusivity and millisecond boundary behavior.
- Session-window clipping, out-of-window and zero-length intervals, overlapping
  interval union, and exact reconnect-grace boundaries.
- Separate short visits are not added together; only the longest merged stay
  determines `PRESENT`, while total presence seconds remain separately reported.
- Case-insensitive report email matching and the returned unmatched CSV rows.
- Session computation uses the longest continuous stay even when separate visits
  total more than the configured threshold.
- Lecturer override reasons are normalized and required before repository
  persistence.

## How to Run & Test

- `corepack pnpm@12.21.0 --filter @school/api exec vitest run src/academic/attendance.presence.spec.ts src/academic/attendance.service.spec.ts` — passed; 2 files and 15 tests.
- `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
- `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
- `corepack pnpm@12.21.0 --filter @school/api build` — passed.
- `corepack pnpm@12.21.0 exec prettier --config .prettierrc.json --check apps/api/src/academic/academic.module.ts apps/api/src/academic/attendance.presence.ts apps/api/src/academic/attendance.presence.spec.ts apps/api/src/academic/attendance.repository.ts apps/api/src/academic/attendance.service.ts apps/api/src/academic/attendance.service.spec.ts apps/api/src/academic/attendance.types.ts docs/DEVELOPMENT_LOG.md docs/phases/phase-2/step-2.14-attendance-engine.md docs/phases/phase-2/step-2.14-attendance-engine-tests.md` — passed.
- `git diff --check` — passed.

## Data/Permissions Impact

No data or permissions changed. Service tests verify the existing assigned
lecturer permissions and reason-required override behavior.

## Copilot Usage

Tests were added and run separately from the service implementation, using the
API package's Vitest conventions and the canonical RBAC and schema contracts.

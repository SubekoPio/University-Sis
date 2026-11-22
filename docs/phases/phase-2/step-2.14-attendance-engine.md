<!-- Purpose: Record Phase 2.14 attendance-engine services and persistence behavior. -->

# Phase 2 / Step 2.14: Attendance Engine Services

## Goal

Add service-layer attendance ingestion, computation, lecturer recording and
overrides, and student attendance summaries without adding controllers or
changing the Prisma schema.

## What Was Built

- Added the pure `computeContinuousPresence` function. It clips presence to the
  session, unions overlapping intervals, merges reconnects within the configured
  grace, and decides `PRESENT` from only the longest merged stay.
- Added `AttendanceService` and `AttendanceRepository`, registered and exported
  through the academic module.
- Added CSV report parsing, case-insensitive email matching against the offering
  roster, unmatched-row results, and normalized future-provider interval
  ingestion.
- Added transactional, idempotent attendance computation for ended online and
  hybrid sessions. Computation marks the session `HELD`, preserves overridden
  outcomes, and upserts current outcomes for the selected roster.
- Added per-student and bulk lecturer marks for ended physical sessions, with
  audit records, plus reason-required lecturer overrides with audit records.
- Added a student's own per-offering and overall intake percentages, using
  `PRESENT / HELD sessions` and the configured below-minimum warning threshold.

## Key Decisions

- The service fails explicitly when the global `AttendanceRule` row (`id = 1`)
  is absent; it does not invent or silently apply threshold defaults.
- The attendance roster includes `SELECTED` and `COMPLETED` registrations.
  Dropped registrations are excluded; the schema has no drop timestamp for
  reconstructing historical roster membership.
- Provider event ingestion is an internal service interface for a future
  adapter; no provider endpoint, controller, or actor permission is introduced.
- CSV imports require an ended online or hybrid session. Provider-normalized
  events may be ingested while a session is in progress.
- Lecturer actions require the existing attendance permission and assigned
  offering scope. Student summaries are restricted to the authenticated
  student's own active account.
- No HTTP routes, schema, migrations, seeds, or permissions were added or
  changed. Behavioral tests are recorded in the separate Phase 2.14 test step.

## How to Run & Test

- `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
- `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
- `corepack pnpm@12.21.0 --filter @school/api build` — passed.
- Focused test results are recorded in the separate attendance-engine test step.

## Data/Permissions Impact

No Prisma schema or permission changes. Existing attendance-record,
presence-interval, session, and audit-log models persist the service workflows.
Lecturer recording uses `academic:attendance:record_assigned`, lecturer
overrides use `attendance:override`, and student summaries use
`academic:attendance:read_own`.

## Known Limitations

Provider presence is accepted in a normalized interval format but no external
meeting-provider adapter is configured. Historical dropped-registration roster
membership cannot be recovered with the current schema.

## Copilot Usage

The canonical RBAC matrix, database schema, Phase 2.14 prompt, API service
patterns, and attendance test instructions were reviewed before implementation.

<!-- Purpose: Record the Phase 2.5 session and attendance schema. -->

# Phase 2 / Step 2.5: Class Sessions and Attendance

## Goal

Persist recurring timetable slots, dated class sessions, Attend clicks, online
presence intervals, attendance outcomes, and configurable attendance thresholds
without generating APIs.

## What Was Built

- Added `TimetableSlot`, `ClassSession`, `SessionJoin`, `PresenceInterval`,
  `AttendanceRecord`, and `AttendanceRule`.
- Added weekday, session-state, presence-source, attendance-status, and
  attendance-method enums.
- Added offering, student, and override-actor relations, indexes, the unique
  `(sessionId, studentId)` attendance constraint, and timestamps.
- Added a migration-level check that fixes the global `AttendanceRule` key at 1.
- Updated the academic model, database schema, roadmap, attendance prompt, and
  development log.

## Key Decisions

- One system-wide `AttendanceRule` applies to every session. Its integer key is
  fixed to `1` by a migration check so multiple global rules cannot coexist.
  The migration does not seed the row; a future initializer must upsert it.
- Timetable start/end values are local PostgreSQL `TIME(0)` values. Dated
  sessions use timestamps.
- `meetingProvider` is a nullable string key because provider choices are not
  finalized. Meeting URLs remain stored data and must not appear in list or
  detail responses.
- Attend clicks and completed presence intervals are append-only event records
  with `createdAt`; mutable records also have `updatedAt`.

## Business Rules

- A click on Attend is not evidence of presence.
- Online `PRESENT` requires the configured share of the session in the longest
  continuous stay. Reconnects merge only within the configured grace period;
  interrupted intervals are never added together.
- The home-page warning threshold is separate from the online presence
  threshold. `totalSeconds` does not replace the longest-continuous calculation.
- Lecturer overrides require an authorized actor and written reason.

## How to Run & Test

- `corepack pnpm@12.21.0 exec prisma format --schema prisma/schema.prisma` —
  passed.
- `corepack pnpm@12.21.0 exec prisma validate --schema prisma/schema.prisma` —
  passed.
- `corepack pnpm@12.21.0 exec prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` —
  passed; SQL generation succeeded for the full schema.
- Generated and reviewed the incremental SQL diff against the pre-step schema;
  the versioned migration includes the documented singleton check.
- Prettier `--check` for the updated documentation and `git diff --check` —
  passed.
- No application tests were run; tests belong in the separate Phase 2 test step.
- `prisma migrate deploy` was not run; it applies migrations to the configured
  database.

## Data/Permissions Impact

Adds session and attendance enums, tables, foreign keys, indexes, and a
singleton check. No RBAC permissions or seed data changed; access to assigned
classes and attendance overrides remains governed by `docs/RBAC_MATRIX.md`.

## Known Limitations

The migration has not been applied. Presence calculation, attendance
recomputation, threshold validation, URL privacy, and override authorization
remain service/API responsibilities. No meeting provider has been selected,
and the global rule row is not seeded.

## Copilot Usage

The Phase 2.5 prompt and canonical academic/database docs were reviewed. The
attendance-rule scope was clarified as global before implementation.

<!-- Purpose: Record the Phase 2.6 announcements and academic calendar schema. -->

# Phase 2 / Step 2.6: Announcements and Academic Calendar

## Goal

Add persisted announcements, shared audience selectors, and authored calendar
events without generating APIs. Intake dates and class sessions remain derived
calendar sources rather than duplicate event records.

## What Was Built

- Added announcement and calendar-event category, status, type, and audience
  enums.
- Added `Announcement`, `AnnouncementAudience`, `CalendarEvent`, and
  `CalendarEventAudience` models with creator and parent relations, indexes,
  and timestamps.
- Generated `prisma/migrations/20261122010000_announcements_calendar_schema/migration.sql`.
- Updated `docs/DATABASE_SCHEMA.md` and `docs/ACADEMIC_MODEL.md`.

## Key Decisions

- Announcement and calendar-event audiences share
  `CommunicationAudienceType`.
- `targetId` is a nullable polymorphic UUID because selectors may target
  different entity tables; services must validate the target type and
  ownership.
- Creator references restrict user deletion. Audience selectors cascade with
  their parent announcement or event.
- Calendar aggregation derives intake dates from `Intake` and class sessions
  from `ClassSession`; it does not persist duplicate `CalendarEvent` rows.

## Business Rules

- Announcements carry a category, draft/published/archived state, pin and sort
  metadata, and a publication window.
- Calendar event records represent authored holidays, academic events, and
  general events. Intake dates and class sessions are not stored as events.

## How to Run & Test

- `corepack pnpm@12.21.0 exec prisma format --schema prisma/schema.prisma` —
  passed.
- `corepack pnpm@12.21.0 exec prisma validate --schema prisma/schema.prisma` —
  passed.
- Incremental SQL generation with `prisma migrate diff` from the pre-change
  schema snapshot — passed; the generated migration was reviewed.
- Documentation Prettier checks and `git diff --check` — passed.
- No application tests were run; tests belong in the separate Phase 2 test
  step.
- The migration was not applied.

## Data/Permissions Impact

Adds four tables, four enums, indexes, creator foreign keys, and audience
relations. No RBAC permissions or seed data changed. No APIs were generated.

## Known Limitations

There are no communication or calendar services, APIs, audience resolution,
publication workflow, or object-storage upload flow in this step. Polymorphic
audience targets require service-level type validation.

## Copilot Usage

The Phase 2.6 prompt and canonical database documentation were reviewed before
implementation; the generated migration SQL was reviewed before recording the
step.

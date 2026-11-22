<!-- Purpose: Record Phase 2.13 timetable, class-session, and Attend services. -->

# Phase 2 / Step 2.13: Class Sessions and Online Meeting Services

## Goal

Add service-layer timetable management, session generation and lifecycle
operations, and a protected Attend workflow without adding controllers or
changing the Prisma schema.

## What Was Built

- Added `TimetableService`, `SessionService`, and `AttendService`, backed by a
  Prisma repository and registered in the academic module.
- Added recurring slot creation, updates, and deletion; weekly generation for
  an offering or intake; holiday-day skipping; room, offering, and shared
  lecturer clash checks; and a student's own weekly schedule.
- Added HTTPS meeting-link validation against `MEETING_ALLOWED_HOSTS`, session
  cancellation and rescheduling, and a `MeetingProvider` contract with a
  `ManualLinkProvider` implementation.
- Added Attend validation for ownership, the student's admitted study mode,
  selected offering, online/hybrid delivery, stored link, and the inclusive
  start-minus-10-minutes-through-end window. Successful actions create
  `SessionJoin` records and return `{ meetingUrl }`.
- Kept meeting URLs out of slot/session summaries and weekly schedule results.

## Key Decisions

- The schema stores study mode on `AdmissionRecord`, not `Student`; Attend uses
  the student's most recent admission record. Physical-study students receive
  a clear in-person attendance message.
- Both the admitted study mode and offering/session delivery must support
  online attendance, preserving the offering-delivery rule in the Phase 2.13
  prompt as well as the requested student-mode restriction.
- Slot times and intake-day iteration use UTC consistently with the existing
  academic service time-of-day logic. Weeks start on Monday.
- A holiday event suppresses every slot occurrence on any UTC calendar day
  overlapped by that event.
- Student scope is enforced against the authenticated user; lecturer session
  management is limited to assigned offerings, while institution-wide
  session-management permissions retain the broader scope.
- No HTTP controller, route, schema, migration, seed, or permission changes
  were made. Behavioral tests remain in the separate Phase 2 test step.

## Business Rules

- A recurring slot must have a valid weekday, delivery mode, same-day time
  range, and optional HTTPS link hosted by the configured allow-list.
- Session generation is idempotent for a slot occurrence and skips holidays.
- Room, shared-offering, and assigned-lecturer overlaps are rejected for
  recurring slots and session reschedules/generation.
- Attend is restricted to the student's own selected offering and only while
  the session is scheduled and open; a click is logged only after the provider
  successfully returns a join URL.
- Meeting URLs are only included in `AttendService.attend()` results.

## How to Run & Test

- `corepack pnpm --filter @school/api typecheck` — passed.
- `corepack pnpm --filter @school/api lint` — passed.
- `corepack pnpm --filter @school/api build` — passed.
- Focused behavioral tests were not run in this implementation step; they
  belong in the separate Phase 2 test step.

## Data/Permissions Impact

No Prisma schema or permission changes. The services enforce existing
`academic:session:manage` and `academic:session:attend` permissions and preserve
the matrix's lecturer offering scope. Attend writes the existing `SessionJoin`
record.

## Known Limitations

`ManualLinkProvider` returns the stored meeting URL; no external provider or
presence ingestion is configured. Continuous-presence calculation and
attendance outcomes remain part of Phase 2.14. UTC is used because the current
academic schema does not define an institutional timezone.

## Copilot Usage

The canonical RBAC matrix, database schema, Phase 2.13 prompt, backend
instructions, current Prisma models, and academic service/repository patterns
were reviewed before implementation.

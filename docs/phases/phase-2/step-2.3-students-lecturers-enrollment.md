<!-- Purpose: Record the Phase 2.3 student, lecturer, and enrollment schema. -->

# Phase 2 / Step 2.3: Students, Lecturers, and Enrollment

## Goal

Persist student and lecturer profiles, programme enrollment history, intake
registration, course-unit selection, and lecturer assignments without APIs.

## What Was Built

- Added `Student`, `Lecturer`, `OfferingLecturer`, `ProgrammeEnrollment`,
  `IntakeRegistration`, and `UnitRegistration`.
- Added schedule, delivery, assignment-role, enrollment, intake-registration,
  and unit-registration enums.
- Added one-to-one user links, unique identifiers, indexes, timestamps,
  restrictive history-preserving relations, and intake-slot checks.
- Added required `deliveryMode` to shared course-unit offerings.
- Updated the academic model, database schema, roadmap, and Phase 2.3 prompt.

## Key Decisions

- `Student.schedule` is `DAY`, `EVENING`, `WEEKEND`, or `DISTANCE`; it is not
  course delivery mode.
- `CourseUnitOffering.deliveryMode` is `PHYSICAL`, `ONLINE`, or `HYBRID`.
- Programme and admission-intake data remain on `ProgrammeEnrollment`;
  admission year can be derived from its intake.
- Student and lecturer relations add only inverse profile fields to `User`;
  no authentication fields or behavior changed.
- Existing `AuditLog` is the record for student-schedule and offering-delivery
  changes; no separate history table was added.

## Business Rules

- A student and lecturer each belong to one authentication user.
- A student can have multiple programme-enrollment records so prior enrollment
  history is retained; enrollment and registration parents cannot be deleted
  through cascading relations.
- Intake registration is unique per student and intake. Unit registration is
  unique per student and offering.
- Intake slots are constrained to 1-3. Offering delivery mode is independent of
  the student's schedule.
- `IntakeRegistration.status` values are `PENDING`, `REGISTERED`, `DEFERRED`,
  `WITHDRAWN`, `SUSPENDED`, and `COMPLETED`.

## How to Run & Test

- `corepack pnpm@12.21.0 exec prisma format --schema prisma/schema.prisma` — passed.
- `corepack pnpm@12.21.0 exec prisma validate --schema prisma/schema.prisma` — passed.
- `corepack pnpm@12.21.0 exec prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` — passed; reviewed generated tables, indexes, and relations. The programme-enrollment intake-slot check is in the migration SQL because Prisma schema syntax does not represent numeric check constraints.
- `corepack pnpm@12.21.0 exec prettier --config .prettierrc.json --check docs/ACADEMIC_MODEL.md docs/DATABASE_SCHEMA.md docs/DEVELOPMENT_LOG.md docs/School_System_Copilot_Roadmap.md docs/School_System_Copilot_Prompts.md docs/phases/phase-2/step-2.3-students-lecturers-enrollment.md` — passed.
- `git diff --check` — passed.
- `corepack pnpm@12.21.0 exec prisma migrate deploy` — not run; applies pending migrations to the configured database.
- No tests were run; tests belong in the separate Phase 2 test step.

## Data/Permissions Impact

Adds student, lecturer, enrollment, registration, and assignment tables,
delivery-mode and lifecycle enums, indexes, foreign keys, and an intake-slot
check. Only inverse profile relations were added to `User`. No permissions,
seed data, services, or APIs were changed.

## Known Limitations

The schema preserves enrollment rows through restrictive foreign keys;
Phase 2.11 services now enforce status transitions and progression with
transactional audit writes. Existing course-unit offerings must be assigned a
delivery mode before the migration can apply if any such rows already exist.
`UnitRegistration.intakeId` consistency with its offering is a service-level
check.

## Copilot Usage

The Phase 2.3 prompt, roadmap, academic model, database schema, RBAC matrix,
and Prisma instructions were reviewed. Student details, intake-registration
statuses, the User relation exception, and schedule/delivery placement were
clarified before implementation.

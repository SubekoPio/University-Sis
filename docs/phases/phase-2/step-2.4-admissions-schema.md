<!-- Purpose: Record the Phase 2.4 admissions schema and its data invariants. -->

# Phase 2 / Step 2.4: Admissions Schema

## Goal

Persist applications, supporting documents, application-fee deposits, and
admission decisions without generating APIs.

## What Was Built

- Added `Application`, `ApplicationDocument`, `ApplicationFeeRecord`, and
  `AdmissionRecord`, plus their workflow enums.
- Added programme, intake, student, and actor relations with indexes,
  uniqueness constraints, timestamps, and history-preserving deletion behavior.
- Stored document object keys rather than file contents; represented fees as
  integer minor units with an ISO 4217 currency code.
- Updated the admissions prompt, academic model, database schema, roadmap, and
  development log.

## Key Decisions

- `StudyMode` (`ONLINE`, `PHYSICAL`) and `StudentSchedule` (`DAY`, `EVENING`,
  `WEEKEND`, `DISTANCE`) are independent and both are captured on applications
  and admission records. The student's schedule is also stored on `Student`;
  study mode is not stored on `Student` or `ProgrammeEnrollment`.
- Application-level admission actor, timestamp, and student link are nullable
  until the application is admitted. `AdmissionRecord.applicationId` is unique.
- Added only the inverse Prisma relation fields needed on `User`, `Programme`,
  `Intake`, and `Student`; authentication behavior and APIs were not changed.

## Business Rules

- Website `externalRef` values and `(bankName, bankReference)` pairs are unique.
- Application statuses, document review states, and fee-record states use
  finite enums. Voided fee records keep a voiding actor, timestamp, and reason.
- Services must keep application and admission values consistent, copy the
  admitted schedule to the student, prevent the document reviewer from
  admitting the same applicant, and prevent a fee recorder from voiding that
  record.
- Uploaded file contents remain in object storage. No API or service was added.

## How to Run & Test

- `corepack pnpm@12.21.0 exec prisma format --schema prisma/schema.prisma` —
  passed.
- `corepack pnpm@12.21.0 exec prisma validate --schema prisma/schema.prisma` —
  passed.
- `corepack pnpm@12.21.0 exec prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` —
  passed; verified SQL generation for the final Prisma schema.
- Generated the incremental migration from a pre-step schema snapshot and
  verified it matches the versioned migration.
- Prettier checks and `git diff --check` — passed.
- No application tests were run; tests belong in the separate Phase 2 test step.
- `prisma migrate deploy` was not run; it applies migrations to the configured
  database.

## Data/Permissions Impact

Adds admissions enums, tables, foreign keys, indexes, and unique constraints.
No RBAC permissions or seed data changed; authorization and separation of
duties remain service-layer requirements from `docs/RBAC_MATRIX.md`.

## Known Limitations

The migration has not been applied. Cross-record consistency, review/admission
separation, application-fee maker-checker rules, and status transitions require
service enforcement.

## Copilot Usage

The Phase 2.4 prompt and canonical academic/database documents were reviewed.
The relationship between applicant `studyMode` and the existing student
`schedule` was clarified before implementation.

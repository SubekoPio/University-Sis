<!-- Purpose: Record the Phase 2.11 student, enrollment, and lecturer services. -->

# Phase 2 / Step 2.11: SIS Services

## Goal

Provide service-layer operations for student profiles, programme-enrollment
history and progression, study-mode changes, and lecturer profiles without
adding HTTP controllers or routes.

## What Was Built

- Added `StudentsService`, `ProgrammeEnrollmentService`, and `LecturersService`
  with Prisma repositories registered in the academic module.
- Added student search and bounded pagination, profile updates, and archival
  through account deactivation and session revocation. Student profiles and
  academic history are retained; student-profile creation remains inside the
  admission transaction.
- Added audited study-mode changes requiring
  `admissions:study-mode:change` and a written reason. The admitted application
  and admission record are updated atomically.
- Added enrollment-history reads, defer/withdraw/complete transitions, and
  intake progression. Progression requires a registered student and a closed
  intake; it advances the intake slot and study year, completing the enrollment
  after its final programme slot.
- Added lecturer profile creation and updates for existing user accounts,
  linked only to active departments.

## Key Decisions

- Existing RBAC keys are reused: student read/update/archive and enrollment
  management are registrar permissions; study-mode changes use the existing
  admissions-head permission; lecturer-profile management uses
  `academic:structure:manage`.
- The `Student` model has no `deletedAt` field. Archival therefore deactivates
  the linked user, revokes sessions, and keeps the profile row and all
  restrictive academic relations intact.
- Study mode is stored on both `Application` and `AdmissionRecord`; both values
  are changed together, with the old and new values and the written reason in
  the audit log.
- Academic years are ordered by start date when validating the current
  study-year offset from the admission intake. Slots advance 1 -> 2 -> 3 and wrap
  to slot 1 of the following study year.
- No schema, seed, permission, controller, or route changes were made.

## Data/Permissions Impact

No schema or permission changes. The services enforce existing RBAC
permissions and write audit events for student profile changes, archival,
study-mode changes, lecturer-profile changes, enrollment status transitions,
and progression.

## Known Limitations

Programme enrollment creation remains part of the admission transaction;
this service step does not introduce a separate enrollment-creation flow.
Lecturer user accounts must already exist and are not created by this feature.

## Copilot Usage

The canonical RBAC matrix, database schema, Phase 2.11 prompt, backend
instructions, and Prisma models were reviewed before implementation.

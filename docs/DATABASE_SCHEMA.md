# Database Schema

**Status:** Draft logical model for human review. Authentication, RBAC,
user-lifecycle, audit, academic structure, course-unit curriculum and offerings,
student/lecturer enrollment, admissions, class-session/attendance, announcement,
and calendar models are implemented in Prisma. Academic-structure services and
course-unit, curriculum, and offering services are implemented without HTTP
controllers or guards.
Migration application state must be verified separately for each database.
**Last updated:** 2026-11-22

## Purpose and implementation status

This document records the PostgreSQL data model for the University SIS and the
invariants that Prisma models and migrations must preserve. The architecture
uses PostgreSQL as the relational source of truth and Prisma for data access
([architecture](./ARCHITECTURE.md)).

Authentication, RBAC, user-lifecycle, audit, and the academic structure,
course-unit, curriculum, offering, student, lecturer, registration,
application/admission, session/attendance, announcement, and calendar models
are defined in
[`prisma/schema.prisma`](../prisma/schema.prisma), with versioned migrations
under [`prisma/migrations/`](../prisma/migrations/). Migration application
state is environment-specific. Other proposed models and relationships below
remain planned.

The [RBAC matrix](./RBAC_MATRIX.md) is the authorization source of truth.
Database relationships help resolve record ownership and scope, but do not
replace API authorization or service-level checks.

## Persistence conventions

- Use PostgreSQL through Prisma repositories. Keep write ownership within the
  module that owns the data; other modules should use its service boundary.
- Use UUID primary keys and explicit foreign keys, matching the implemented
  authentication and academic models.
- Use enums for finite lifecycle states. Final enum members should be agreed
  with the relevant workflow before implementation.
- Store monetary amounts as integer minor units with an associated currency;
  never use floating-point values.
- Add `createdAt` and `updatedAt` to mutable records. Immutable audit and
  transaction records retain creation time and must not be updated or deleted.
- Declare explicit `onDelete` behavior for every Prisma relation. Preserve
  academic, financial, and audit history rather than cascading its deletion.
- Store uploaded files in object storage. Persist object keys and necessary
  metadata in PostgreSQL, not file contents.
- Enforce tenant/institution scope in every query if multi-institution support
  is adopted. The exact institution model is not yet decided.

## Proposed model catalog

### Authentication and RBAC

| Model                    | Purpose and relationships                                                                                                      | Key constraints                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`                   | Identity, display name, account lifecycle, and password-change state; parent of role assignments, sessions, and token records. | UUID primary key; unique normalized login email; password hash only; existing users default to `mustChangePassword = false`; optional name, temporary-password expiry, and creator/deactivator references. |
| `Role`                   | Named application roles, including `student`, `lecturer`, `bursar`, `registrar`, and `admin`.                                  | UUID primary key; unique role name.                                                                                                                                                                        |
| `Permission`             | Permission keys aligned with the RBAC matrix, such as `finance:payment:record_bank_deposit`.                                   | UUID primary key; unique permission key.                                                                                                                                                                   |
| `UserRole`               | Join between users and roles.                                                                                                  | Composite primary key `(userId, roleId)`.                                                                                                                                                                  |
| `RolePermission`         | Join between roles and permissions.                                                                                            | Composite primary key `(roleId, permissionId)`.                                                                                                                                                            |
| `Session`                | Refresh-token hash and session metadata, including user agent, IP, expiry, and revocation time.                                | Unique token hash; indexes on `userId` and expiry.                                                                                                                                                         |
| `PasswordResetToken`     | Hashed, expiring, single-use password recovery token.                                                                          | Unique token hash; indexes on `userId` and expiry.                                                                                                                                                         |
| `EmailVerificationToken` | Hashed, expiring, single-use email verification token.                                                                         | Unique token hash; indexes on `userId` and expiry.                                                                                                                                                         |
| `AuditLog`               | Immutable record of a sensitive action, actor, and affected resource.                                                          | Nullable actor reference uses `SetNull`; indexed by actor/time and resource/time; never stores credentials.                                                                                                |

Mutable authentication and RBAC records have `createdAt` and `updatedAt`;
immutable audit records have `createdAt` only.
Foreign-key relations specify deletion behavior: deleting a user cascades to its
role assignments, sessions, and authentication tokens; deleting a role or
permission cascades only to its corresponding join records. The Prisma schema
uses `ACTIVE`, `SUSPENDED`, `DISABLED`, and `DEACTIVATED` for `UserStatus`.
`mustChangePassword` defaults to `false`, so existing accounts retain that
value when the field is added. `temporaryPasswordExpiresAt` is nullable.
`name` is nullable for existing accounts; administrator-created users require a
name.
`createdById` and `deactivatedById` are nullable self-relations to `User` with
`onDelete: SetNull`; deleting an actor does not delete the affected accounts.
Indexes support expiry and reverse lookups by creator/deactivator. Login
requires `User.emailVerified` to be true. Admin-provisioned accounts remain
unverified until their credential email is accepted by the configured
`EmailService`. Verification tokens are single-use and expire after 24 hours.
Password-reset tokens are single-use and expire after one hour.
There is no public account-registration endpoint; administrators create staff
accounts and students are admitted. A user with `mustChangePassword = true`
can use only `POST /auth/change-password` or logout while the session is active.
The temporary password must be unexpired; a missing or expired expiry requires
administrator assistance. Password change verifies the temporary password,
rejects reuse, clears the forced-change state and expiry, marks the email
verified, and revokes every other session atomically while preserving the
session used for the change. The existing password policy is non-empty and at
most 1024 characters; no additional strength rule is implied here.
Role/permission grants must be checked against the matrix and must not broaden
record scope.

`AuditLog` records are append-only and must preserve sensitive action history
when an actor is deleted. Structured metadata may identify changed role IDs or
email-delivery outcomes, but must never contain a password, token, or secret.
The application writes audit records and exposes no update/delete operation.

### Student information and academic structure

| Model                                                                            | Purpose and implementation status                                              | Key constraints                                                                                                                                     |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Faculty`                                                                        | Implemented top-level academic organization containing departments.            | Unique code; hard-delete only when unreferenced, otherwise soft-delete with `deletedAt`.                                                            |
| `Department`                                                                     | Implemented academic organization within a faculty.                            | Unique code; restrictive faculty relation; hard-delete only when unreferenced, otherwise soft-delete.                                               |
| `Programme`                                                                      | Implemented course of study owned by a department.                             | Unique code; explicit award level and duration; referenced programmes are soft-deleted.                                                             |
| `AcademicYear`                                                                   | Implemented calendar grouping for the academic year.                           | Unique label; creates three intakes atomically; referenced years are soft-deleted.                                                                  |
| `Intake`                                                                         | Implemented configurable academic period within an academic year.              | Unique `(academicYearId, sequence)`; database check limits sequence to 1-3; non-overlap and selection-window rules are service-level.               |
| `CourseUnit`                                                                     | Implemented catalog unit owned by a department.                                | Unique code; levels are `LEVEL_100`-`LEVEL_400`; statuses are `ACTIVE`, `INACTIVE`, or `RETIRED`; faculty eligibility is explicit.                  |
| `CourseUnitFacultyEligibility`                                                   | Implemented faculty allowlist entry for a course unit.                         | Composite primary key `(courseUnitId, facultyId)` prevents duplicate eligibility.                                                                   |
| `ProgrammeCourseUnit`                                                            | Implemented curriculum placement for a programme, study year, and intake slot. | Unique `(programmeId, courseUnitId)`; intake slot is constrained to 1-3; type is `CORE` or `ELECTIVE`.                                              |
| `ProgrammeElectiveRule`                                                          | Implemented elective-credit rule for a programme curriculum slot.              | Indexed by programme, study year, and intake slot; multiple rules per slot are permitted; slot is constrained to 1-3.                               |
| `CourseUnitPrerequisite`                                                         | Implemented directed prerequisite relationship between course units.           | Composite primary key `(courseUnitId, prerequisiteId)`; curriculum services reject cycles, while direct database writes can bypass the rule.        |
| `CourseUnitOffering`                                                             | Implemented shared delivery of a course unit in an intake.                     | Unique `(courseUnitId, intakeId)`; nullable capacity; delivery mode is `PHYSICAL`, `ONLINE`, or `HYBRID`; new and copied offerings start `PLANNED`. |
| `Student`                                                                        | Implemented student profile linked one-to-one with `User`.                     | Unique user, student number, and optional national ID; schedule is `DAY`, `EVENING`, `WEEKEND`, or `DISTANCE`.                                      |
| `Lecturer`                                                                       | Implemented lecturer profile linked to `User` and a department.                | Unique user and staff number; department relation is restrictive.                                                                                   |
| `OfferingLecturer`                                                               | Implemented primary or assistant lecturer assignment for an offering.          | Composite primary key `(offeringId, lecturerId)` prevents duplicate assignments.                                                                    |
| `ProgrammeEnrollment`                                                            | Implemented current and historical student enrollment in a programme.          | Keep multiple historical records; preserve rows on delete; statuses are `ACTIVE`, `DEFERRED`, `COMPLETED`, or `WITHDRAWN`.                          |
| `IntakeRegistration`                                                             | Implemented student registration for an intake.                                | Unique `(studentId, intakeId)`; status records the registration lifecycle.                                                                          |
| `UnitRegistration`                                                               | Implemented student selection, drop, or completion of a shared offering.       | Unique `(studentId, offeringId)`; status is `SELECTED`, `DROPPED`, or `COMPLETED`; retake state is explicit.                                        |
| The implemented hierarchy is Faculty > Department > Programme. The academic-year |
| service creates all three intake slots in one transaction; the schema limits     |
| sequences to 1-3 but does not require all three rows to exist. Course units are  |
| owned by departments; curriculum placement, faculty eligibility, prerequisites,  |
| and elective rules are modeled separately. A shared offering is identified by    |
| course unit and intake, never by programme. Student profiles store demographic   |
| and contact details and schedule, while `ProgrammeEnrollment` stores programme   |
| and progression history. Schedule and offering delivery mode are separate        |
| concepts; changes are recorded through the existing `AuditLog`.                  |
| Programme-enrollment and course-unit registration history must be retained       |
| rather than treated as disposable join state. Referenced academic-structure      |
| records are soft-deleted with `deletedAt`; unreferenced records may be removed.  |

Student soft deletion deactivates the linked `User` (`DEACTIVATED`), revokes
its sessions, and retains the `Student` row because it has no `deletedAt` field
and is referenced by academic history. Student numbers remain unique. Study
mode changes update both the admitted `Application` and `AdmissionRecord`
within one transaction; the required reason and before/after values are stored
in the append-only audit log. Enrollment transitions preserve their rows and
are audited; progression completes a registered intake only after its `Intake`
is `CLOSED`, then advances the study year and slot or completes the final
programme slot.

Course-unit services maintain general-unit faculty eligibility and retire units
that are referenced by curriculum, prerequisites, or offerings. Curriculum
services replace one programme slot at a time, validate elective-credit bounds,
and reject prerequisite cycles. Offering services reject an existing unit/intake
pair, bulk-create one shared offering for each distinct curriculum unit, and
copy lecturer assignments from the previous intake. The current schema does not
enforce one `PRIMARY` lecturer per offering; assignment services serialize
assignment changes on the offering row and check the rule before writing, but
direct database writes can bypass the service-level constraint.

Course-unit selection uses the current active programme enrollment, curriculum
slot, and faculty eligibility. Selection and drop writes are transactional;
course-unit registrations are retained when dropped. A registrar with
`academic:enrollment:manage` may override only the selection window, with a
written reason and an append-only audit entry. Existing elective-rule rows are
treated as alternative allowed credit ranges. Until result outcomes exist,
earlier `COMPLETED` registrations are the only available prerequisite-pass
evidence; retakes and an overall credit-load limit are not inferred.

### Admissions

| Model                  | Purpose and relationships                                                        | Key constraints                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `Application`          | Applicant's request for a programme and intake, linked to the resulting student. | Nullable unique website `externalRef`; records source, study mode, and student schedule separately. |
| `ApplicationDocument`  | Object-storage metadata and review result for one supporting document.           | Store only `storageKey`; preserve document type, status, reviewer, and review time.                 |
| `ApplicationFeeRecord` | Bank-deposit details used to confirm an application fee.                         | Integer minor units; unique `(bankName, bankReference)`; void records include actor, time, reason.  |
| `AdmissionRecord`      | Admission decision linking an application, student, programme, and intake.       | Unique `applicationId`; retains both the admitted study mode and student schedule.                  |

`StudyMode` (`ONLINE`, `PHYSICAL`) is captured independently from
`StudentSchedule` (`DAY`, `EVENING`, `WEEKEND`, `DISTANCE`) on applications and
admission records. Neither field replaces `CourseUnitOffering.deliveryMode`.
`Application.enteredById` is nullable for website submissions, while
`admittedById`, `admittedAt`, and `studentId` remain nullable until admission;
`AdmissionRecord` stores the completed decision. Website application references
are unique when present. Uploaded document contents remain in object storage,
not PostgreSQL.

The service layer must keep applicant, programme, intake, schedule, and
study-mode values consistent between an application and its admission record,
and copy the admitted schedule to the created student. It must enforce the
separation-of-duties rules:
a user who approved any application document cannot admit the same applicant,
and a user who records an application-fee deposit cannot void that record.
Voids require a reason and an audit/reversal record. Phase 2 requires
approved `ID`, `TRANSCRIPT`, `CERTIFICATE`, and `PHOTO` documents before marking documents approved;
`OTHER` is optional. Fee confirmation compares a physical bank deposit's
integer minor-unit amount and configured currency with
`APPLICATION_FEE_AMOUNT_MINOR` and `CURRENCY`. Admission creates a
first-study-year enrollment whose programme curriculum and intake slot define
the prompted units; unit-registration rows are created only after selection.
Website intake authenticates with `WEBSITE_INTEGRATION_SECRET`, is rate limited,
and uses `externalRef` for idempotency.

### Sessions and attendance

| Model              | Purpose and relationships                                                   | Key constraints                                                                                              |
| ------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `TimetableSlot`    | Recurring weekly schedule and default room or meeting URL for an offering.  | Uses a weekday and local start/end times; delivery is `PHYSICAL`, `ONLINE`, or `HYBRID`.                     |
| `ClassSession`     | Dated class meeting linked to an offering and optional timetable slot.      | Stores session delivery, room/link, optional provider identifiers, and `SCHEDULED`/`HELD`/`CANCELLED` state. |
| `SessionJoin`      | Immutable log of a student's Attend-button click.                           | A click is not proof of presence; retain the session, student, and click time.                               |
| `PresenceInterval` | Immutable joined/left interval for one student and session.                 | Source is `PROVIDER_WEBHOOK`, `REPORT_IMPORT`, or `MANUAL`; do not sum interruptions for PRESENT.            |
| `AttendanceRecord` | Computed or lecturer-marked attendance outcome for one student and session. | Unique `(sessionId, studentId)`; stores the longest continuous interval and total seconds.                   |
| `AttendanceRule`   | System-wide attendance thresholds applied to all sessions.                  | One global row (`id = 1`); defaults are 75%, 180 seconds, and 75%.                                           |

`AttendanceRule` is a singleton configuration row. Its fixed key is enforced by
a database check constraint; the migration creates the table but does not seed
a row, so a future initializer must create or upsert `id = 1`. The fixed
integer key is used only for this global singleton configuration.
`minContinuousPercent` determines the online
presence threshold; `minAttendancePercentWarning` controls the home-page
warning and is not the online presence threshold. Reconnects within the global
grace period may be merged into the longest continuous interval; separate
stays must never be added together to mark `PRESENT`. `totalSeconds` is
informational and does not replace the longest-continuous calculation.

Meeting URLs may be stored on timetable slots or sessions, but must never be
included in list or detail responses; expose a URL only through the authorized
Attend flow. `meetingProvider` remains a nullable string key because the
provider has not been selected. Lecturer overrides require an actor and written
reason and must be authorized against the assigned offering.

### Announcements and calendar

| Model                   | Purpose and relationships                                                   | Key constraints                                                                             |
| ----------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `Announcement`          | Authored institutional notice with category, publication state, and window. | Indexed by `(status, publishAt, expiresAt)`; creator is required and retained.              |
| `AnnouncementAudience`  | Audience selector attached to an announcement.                              | Audience type is shared with calendar events; `targetId` is nullable and polymorphic.       |
| `CalendarEvent`         | Authored dated holiday, academic event, or general event.                   | Creator is required and retained; indexed by event time and type.                           |
| `CalendarEventAudience` | Audience selector attached to a calendar event.                             | Uses the same audience types and nullable polymorphic `targetId` as announcement audiences. |

Announcement and calendar-event creators reference `User` with restrictive
deletion; audience selectors are owned by their parent records and cascade when
the parent is deleted. Audience `targetId` may identify a role, faculty,
programme, intake, or course-unit offering, so it has no single foreign-key
target; validate the target against `audienceType` in the owning service.
Announcement images are represented by an object-storage key, not file
contents.

The calendar projection must derive intake dates from `Intake` and class
sessions from `ClassSession`. Do not create duplicate `CalendarEvent` records
for either source; persist `CalendarEvent` rows only for authored holidays,
academic events, and general events.

### Finance

| Model                 | Purpose and planned relationships                                        | Key constraints                                                                        |
| --------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `FeeStructure`        | Defines fees for an approved academic/programme context.                 | Validate that referenced academic years, intakes, and programmes are compatible.       |
| `FeeItem`             | An individual charge within a fee structure.                             | Store each amount as integer minor units and include currency.                         |
| `StudentInvoice`      | Student's billed charges for an intake or other approved billing period. | Generation must be idempotent; retain invoice history.                                 |
| `PaymentReference`    | Student-facing reference tied to a student, intake, and invoice.         | Unique reference number and unique `(studentId, intakeId, invoiceId)` combination.     |
| `Payment`             | Payment record linked to the student and the invoice/intake it settles.  | Amount is integer minor units; unique `(bankName, bankReference)` for bank deposits.   |
| `Receipt`             | Numbered evidence of a recorded payment.                                 | Unique receipt number; preserve and mark `VOID` when the associated payment is voided. |
| `OutstandingBalance`  | Tracks or projects an unpaid amount.                                     | Must reconcile to the authoritative invoice and payment ledger.                        |
| `CarryForwardBalance` | Tracks an amount carried between billing periods.                        | Derivation and reconciliation rules must be explicit and auditable.                    |
| `TransactionLog`      | Append-only financial ledger/reversal record.                            | No update/delete; write with the associated payment transaction.                       |

The active payment flow is a physical bank deposit recorded by Finance. A
payment records its amount, currency, bank name/reference, deposit date,
recording user, status, and optional slip object key. Corrections use a written
reason and a reversal/void record; payments are never deleted. Voiding requires
maker-checker approval: the approver must differ from the recording user.

`PaymentMethod` may include `BANK_DEPOSIT` and reserved values `CARD`,
`ONLINE_BANK`, and `MOBILE_MONEY`. Online methods are not active. The flags
`payments.online.card`, `payments.online.bank`, and `payments.online.mobile`
must default OFF and must never be enabled by code or seed data. No online
payment or receipt may be created while its method is disabled.

Receipt numbering must be unique and sequential. If gap-free numbering is
required, implement it with a transactionally updated counter rather than
assuming a database sequence is gap-free. The chosen numbering and recovery
strategy needs review before implementation.

### Feature flags

| Model              | Purpose and planned relationships                                         | Key constraints                                                       |
| ------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `FeatureFlag`      | Current value, description, updater, and update time for a named flag.    | Unique key; payment flags default to `false`.                         |
| `FeatureFlagAudit` | Append-only history of flag key, old/new values, actor, reason, and time. | Admin changes require a reason; never update or delete audit entries. |

Flag changes and their audit records are written atomically. Redis may cache
flag reads, but PostgreSQL remains the source of truth.

### Learning management

| Model              | Purpose and planned relationships                                           | Key constraints                                                                                  |
| ------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `Assignment`       | Assignment owned by a lecturer and associated with course/offering context. | Track status and deadlines; students must be enrolled and the assignment visible to submit.      |
| `AssignmentTarget` | Defines the class/offering visibility of an assignment.                     | Restrict target management to the responsible lecturer or an authorized administrator.           |
| `LearningMaterial` | Course/class learning resource metadata.                                    | Store object-storage keys, not file bytes; authorize access by enrollment or assignment.         |
| `Submission`       | Student response to an assignment.                                          | Link to the owning student and assignment; enforce visibility, deadline, and resubmission rules. |
| `SubmissionFile`   | Metadata and object-storage key for a submitted file.                       | Validate file ownership and access through the parent submission.                                |
| `Grade`            | Grade for a submission.                                                     | Only the assigned lecturer may grade; students see published grades only.                        |
| `Feedback`         | Lecturer feedback associated with a submission/grade.                       | Apply publication visibility consistently with the grade.                                        |
| `ExtensionRequest` | Student request for a deadline extension and its review state.              | Preserve requester, reviewer, decision, and timestamps.                                          |

Planned assignment states include `DRAFT`, `PENDING_APPROVAL`, `PUBLISHED`, and
`CLOSED`. Planned submission states include `SUBMITTED`, `LATE`, `MISSED`, and
`GRADED`. Confirm the final state transitions before encoding them as Prisma
enums.

### Examinations

| Model             | Purpose and planned relationships                       | Key constraints                                                              |
| ----------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `Exam`            | Exam definition, schedule, and lifecycle.               | Restrict visibility to the configured target offerings/classes.              |
| `ExamTarget`      | Associates an exam with its intended class/offering.    | Scope exam management and reads to authorized users and assigned classes.    |
| `ExamSubmission`  | Student exam attempt/submission.                        | Link to the student and exam; enforce attempt and deadline rules.            |
| `ExamGrade`       | Grading data for an exam submission.                    | Restrict grading to authorized assigned lecturers.                           |
| `ExamResult`      | Published result and status, including missed attempts. | Preserve result history and publication state.                               |
| `ExamRestriction` | Eligibility rule type and threshold.                    | Store the rule configuration; do not make this a source of finance/LMS data. |
| `ExamEligibility` | Cached eligibility decision and explanation.            | Treat as a derived decision; invalidate/recompute when source data changes.  |

Exam eligibility may read fee-paid percentages and LMS completion state, but
the Exams module must not create or alter payments, assignments, or submissions.

### Cross-cutting audit

`AuditLog` records sensitive actions with actor, action, timestamp, IP, and
resource identifier. It is append-only and available to authorized
administrators. Do not log passwords, token contents, secrets, or other
credentials. Sensitive events include role changes, payment actions, grade
changes, result publication, and eligibility overrides.

## Relationship and access invariants

- `User` relates to `Role` through `UserRole`; `Role` relates to `Permission`
  through `RolePermission`.
- `Student` and `Lecturer` each relate one-to-one to `User`.
- `Faculty` contains `Department`, which contains `Programme`. `Intake` belongs
  to an `AcademicYear`; `Department` owns `CourseUnit`.
- `ProgrammeCourseUnit` places course units in a programme curriculum by study
  year and intake slot. `ProgrammeElectiveRule` records elective-credit bounds.
- `CourseUnitFacultyEligibility` limits general course units to eligible
  faculties unless the unit is open to all faculties.
- `CourseUnitPrerequisite` records directed prerequisite relationships.
- `CourseUnitOffering` connects one course unit to one intake and is shared
  across programmes; its delivery mode is independent of the student's
  schedule.
- `ProgrammeEnrollment` preserves each programme enrollment record and points
  to the admission intake; schedule changes are logged through `AuditLog`.
- `IntakeRegistration` links a student to one intake; `UnitRegistration` links
  a student to one shared offering and records its intake.
- `Application` records the desired programme/intake, source, study mode, and
  schedule; `AdmissionRecord` uniquely preserves the resulting decision and
  links it to the student, programme, and admission intake.
- `ApplicationDocument` stores only object-storage metadata and review fields.
  `ApplicationFeeRecord` stores integer minor units and a unique bank reference;
  its void history must remain queryable.
- `TimetableSlot` and `ClassSession` belong to a shared course-unit offering.
  Session logs and attendance outcomes link to both `ClassSession` and `Student`;
  attendance is unique for each pair.
- Announcements and calendar events retain their creator and audience selectors.
  Audience targets are polymorphic and are validated by type in the service;
  intake dates and class sessions are derived into the calendar, not copied into
  `CalendarEvent`.
- Enrollment, registration, admission, and attendance history must remain
  queryable.
- Finance records link to the student and the academic billing context. Payment
  references and receipts are unique and auditable.
- LMS submissions and exam attempts link the authenticated student to the
  corresponding assignment or exam; file objects remain in external storage.
- Apply `docs/RBAC_MATRIX.md` at the API/service layer. Filter queries by
  authenticated ownership or assigned class; never trust a client-supplied
  owner ID.
- Use explicit Prisma `onDelete` actions. Deletion of a user must not silently
  remove financial, academic, or audit history.

## Index and uniqueness requirements

At minimum, review and add indexes/constraints for:

- Login email, role name, permission key, and the composite RBAC join keys.
- Session/token hashes, user foreign keys, and expiry/active-session lookups.
- Unique `Student.userId`, student number, optional national ID, `Lecturer.userId`,
  and staff number.
- Student/offering registration pairs and foreign keys used for ownership
  filtering.
- Unique student/intake and offering/lecturer assignment pairs; indexes for
  programme enrollment history and intake/offering class lists.
- Application external references, application status/queue fields,
  application-document review fields, admission application links, and
  application-fee `(bankName, bankReference)` plus actor/date lookups.
- Session/offering/time lookups, session/student attendance uniqueness,
  presence-interval joins, and immutable Attend-click history.
- Announcement publication-window, audience-target, and calendar-event
  date-range lookups.
- Course-unit curriculum placement, faculty eligibility, prerequisite, and
  shared offering keys and lookup indexes.
- Payment `(bankName, bankReference)`, payment-reference number, and receipt
  number.
- Feature-flag key and audit lookup by key, actor, and creation time.
- Frequently scoped records by student, course-unit offering, intake, status, and
  created/updated time, based on measured query patterns.

Confirm all unique keys against real workflows before migration, especially
attendance session uniqueness, course retakes, multiple-currency references,
and payment allocation.

## Migration and seed policy

1. Review the proposed model and permission impact before editing Prisma models.
2. Make schema changes in versioned migrations; do not use destructive schema
   changes to erase historical academic or financial data.
3. Generate and review migrations, including foreign keys, indexes, and
   `onDelete` behavior. Use transactions for multi-record financial writes.
4. Keep seed data idempotent. Seed online payment feature flags only with
   `false`; never overwrite an already configured value with a seed.
5. Update this document and `docs/RBAC_MATRIX.md` whenever model ownership,
   record scope, or permissions change.
6. Add focused tests for constraints, history preservation, access scopes, and
   financial invariants in the appropriate separate test step.

## Decisions still required

- Institution/tenant boundaries and whether an `Institution` model is needed.
- Remaining course-unit selection, enrollment, and retake cardinalities.
- How payment allocations work when a payment covers multiple invoices or
  billing periods.
- Currency support and the relationship between currency codes and minor-unit
  scales.
- A transaction-safe strategy for sequential, gap-free receipt numbers.
- Service-level status transitions, attendance uniqueness, and
  archival/deletion policies for implemented records.
- Retention and redaction policy for IP addresses, authentication metadata,
  and audit records.

## Codebase alignment notes (2026-11-22)

- **Migration application state:** migration files are versioned, but their
  applied state cannot be determined from the schema repository alone; verify
  against each target database before claiming they are pending or applied.
- **Academic model catalog:** Faculty, Department, Programme, AcademicYear,
  Intake, course units, curriculum placement, prerequisites, eligibility,
  shared offerings, student/lecturer profiles, enrollment/selection records,
  admissions, sessions, attendance, announcements, and calendar events are
  implemented in Prisma. Academic-structure services are implemented; other
  domain service and API workflows remain planned.

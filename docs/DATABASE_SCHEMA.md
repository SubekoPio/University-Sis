# Database Schema

**Status:** Draft logical model for human review; the initial authentication and
RBAC migration has been applied to the local development database. The
email-verification migration is generated but has not been applied.
**Last updated:** 2026-11-15

## Purpose and implementation status

This document records the proposed PostgreSQL data model for the University SIS
and the invariants that future Prisma models and migrations must preserve. The
architecture uses PostgreSQL as the relational source of truth and Prisma for
data access ([architecture](./ARCHITECTURE.md)).

The authentication and RBAC models are defined in
[`prisma/schema.prisma`](../prisma/schema.prisma), with migrations under
`prisma/migrations/`. The initial authentication and RBAC migration is applied
in the local development setup; the follow-up email-verification migration
still needs to be applied. All other models and relationships below remain
planned.

The [RBAC matrix](./RBAC_MATRIX.md) is the authorization source of truth.
Database relationships help resolve record ownership and scope, but do not
replace API authorization or service-level checks.

## Persistence conventions

- Use PostgreSQL through Prisma repositories. Keep write ownership within the
  module that owns the data; other modules should use its service boundary.
- Use stable primary keys and explicit foreign keys. Choose and document the
  concrete ID type before the first migration.
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

| Model                    | Purpose and relationships                                                                       | Key constraints                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `User`                   | Identity and account status; parent of role assignments, sessions, and token records.           | UUID primary key; unique normalized login email; password hash only; email verification defaults to false. |
| `Role`                   | Named application roles, including `student`, `lecturer`, `bursar`, `registrar`, and `admin`.   | UUID primary key; unique role name.                                                                        |
| `Permission`             | Permission keys aligned with the RBAC matrix, such as `finance:payment:record_bank_deposit`.    | UUID primary key; unique permission key.                                                                   |
| `UserRole`               | Join between users and roles.                                                                   | Composite primary key `(userId, roleId)`.                                                                  |
| `RolePermission`         | Join between roles and permissions.                                                             | Composite primary key `(roleId, permissionId)`.                                                            |
| `Session`                | Refresh-token hash and session metadata, including user agent, IP, expiry, and revocation time. | Unique token hash; indexes on `userId` and expiry.                                                         |
| `PasswordResetToken`     | Hashed, expiring, single-use password recovery token.                                           | Unique token hash; indexes on `userId` and expiry.                                                         |
| `EmailVerificationToken` | Hashed, expiring, single-use email verification token.                                          | Unique token hash; indexes on `userId` and expiry.                                                         |

All authentication and RBAC records have `createdAt` and `updatedAt` fields.
Foreign-key relations specify deletion behavior: deleting a user cascades to its
role assignments, sessions, and authentication tokens; deleting a role or
permission cascades only to its corresponding join records. The Prisma schema
uses `ACTIVE`, `SUSPENDED`, and `DISABLED` for `UserStatus`; login requires
`User.emailVerified` to be true, and verification tokens are single-use and
expire after 24 hours. Password-reset tokens are single-use and expire after
one hour. Role/permission grants must be checked against the matrix and must
not broaden record scope.

### Student information and academic structure

| Model                | Purpose and planned relationships                                                | Key constraints                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `AcademicYear`       | Groups academic periods.                                                         | Prevent overlapping or duplicate year identifiers according to the approved calendar rules.                                           |
| `Term`               | Period within an academic year; used by offerings and finance.                   | Relate to one academic year; define unique term numbering/labels within that year.                                                    |
| `Program`            | Organizes a student's course of study and relevant fee structures.               | Final program-to-course rules require registrar approval.                                                                             |
| `Course`             | Catalog-level course definition.                                                 | Use a stable course identifier; catalog changes must not rewrite historical offerings.                                                |
| `CourseOffering`     | A course delivered for a term/class, with the assigned teaching context.         | Link to its course and term; capacity and lecturer-assignment rules are enforced by services.                                         |
| `Student`            | Student-specific SIS record linked one-to-one with `User`.                       | `userId` is unique; preserve admission and enrollment history.                                                                        |
| `Lecturer`           | Lecturer-specific record linked one-to-one with `User`.                          | `userId` is unique; teaching access is scoped to assigned offerings.                                                                  |
| `AdmissionRecord`    | Application/admission history for an applicant and its review workflow.          | Keep review history; define how an accepted record links to the resulting student.                                                    |
| `Enrollment`         | Preserves a student's academic-program/term enrollment history.                  | Do not overwrite or delete prior enrollment history when a student changes status or program.                                         |
| `CourseRegistration` | Links a student to a specific course offering and registration attempt.          | Unique `(studentId, courseOfferingId)` for one registration record; preserve attempts/status history rather than destructive updates. |
| `TimetableSlot`      | Scheduled time and location for an offering or class session.                    | Clash detection is a service invariant; precise uniqueness depends on scheduling rules.                                               |
| `AttendanceRecord`   | Attendance outcome for a student at a scheduled session, including the recorder. | Scope reads to the student's own record or the lecturer's assigned class; confirm the session-level uniqueness rule before migration. |

`AcademicYear`, `Term`, `Program`, `Course`, and `CourseOffering` form the
academic catalog. Students and lecturers link to `User` with one-to-one
relationships. Students connect to offerings through course registrations;
enrollment and registration records are historical, not disposable join state.
The exact cardinality between programs, courses, and offerings must be settled
before the corresponding migration.

### Finance

| Model                 | Purpose and planned relationships                                     | Key constraints                                                                        |
| --------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `FeeStructure`        | Defines fees for an approved academic/program context.                | Validate that referenced academic years, terms, and programs are compatible.           |
| `FeeItem`             | An individual charge within a fee structure.                          | Store each amount as integer minor units and include currency.                         |
| `StudentInvoice`      | Student's billed charges for a term or other approved billing period. | Generation must be idempotent; retain invoice history.                                 |
| `PaymentReference`    | Student-facing reference tied to a student, term, and invoice.        | Unique reference number and unique `(studentId, termId, invoiceId)` combination.       |
| `Payment`             | Payment record linked to the student and the invoice/term it settles. | Amount is integer minor units; unique `(bankName, bankReference)` for bank deposits.   |
| `Receipt`             | Numbered evidence of a recorded payment.                              | Unique receipt number; preserve and mark `VOID` when the associated payment is voided. |
| `OutstandingBalance`  | Tracks or projects an unpaid amount.                                  | Must reconcile to the authoritative invoice and payment ledger.                        |
| `CarryForwardBalance` | Tracks an amount carried between billing periods.                     | Derivation and reconciliation rules must be explicit and auditable.                    |
| `TransactionLog`      | Append-only financial ledger/reversal record.                         | No update/delete; write with the associated payment transaction.                       |

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
- `Term` belongs to an `AcademicYear`; course offerings connect catalog courses
  to a term and class context.
- `CourseRegistration` links a student to a course offering. Enrollment,
  registration, admission, and attendance history must remain queryable.
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
- Unique `Student.userId` and `Lecturer.userId`.
- Student/offering registration pairs and foreign keys used for ownership
  filtering.
- Payment `(bankName, bankReference)`, payment-reference number, and receipt
  number.
- Feature-flag key and audit lookup by key, actor, and creation time.
- Frequently scoped records by student, course offering, term, status, and
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

- Whether `UserStatus` values should change before the first migration.
- Institution/tenant boundaries and whether an `Institution` model is needed.
- Final academic-year, term, program, course, offering, enrollment, and retake
  cardinalities.
- How payment allocations work when a payment covers multiple invoices or
  billing periods.
- Currency support and the relationship between currency codes and minor-unit
  scales.
- A transaction-safe strategy for sequential, gap-free receipt numbers.
- Final status enums, attendance uniqueness, and archival/deletion policies.
- Retention and redaction policy for IP addresses, authentication metadata,
  and audit records.

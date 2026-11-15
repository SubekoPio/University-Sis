# Role-Based Access Control Matrix

**Status:** Draft for human review
**Scope:** Proposed application permissions for the University SIS roles and modules.

This matrix is the authorization source of truth for application endpoints. Apply the least privilege needed for each action and enforce authorization on the server for every protected endpoint; hiding a UI control is not authorization.

## Roles

| Role        | Intended responsibility                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------- |
| `student`   | Manage permitted parts of their own student account and use services available to them.           |
| `lecturer`  | Teach assigned classes and manage their class materials, attendance, and academic work.           |
| `bursar`    | Manage finance records, including invoices, bank-deposit payments, receipts, and finance reports. |
| `registrar` | Manage student records, admissions, academic offerings, enrollments, and publication workflows.   |
| `admin`     | Administer users, permissions, configuration, and institution-wide operations.                    |

## Cell meanings

- **Y** — allowed for records within the scope named by the permission. For permissions containing `assigned`, scope access to classes/courses assigned to that lecturer.
- **OWN** — allowed only for records owned by the authenticated user. Enforce ownership in the API/data query; do not rely on a client-supplied user or record ID.
- **N** — not allowed.

`admin` access is limited to this institution and must be audited for sensitive operations. A permission does not grant access beyond its named scope. Unauthenticated authentication flows (for example, login and password recovery) are explicitly public entry points, rate-limited, and must not expose protected records.

## Permission matrix

| Permission                            | student | lecturer | bursar | registrar | admin |
| ------------------------------------- | :-----: | :------: | :----: | :-------: | :---: |
| `auth:profile:read_own`               |   OWN   |   OWN    |  OWN   |    OWN    |  OWN  |
| `auth:credentials:update_own`         |   OWN   |   OWN    |  OWN   |    OWN    |  OWN  |
| `auth:session:manage_own`             |   OWN   |   OWN    |  OWN   |    OWN    |  OWN  |
| `auth:user:manage`                    |    N    |    N     |   N    |     N     |   Y   |
| `auth:role_permission:manage`         |    N    |    N     |   N    |     N     |   Y   |
| `sis:admission:submit_own`            |   OWN   |    N     |   N    |     N     |   N   |
| `sis:admission:read_own`              |   OWN   |    N     |   N    |     N     |   N   |
| `sis:admission:review`                |    N    |    N     |   N    |     Y     |   Y   |
| `sis:student:read_own`                |   OWN   |    N     |   N    |     N     |   N   |
| `sis:student:read_assigned`           |    N    |    Y     |   N    |     Y     |   Y   |
| `sis:student:read_billing`            |    N    |    N     |   Y    |     N     |   Y   |
| `sis:student:create`                  |    N    |    N     |   N    |     Y     |   Y   |
| `sis:student:update`                  |    N    |    N     |   N    |     Y     |   Y   |
| `sis:student:update_own_contact`      |   OWN   |    N     |   N    |     N     |   N   |
| `sis:student:archive`                 |    N    |    N     |   N    |     Y     |   Y   |
| `academic:catalog:read`               |    Y    |    Y     |   N    |     Y     |   Y   |
| `academic:catalog:manage`             |    N    |    N     |   N    |     Y     |   Y   |
| `academic:enrollment:create_own`      |   OWN   |    N     |   N    |     N     |   N   |
| `academic:enrollment:read_own`        |   OWN   |    N     |   N    |     N     |   N   |
| `academic:enrollment:manage`          |    N    |    N     |   N    |     Y     |   Y   |
| `academic:class:read_assigned`        |    N    |    Y     |   N    |     Y     |   Y   |
| `academic:timetable:read_own`         |   OWN   |   OWN    |   N    |     N     |  OWN  |
| `academic:timetable:manage`           |    N    |    N     |   N    |     Y     |   Y   |
| `academic:attendance:record_assigned` |    N    |    Y     |   N    |     N     |   Y   |
| `academic:attendance:read_own`        |   OWN   |    N     |   N    |     N     |   N   |
| `academic:grades:submit_assigned`     |    N    |    Y     |   N    |     N     |   Y   |
| `academic:grades:read_own`            |   OWN   |    N     |   N    |     N     |   N   |
| `academic:grades:publish`             |    N    |    N     |   N    |     Y     |   Y   |
| `finance:invoice:read_own`            |   OWN   |    N     |   N    |     N     |   N   |
| `finance:invoice:read_all`            |    N    |    N     |   Y    |     N     |   Y   |
| `finance:invoice:manage`              |    N    |    N     |   Y    |     N     |   Y   |
| `finance:payment:record_bank_deposit` |    N    |    N     |   Y    |     N     |   Y   |
| `finance:payment:read_own_statement`  |   OWN   |    N     |   N    |     N     |   N   |
| `finance:payment:read_all`            |    N    |    N     |   Y    |     N     |   Y   |
| `finance:payment:void_bank_deposit`   |    N    |    N     |   Y    |     N     |   Y   |
| `finance:receipt:read_own`            |   OWN   |    N     |   N    |     N     |   N   |
| `finance:receipt:read_all`            |    N    |    N     |   Y    |     N     |   Y   |
| `finance:report:read`                 |    N    |    N     |   Y    |     N     |   Y   |
| `finance:online_payment:use_own`      |   OWN   |    N     |   N    |     N     |   N   |
| `finance:online_payment:manage_flags` |    N    |    N     |   N    |     N     |   Y   |
| `lms:material:read_enrolled`          |    Y    |    Y     |   N    |     N     |   Y   |
| `lms:material:manage_assigned`        |    N    |    Y     |   N    |     N     |   Y   |
| `lms:assignment:manage_assigned`      |    N    |    Y     |   N    |     N     |   Y   |
| `lms:submission:create_own`           |   OWN   |    N     |   N    |     N     |   N   |
| `lms:submission:read_own`             |   OWN   |    N     |   N    |     N     |   N   |
| `lms:submission:read_assigned`        |    N    |    Y     |   N    |     N     |   Y   |
| `lms:submission:grade_assigned`       |    N    |    Y     |   N    |     N     |   Y   |
| `lms:grade:read_own`                  |   OWN   |    N     |   N    |     N     |   N   |
| `exams:exam:manage`                   |    N    |    N     |   N    |     Y     |   Y   |
| `exams:exam:read_assigned`            |    N    |    Y     |   N    |     N     |   Y   |
| `exams:schedule:read_own`             |   OWN   |   OWN    |   N    |     N     |  OWN  |
| `exams:attempt:submit_own`            |   OWN   |    N     |   N    |     N     |   N   |
| `exams:eligibility:read_own`          |   OWN   |    N     |   N    |     N     |   N   |
| `exams:results:read_own`              |   OWN   |    N     |   N    |     N     |   N   |
| `exams:results:grade_assigned`        |    N    |    Y     |   N    |     N     |   Y   |
| `exams:results:publish`               |    N    |    N     |   N    |     Y     |   Y   |
| `reports:transcript:read_own`         |   OWN   |    N     |   N    |     N     |   N   |
| `reports:academic:read`               |    N    |    Y     |   N    |     Y     |   Y   |
| `reports:finance:read`                |    N    |    N     |   Y    |     N     |   Y   |
| `reports:institutional:read`          |    N    |    N     |   N    |     Y     |   Y   |
| `reports:workload:read_own`           |    N    |   OWN    |   N    |     N     |   N   |

## Enforcement and workflow constraints

- Match every route to a permission from this matrix. If no row fits, propose a narrowly scoped permission and update this document before implementation.
- Check both the actor's permission and the record scope, including ownership, enrollment, and lecturer assignment as applicable. Deny by default.
- Validate role and permission changes as privileged operations. Record administrative changes in an audit trail.
- Students may view their own finance statements and receipts, but cannot create or alter payment records. Finance staff record physical bank deposits and issue receipts.
- Online card, bank, and mobile payments are not active. The flags `payments.online.card`, `payments.online.bank`, and `payments.online.mobile` default OFF and must never be enabled in code or seed data. Even `admin` flag-management permission does not waive the release approval and activation procedure.
- Voiding a bank-deposit payment requires a written reason, an immutable audit/reversal record, and a different approver from the user who recorded it (maker-checker).

Review this matrix when roles, endpoints, or business workflows change. Keep API guards/decorators, UI access behavior, and authorization tests aligned with the reviewed matrix.

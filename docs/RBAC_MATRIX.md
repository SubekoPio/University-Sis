# Role-Based Access Control Matrix

**Status:** Draft for human review.

**Scope:** Application permissions for the University SIS roles and modules.

This matrix is the authorization source of truth for application endpoints.
Enforce permissions on the server for every protected endpoint; hiding a UI
control is not authorization. The key format is
`module:resource:action`. A role is a permission bundle, not an identity check:
users may hold multiple roles and receive the union of their permissions.
Unknown permissions and unlisted actions are denied by default.

## Roles

| Role                     | Responsibility                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `admin`                  | System accounts, role grants, settings, feature flags, and audit log. Has no admissions, academic, or finance access. |
| `admissions_officer`     | Enters applications and reviews application documents.                                                                |
| `admissions_head`        | Admits or rejects applicants and approves study-mode and student-schedule changes.                                    |
| `registrar`              | Academic catalogue, offerings, student records, and result publication.                                               |
| `bursar`                 | Records physical bank deposits, issues receipts, and confirms application fees.                                       |
| `finance_manager`        | Fee structures, payment voids, reconciliation, and finance reports.                                                   |
| `lecturer`               | Assigned classes, attendance, teaching materials, and mark entry.                                                     |
| `student`                | Own student, academic, and finance records and enrolled learning services.                                            |
| `hod`                    | Own-department lecturer assignment and mark moderation.                                                               |
| `dean`                   | Own-faculty curriculum and results oversight.                                                                         |
| `exams_officer`          | Exam scheduling, eligibility review, and mark moderation.                                                             |
| `communications_officer` | Institution-wide announcements and calendar.                                                                          |
| `support_desk`           | Account-status support and account recovery assistance; no academic or finance records.                               |
| `auditor`                | Read-only finance, admissions, and audit-log access.                                                                  |

## Cell meanings and scope

- **Y** — allowed for all records within the permission's named scope. Actions
  for lecturers are limited to assigned offerings where the permission says
  `assigned`.
- **OWN** — allowed only for the authenticated user's own records. Enforce
  ownership in the API and data query; never trust a client-supplied owner ID.
- **OWN-DEPT** — limited to the actor's own department.
- **OWN-FACULTY** — limited to the actor's own faculty.
- **N** — not allowed.

Every endpoint must check both the permission and its record scope. Do not
broaden a scope because a user holds another role. Public authentication
endpoints are limited to the explicitly unauthenticated flows and must not
expose protected records. System-generated effects (for example, creating a
student account after an approved admission) do not grant the caller unrelated
permissions.

## Permission matrix

| Permission                              | admin | admissions_officer | admissions_head | registrar | bursar | finance_manager | lecturer | student |   hod    |    dean     | exams_officer | communications_officer | support_desk | auditor |
| --------------------------------------- | :---: | :----------------: | :-------------: | :-------: | :----: | :-------------: | :------: | :-----: | :------: | :---------: | :-----------: | :--------------------: | :----------: | :-----: |
| `auth:profile:read_own`                 |  OWN  |        OWN         |       OWN       |    OWN    |  OWN   |       OWN       |   OWN    |   OWN   |   OWN    |     OWN     |      OWN      |          OWN           |     OWN      |   OWN   |
| `auth:credential:update_own`            |  OWN  |        OWN         |       OWN       |    OWN    |  OWN   |       OWN       |   OWN    |   OWN   |   OWN    |     OWN     |      OWN      |          OWN           |     OWN      |   OWN   |
| `auth:session:manage_own`               |  OWN  |        OWN         |       OWN       |    OWN    |  OWN   |       OWN       |   OWN    |   OWN   |   OWN    |     OWN     |      OWN      |          OWN           |     OWN      |   OWN   |
| `auth:user:manage`                      |   Y   |         N          |        N        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `admin:user:manage`                     |   Y   |         N          |        N        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `auth:role:grant`                       |   Y   |         N          |        N        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `auth:settings:manage`                  |   Y   |         N          |        N        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `auth:feature_flag:manage`              |   Y   |         N          |        N        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `auth:audit_log:read`                   |   Y   |         N          |        N        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    Y    |
| `support:account:read_status`           |   N   |         N          |        N        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      Y       |    N    |
| `support:account:unlock`                |   N   |         N          |        N        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      Y       |    N    |
| `support:credential:resend_recovery`    |   N   |         N          |        N        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      Y       |    N    |
| `sis:application:create_office`         |   N   |         Y          |        N        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `sis:application:read`                  |   N   |         Y          |        Y        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    Y    |
| `sis:document:review`                   |   N   |         Y          |        N        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `sis:admission:read_own`                |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `sis:admission:admit`                   |   N   |         N          |        Y        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `sis:admission:reject`                  |   N   |         N          |        Y        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `sis:study_mode:change_approve`         |   N   |         N          |        Y        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `sis:application_fee:confirm`           |   N   |         N          |        N        |     N     |   Y    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `admissions:application:manage`         |   N   |         Y          |        Y        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `admissions:document:review`            |   N   |         Y          |        Y        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `admissions:admit`                      |   N   |         N          |        Y        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `admissions:reject`                     |   N   |         N          |        Y        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `admissions:study-mode:change`          |   N   |         N          |        Y        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `admissions:fee:confirm`                |   N   |         N          |        N        |     N     |   Y    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `sis:student:read_own`                  |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `sis:student:read`                      |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `sis:student:create_after_admission`    |   N   |         N          |        Y        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `sis:student:update`                    |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `sis:student:update_contact_own`        |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `sis:student:archive`                   |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:catalog:read`                 |   N   |         N          |        N        |     Y     |   N    |        N        |    Y     |    Y    |    Y     |      Y      |       Y       |           N            |      N       |    N    |
| `academic:structure:manage`             |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:programme:manage`             |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:intake:manage`                |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:course_unit:manage`           |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:curriculum:manage`            |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:curriculum:approve`           |   N   |         N          |        N        |     N     |   N    |        N        |    N     |    N    |    N     | OWN-FACULTY |       N       |           N            |      N       |    N    |
| `academic:offering:manage`              |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:offering:assign-lecturer`     |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:session:manage`               |   N   |         N          |        N        |     Y     |   N    |        N        |   OWN    |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:lecturer_assignment:manage`   |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    | OWN-DEPT |      N      |       N       |           N            |      N       |    N    |
| `academic:offering:read_enrolled`       |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    Y    |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:class:read_assigned`          |   N   |         N          |        N        |     Y     |   N    |        N        |    Y     |    N    | OWN-DEPT |      N      |       N       |           N            |      N       |    N    |
| `academic:classlist:read`               |   N   |         N          |        N        |     N     |   N    |        N        |   OWN    |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:enrollment:create_own`        |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:enrollment:read_own`          |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:enrollment:manage`            |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:unit:select`                  |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:session:attend`               |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:timetable:manage`             |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:timetable:read_own`           |   N   |         N          |        N        |     N     |   N    |        N        |   OWN    |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:attendance:record_assigned`   |   N   |         N          |        N        |     N     |   N    |        N        |    Y     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:attendance:read_own`          |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:attendance:override_assigned` |   N   |         N          |        N        |     N     |   N    |        N        |    Y     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `attendance:review`                     |   N   |         N          |        N        |     N     |   N    |        N        |   OWN    |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `attendance:override`                   |   N   |         N          |        N        |     N     |   N    |        N        |   OWN    |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:grades:enter_assigned`        |   N   |         N          |        N        |     N     |   N    |        N        |    Y     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:grades:moderate_department`   |   N   |         N          |        N        |     N     |   N    |        N        |    N     |    N    | OWN-DEPT |      N      |       N       |           N            |      N       |    N    |
| `academic:grades:moderate_exam`         |   N   |         N          |        N        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       Y       |           N            |      N       |    N    |
| `academic:grades:approve_faculty`       |   N   |         N          |        N        |     N     |   N    |        N        |    N     |    N    |    N     | OWN-FACULTY |       N       |           N            |      N       |    N    |
| `academic:grades:read_own`              |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `academic:results:publish`              |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `finance:statement:read_own`            |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `finance:fee_structure:manage`          |   N   |         N          |        N        |     N     |   N    |        Y        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `finance:invoice:read_own`              |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `finance:invoice:read_all`              |   N   |         N          |        N        |     N     |   Y    |        Y        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    Y    |
| `finance:payment:record_bank_deposit`   |   N   |         N          |        N        |     N     |   Y    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `finance:payment:read_own`              |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `finance:payment:read_all`              |   N   |         N          |        N        |     N     |   Y    |        Y        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    Y    |
| `finance:payment:void_bank_deposit`     |   N   |         N          |        N        |     N     |   N    |        Y        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `finance:payment:reconcile`             |   N   |         N          |        N        |     N     |   N    |        Y        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `finance:receipt:issue`                 |   N   |         N          |        N        |     N     |   Y    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `finance:receipt:read_own`              |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `finance:receipt:read_all`              |   N   |         N          |        N        |     N     |   Y    |        Y        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    Y    |
| `finance:report:read`                   |   N   |         N          |        N        |     N     |   N    |        Y        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    Y    |
| `lms:material:read_enrolled`            |   N   |         N          |        N        |     N     |   N    |        N        |    Y     |    Y    |    N     |      N      |       N       |           N            |      N       |    N    |
| `lms:material:manage_assigned`          |   N   |         N          |        N        |     N     |   N    |        N        |    Y     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `lms:assignment:manage_assigned`        |   N   |         N          |        N        |     N     |   N    |        N        |    Y     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `lms:submission:create_own`             |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `lms:submission:read_own`               |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `lms:submission:read_assigned`          |   N   |         N          |        N        |     N     |   N    |        N        |    Y     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `lms:submission:grade_assigned`         |   N   |         N          |        N        |     N     |   N    |        N        |    Y     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `exams:exam:manage`                     |   N   |         N          |        N        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       Y       |           N            |      N       |    N    |
| `exams:exam:read_assigned`              |   N   |         N          |        N        |     N     |   N    |        N        |    Y     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `exams:schedule:read_own`               |   N   |         N          |        N        |     N     |   N    |        N        |   OWN    |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `exams:attempt:submit_own`              |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `exams:eligibility:read_own`            |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `exams:eligibility:override`            |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    |    N     |      N      |       Y       |           N            |      N       |    N    |
| `exams:results:read_own`                |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `exams:results:moderate`                |   N   |         N          |        N        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       Y       |           N            |      N       |    N    |
| `reports:transcript:read_own`           |   N   |         N          |        N        |     N     |   N    |        N        |    N     |   OWN   |    N     |      N      |       N       |           N            |      N       |    N    |
| `reports:academic:read`                 |   N   |         N          |        N        |     Y     |   N    |        N        |    Y     |    N    | OWN-DEPT | OWN-FACULTY |       Y       |           N            |      N       |    N    |
| `reports:institutional:read`            |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `communications:announcement:manage`    |   N   |         N          |        N        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           Y            |      N       |    N    |
| `communications:calendar:manage`        |   N   |         N          |        N        |     N     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           Y            |      N       |    N    |
| `announcements:manage`                  |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `announcements:post-own`                |   N   |         N          |        N        |     N     |   N    |        N        |   OWN    |    N    |    N     |      N      |       N       |           N            |      N       |    N    |
| `calendar:event:manage`                 |   N   |         N          |        N        |     Y     |   N    |        N        |    N     |    N    |    N     |      N      |       N       |           N            |      N       |    N    |

## Phase 2 permission additions by role

The following additions and assignments come from Phase 2 Prompt 2.7. `OWN`
means the authenticated user's own records; for lecturers it means sessions or
offerings assigned to them. The lecturer's `announcements:post-own` scope is
limited to their own offerings.

| Role                 | Phase 2 permissions                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin`              | `admin:user:manage` (existing Phase 1 permission only). No Phase 2 admissions, academic, or finance permissions.                                                                                        |
| `admissions_officer` | `admissions:application:manage`; `admissions:document:review`.                                                                                                                                          |
| `admissions_head`    | `admissions:application:manage`; `admissions:document:review`; `admissions:admit`; `admissions:reject`; `admissions:study-mode:change`. The reviewer cannot admit the same application.                 |
| `registrar`          | `academic:structure:manage`; `academic:curriculum:manage`; `academic:offering:manage`; `academic:offering:assign-lecturer`; `academic:session:manage`; `announcements:manage`; `calendar:event:manage`. |
| `bursar`             | `admissions:fee:confirm` (application fee only in Phase 2).                                                                                                                                             |
| `lecturer`           | `academic:session:manage` (OWN); `academic:classlist:read` (OWN); `attendance:review` (OWN); `attendance:override` (OWN); `announcements:post-own` (own offerings).                                     |
| `student`            | `academic:unit:select` (OWN); `academic:session:attend` (OWN).                                                                                                                                          |

The secured website application endpoint is system-to-system, authenticated by
its integration secret; it is not an extra permission for a human role.
`academic:curriculum:manage` and `academic:offering:manage` already existed in
the matrix and are reused by this Phase 2 mapping.

## Separation of duties

Enforce these workflow constraints in addition to the permission checks:

| Workflow                    | Required control                                                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bank-deposit payment        | The user who records a payment cannot void it. A `finance_manager` other than the recorder must perform the void, provide a written reason, and create an immutable audit/reversal record. |
| Admission                   | The document reviewer cannot be the user who admits the applicant. Rejecting and approving study-mode or student-schedule changes are restricted to `admissions_head`.                     |
| Admin role grant or removal | A second administrator must approve the change; the initiating administrator cannot approve their own grant or removal.                                                                    |
| Results                     | Lecturers enter marks; an HOD or exams officer moderates; the registrar publishes. A user must not satisfy multiple workflow stages on their own.                                          |
| Audit                       | `auditor` is read-only. Sensitive actions are recorded in the append-only audit log.                                                                                                       |

The `admin` role has no admissions, academic, or finance permissions. Admin
access to feature flags does not bypass change approval: online card, bank, and mobile payments
remain unavailable while their respective flags
(`payments.online.card`, `payments.online.bank`, and `payments.online.mobile`)
are OFF. Enabling one requires written approval through the release procedure.
Do not enable these flags in application code or seed data.

## Enforcement and maintenance

- Check permissions, never role names, in application code. If a route has no
  matching permission, add a narrowly scoped row here before implementing it.
- Enforce permission checks and record scope on every protected server
  endpoint. UI visibility is not an authorization control.
- Preserve separation-of-duties checks in the service/workflow even when an
  actor has multiple roles; permissions are a union but cannot cancel these
  controls.
- Audit role grants, payment actions, admissions decisions, mark changes,
  moderation, and result publication.
- Review role assignments each intake; use one account per person and disable
  accounts promptly when staff leave.

Review this matrix when roles, endpoints, or business workflows change. Keep
API authorization, UI access behavior, and authorization tests aligned with
this document.

## Codebase drift review (2026-11-22)

The matrix is the intended authorization policy, but several sections do not
describe current runtime coverage:

- **Status and Roles:** the matrix lists 14 roles, while `prisma/seed.ts`
  provisions the five original roles plus `admissions_officer` and
  `admissions_head`. The remaining roles and their permissions are not
  provisioned by the current seed.
- **Permission matrix / seed alignment:** seed keys and grants do not match
  this matrix in legacy areas. Phase 2 permissions listed below are now seeded
  idempotently; the seed removes legacy admissions, academic, finance, LMS,
  examination, and report grants from `admin` on rerun. Other legacy permission
  aliases still require reconciliation before treating the full matrix as
  effective runtime authorization.
- **Enforcement and maintenance:** only
  `AdminUsersController` currently declares `@Permissions("admin:user:manage")`.
  The other matrix rows are policy for future endpoints, not evidence that
  those checks are already implemented.
- **Separation of duties:** the admin user service prevents self-deactivation
  and rejects admin-capability changes until a second-approver workflow exists.
  Payment, admissions, and result-stage separation rules remain requirements
  for business modules that are not yet implemented.
- **Phase 2 permissions:** the additions above are provisioned by the seed.
  Legacy `sis:*` and earlier `academic:*` permissions overlap with some new
  Phase 2 keys; reconcile those aliases before implementing endpoints.

Review these gaps with the RBAC seed and API implementation before describing
the complete matrix as enforced in production.

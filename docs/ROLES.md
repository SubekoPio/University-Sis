# University SIS Roles

**Status:** Draft for human review.

**Source:** Phase 0 role model in the
[development roadmap](./School_System_Copilot_Roadmap.md#12-roles--administrative-structure).

**Authorization source of truth:** [RBAC matrix](./RBAC_MATRIX.md).

Roles group permissions around institutional jobs; they are not authorization
checks in application code. A user may hold several roles, and receives the
union of their permissions, subject to the separation-of-duties controls in
the RBAC matrix. Access is denied by default. Create one account per person;
do not use shared accounts.

The staffing estimates below are planning ranges, not staffing requirements.
Small institutions have about 2,000 students or fewer and 1–2 faculties;
medium institutions have about 2,000–10,000 students and 4–6 faculties; large
institutions have more than 10,000 students. Adjust estimates to the
institution's actual structure. Counts for `lecturer` and `student` are
institution-dependent because the roadmap does not prescribe headcount
ratios. A person can hold multiple roles (for example, an HOD is usually also
a lecturer), so role counts overlap and should not be added as unique people.

## Role catalogue and account estimates

| Role key                   | Purpose                                                                                                                                 | First phase needed                                   |                                             Small |                                            Medium |                                             Large |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------: | ------------------------------------------------: | ------------------------------------------------: |
| `admin`                    | System administration: accounts, role grants, settings, feature flags, and audit-log access. No grades, money, or admissions decisions. | Phase 1                                              |                                                 2 |                                               2–3 |                                               3–5 |
| `admissions_officer`       | Enters applications and reviews supporting documents.                                                                                   | Phase 2                                              |                                               1–2 |                                               3–5 |                                              8–15 |
| `admissions_head`          | Admits or rejects applicants and approves study-mode and student-schedule changes.                                                      | Phase 2                                              |                                                 1 |                                               1–2 |                                               2–3 |
| `registrar`                | Manages programmes, intakes, course units, curriculum, offerings, lecturer assignments, student records, and result publication.        | Phase 1 (role/bootstrap); expanded in Phases 2 and 5 |                                               1–2 |                                               3–5 |                                              6–10 |
| `bursar` (Finance Officer) | Records physical bank deposits, issues receipts, and confirms application fees.                                                         | Phase 1 (role/bootstrap); operational from Phase 2   |                                               2–3 |                                               4–8 |                                             10–20 |
| `finance_manager`          | Manages fee structures, payment voids, reconciliation, and finance reports.                                                             | Phase 3                                              |                                                 1 |                                               1–2 |                                               2–4 |
| `lecturer`                 | Teaches assigned offerings, manages teaching materials and attendance, and enters marks.                                                | Phase 1                                              | All academic teaching staff; institution-specific | All academic teaching staff; institution-specific | All academic teaching staff; institution-specific |
| `student`                  | Uses services for their own student record, course units, timetable, attendance, results, and financial statements.                     | Phase 1                                              |       All enrolled students; about 2,000 or fewer |         All enrolled students; about 2,000–10,000 |           All enrolled students; more than 10,000 |
| `hod`                      | Manages lecturer assignments and moderates marks within the HOD's own department.                                                       | Phase 2 (optional); moderation by Phase 5            |                                               3–6 |                                             12–25 |                                             30–40 |
| `dean`                     | Oversees faculty reports, curriculum changes, and results moderation within the dean's own faculty.                                     | Phase 5 (reports by Phase 6)                         |                                               1–2 |                                               4–6 |                                              8–12 |
| `exams_officer`            | Manages exam schedules, checks results, and handles eligibility overrides with the registrar.                                           | Phase 5                                              |                                                 1 |                                               2–4 |                                              5–10 |
| `communications_officer`   | Manages institution-wide announcements and the calendar.                                                                                | Phase 2 (optional)                                   |                                               0–1 |                                               1–2 |                                               2–4 |
| `support_desk`             | Helps with account status and recovery, without access to academic or finance records.                                                  | Phase 2 (as support operations are introduced)       |                                                 1 |                                               2–3 |                                              5–10 |
| `auditor`                  | Read-only access to finance, admissions, and audit records. May be an external account.                                                 | Phase 7                                              |                                               0–1 |                                               1–2 |                                               2–4 |

The roadmap estimates approximately 14–23, 35–65, and 80–140 staff accounts
with administrative roles for small, medium, and large institutions,
respectively. This is a rough planning total; role overlap, local staffing
choices, and external auditors affect the actual number. The estimates do not
include student accounts or the full lecturer population.

## Separation of duties

- The person who records a bank-deposit payment cannot void it. A different
  `finance_manager` must perform and document the void.
- The document reviewer cannot be the person who admits the applicant.
- Granting or removing `admin` requires approval by a second administrator.
- Lecturers enter marks; an HOD or exams officer moderates; the registrar
  publishes results.
- `auditor` is read-only. The `admin` role has no grades, money, or admissions
  decision permissions.

See the [RBAC matrix](./RBAC_MATRIX.md) for action-level grants, scopes, and
additional controls.

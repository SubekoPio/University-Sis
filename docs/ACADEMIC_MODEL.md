<!-- Purpose: Define the academic, admissions, attendance, announcement, and calendar domain. -->

# Academic Domain Model

**Status:** Phase 2 design draft, based on the [roadmap](./School_System_Copilot_Roadmap.md)
and [prompt library](./School_System_Copilot_Prompts.md). Academic structure,
course-unit curriculum and offerings, student and lecturer profiles, and
enrollment/registration, admissions, class-session, attendance, announcement,
and calendar models are implemented in Prisma. Academic-structure services are
implemented, and course-unit, curriculum, and offering services are now
implemented without HTTP controllers or guards. Domain APIs and later workflow
services remain planned.

## Academic hierarchy

```text
Faculty
└── Department
    └── Programme
        └── Curriculum (by study year and intake slot)
            └── CourseUnit
                └── Offering (one per course unit per intake)
                    └── ClassSession
                        └── Attendance (one student per session)
```

A programme belongs to a department; a department belongs to a faculty.
Curriculum maps course units to a programme, study year, and intake slot.
Course units are owned by a department but may be eligible for use by multiple
programmes or faculties. An offering is the shared delivery instance for one
course unit in one intake. Sessions are dated meetings generated from the
offering's timetable; attendance is recorded for each student in each session.

The Prisma schema represents curriculum placement with `ProgrammeCourseUnit`,
elective-credit bounds with `ProgrammeElectiveRule`, faculty eligibility with
`CourseUnitFacultyEligibility`, prerequisites with `CourseUnitPrerequisite`,
and shared delivery with `CourseUnitOffering`.

The academic services validate active departments and faculties before catalogue
writes. Curriculum updates replace one programme slot atomically, enforce the
programme's study-year range and general-unit faculty eligibility, and reject
prerequisite changes that create a cycle. Offering operations reject duplicate
unit/intake pairs, create shared offerings from distinct curriculum units, and
copy lecturer roles and capacity from the chronologically previous intake;
copied offerings start in `PLANNED`.

Applications and admissions form the account-creation path into this hierarchy:

```text
Application → document review → application-fee confirmation
→ admission (programme, intake, study mode, student schedule) → Student
```

## Academic years and intakes

Each academic year has exactly three intakes, identified by sequence 1, 2, and 3. Intake names, start/end dates, and course-unit selection windows are
configuration data, not enum values or hard-coded calendar assumptions.
January, May, and September are suggested defaults only. Each intake belongs
to one academic year and has its own lifecycle and selection window.

Curriculum placement uses study year and intake slot 1–3. Course-unit
selection is available only in the configured window and is auto-approved when
all eligibility, prerequisite, capacity, and elective-credit rules pass.

## Course-unit categories

- **Core:** required by the programme curriculum for its study year and intake
  slot.
- **Elective:** available to eligible students, subject to configurable
  minimum and maximum elective credits for the programme, study year, and
  intake slot.
- **Retake:** a previously attempted course unit that the student is eligible
  to take again. Retake eligibility and the effect of repeated results must
  follow an approved academic policy; the roadmap does not settle those rules.
- **General (shared):** a course unit marked general, eligible to students from
  specified faculties or open to all faculties. Eligibility is checked before
  selection.

Course-unit levels are `LEVEL_100`, `LEVEL_200`, `LEVEL_300`, or `LEVEL_400`.
Course-unit statuses are `ACTIVE`, `INACTIVE`, or `RETIRED`; offering statuses
are `PLANNED`, `OPEN`, `CLOSED`, or `CANCELLED`. Curriculum placement uses
`CORE` or `ELECTIVE`, and a course unit is placed at most once in a programme.
Multiple elective-credit rules may be stored for the same programme, study
year, and intake slot.

The course-unit list after admission is preloaded from the student's programme
curriculum. Each intake, the student is prompted with eligible core units,
electives, retakes, and general units.

The unit-selection service applies the intake's configured selection window;
the same closing time is the student drop deadline. Core units are compulsory,
and an override authorized by `academic:enrollment:manage` may bypass only that
window. Overrides retain eligibility, prerequisite, capacity, timetable, core,
and elective-credit validation and are written to `AuditLog` with a reason.
Elective-credit rows are alternative allowed ranges: the selected elective
credit total must fit at least one configured range.

Until assessment outcomes are modeled, a `COMPLETED` registration from an
earlier intake is the available evidence that a prerequisite was passed.
Failed or missed outcomes cannot yet be identified, so retake prompts are
empty. The schema also has no overall credit-load setting; selection currently
enforces only the configured elective-credit ranges.

## Offerings and shared classes

There is exactly one offering for a given course unit and intake. Its unique
identity is `(courseUnitId, intakeId)`, not programme plus intake. Every
eligible student, regardless of programme, selects that same offering and
shares its class list, timetable, assigned lecturer(s), learning materials, and
assessment context. General-unit faculty eligibility determines who may join;
it does not create duplicate programme-specific offerings.

The registrar assigns one primary lecturer and may assign assistants.
Assignments can be replaced without changing their role or removed. Lecturer
visibility and attendance actions are limited to assigned offerings. Capacity,
prerequisites, programme eligibility, intake windows, and elective-credit
rules are validated before a student's selection is accepted.

## Admissions and student account creation

1. An applicant applies through the university website, a separate system that
   calls `POST /integrations/applications` using either the `x-api-key` header
   or an `x-signature: sha256=<hex>` HMAC of the exact request body with
   `WEBSITE_INTEGRATION_SECRET`; the endpoint is rate limited and idempotent by
   the website's `externalRef`. Staff can also enter applications at the
   admission office.
2. The admissions officer enters office applications and reviews each required
   document, recording an outcome and note. ID, transcript, certificate, and
   photo are required; an `OTHER` document is optional. The admissions head
   also has the Phase 2 document-review permission, but must not review an
   application they admit.
3. The bursar confirms the application fee against its bank reference. This is
   a physical bank-deposit record in integer minor units, checked against
   `APPLICATION_FEE_AMOUNT_MINOR` and `CURRENCY`; duplicate bank/reference
   pairs are rejected. Voiding requires a different user and a reason, and
   preserves the original record. The broader payment and receipt workflow
   belongs to Phase 3.
4. An admissions head admits or rejects the applicant. Admission records the
   selected programme, intake, study mode (`ONLINE` or `PHYSICAL`), and student
   schedule (`DAY`, `EVENING`, `WEEKEND`, or `DISTANCE`). A user who approved
   any application document must not admit that same application.
5. On admission, one transaction creates the student account, profile,
   admission record, programme enrollment, and intake registration. The system
   sends temporary login credentials only after commit; failed delivery is
   audited and credentials can be rotated and resent. The account must change
   its temporary password at first login; there is no public sign-up.
6. The first study year's course units for the admitted intake slot are
   derived from the programme curriculum and enrollment and returned as
   prompted units. No `UnitRegistration` is created until the student selects
   a course unit.

Staff accounts are created by administrators. Applicants become students only
through admission; they never create their own SIS accounts.

The application and admission record store `studyMode` and `schedule`
separately. Study mode records the applicant's online or physical mode;
schedule records the student's regular time pattern. Neither determines the
delivery mode of a shared course-unit offering.

Student profiles are created only within admission. Student archive operations
deactivate the linked user account and revoke its sessions while retaining the
profile and all academic history. Student-number uniqueness is enforced by the
database, and profile searches use bounded pagination. An admissions head with
`admissions:study-mode:change` may change the mode of an admitted application
only with a written reason; the application and admission record are updated
atomically and the previous and new values are recorded in `AuditLog`.
Programme-enrollment status changes and intake progression are audited and
never delete enrollment rows. Progression requires the student's registration
for a closed intake, advances through the three intake slots, and marks the
enrollment complete after the programme's final slot. Lecturer profiles link
an existing account to an active department.

## Student schedule and offering delivery

`Student.schedule` is `DAY`, `EVENING`, `WEEKEND`, or `DISTANCE`. It describes
the student's regular schedule and may affect timetabling, fees, and lecturer
allowances. Schedule changes are recorded in the existing `AuditLog`.

`CourseUnitOffering.deliveryMode` is `PHYSICAL`, `ONLINE`, or `HYBRID`. It
describes delivery for one shared course-unit offering and can differ between
offerings selected by the same student. It does not change the student's
schedule.

| Field             | Values                                  | Meaning                                           |
| ----------------- | --------------------------------------- | ------------------------------------------------- |
| Student schedule  | `DAY`, `EVENING`, `WEEKEND`, `DISTANCE` | Student's regular cohort schedule.                |
| Offering delivery | `PHYSICAL`, `ONLINE`, `HYBRID`          | Delivery format of one course unit in one intake. |

Online students see an **Attend** action when a session is open. A meeting URL
is available only through the explicit Attend flow to an eligible student; it
is never included in offering, list, or detail responses. Physical and hybrid
offerings may expose the venue and timetable as applicable. Session delivery
is configured for the offering/session, not inferred from the student's
schedule. Delivery-mode changes are recorded in `AuditLog`.

## Attendance

Online attendance is based on presence intervals with reliable join and leave
times from a provider report, import, or approved adapter. Clicking Attend or
opening a meeting link alone does not prove presence, and presence time does
not prove attention.

An online student is marked `PRESENT` only when their longest continuous stay
in the session, with reconnects merged only within the configured grace
period, reaches the configured minimum share of the scheduled session. Gaps
longer than the grace period break continuity. Separate, interrupted stays
must never be added together to meet the threshold.

| Setting                              |     Default | Meaning                                                                                                       |
| ------------------------------------ | ----------: | ------------------------------------------------------------------------------------------------------------- |
| `ATTENDANCE_MIN_CONTINUOUS_PERCENT`  |         75% | Minimum share of session duration required in one continuous stay to count as present online.                 |
| `ATTENDANCE_RECONNECT_GRACE_SECONDS` | 180 seconds | Maximum reconnect gap that may be merged into the continuous stay.                                            |
| `ATTENDANCE_WARNING_PERCENT`         |         75% | Attendance percentage below which the home page warns the student; this is not the online presence threshold. |

All three settings are configurable. Physical attendance is marked by the
lecturer. An external meeting link without join/leave data cannot calculate
online attendance. `AttendanceRule` is one global configuration row used by all
sessions; the warning percentage is distinct from the online presence threshold.

## Calendar projection

Persist authored holidays, academic events, and general events as
`CalendarEvent` records. Build intake dates from `Intake` and class sessions
from `ClassSession` when composing a calendar; do not duplicate either source
as a calendar event.

## Phase 2 permissions

The detailed role-to-permission assignments are in
[RBAC_MATRIX.md](./RBAC_MATRIX.md). The permission names are taken from the
Phase 2 RBAC prompt; the permission union does not override separation of
duties or record scopes. The website integration is authenticated as a
system-to-system caller, not as one of the human roles.

## Proposed Copilot instruction additions

**Review draft only — not applied to `.github/copilot-instructions.md`.** The
file already contains the base terminology, no-public-sign-up, and continuous
attendance rules. This draft makes the intake configuration and attendance
defaults explicit:

```text
- Terminology: use "intake" (never "term" or "semester"), "programme", and
  "course unit". Each academic year has exactly three intakes; names and dates
  are configurable data.
- No public sign-up: admins create staff accounts; students receive accounts
  only after admission.
- Online attendance: mark PRESENT only when the longest continuous stay,
  merging reconnects within the configured grace, reaches the configured share
  of the session. Never add interrupted stays together. Defaults are 75% of
  session duration, 180 seconds reconnect grace, and a 75% home-page warning
  threshold; all are configurable.
```

## Existing terminology and sign-up references to review

The matches below are legacy domain language or archived instructions. Mentions
of the prohibited words in a rule saying not to use them are not violations;
course-unit selection/registration is also not public account sign-up.

| File and section                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Existing wording                                                                     | Review                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md), Finance domain boundary                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | "academic term/enrollment context"                                                   | Replace with intake context.                                                                                                                 |
| [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md), Student information and academic structure, Finance, Relationship and access invariants, Index requirements, and Decisions still required                                                                                                                                                                                                                                                                                                                                                        | `Term`, term-based offerings/enrollment/payment references, and term model decisions | Replace domain concepts with intake, programme, and course unit. Retain `intakeId` rather than introducing a term entity.                    |
| [`School_System_Copilot_Roadmap.md`](./School_System_Copilot_Roadmap.md), original Phase 1 Auth Services and follow-up update/exit-criteria text                                                                                                                                                                                                                                                                                                                                                                                               | `register` endpoint and public registration references                               | Historical Phase 1 wording; mark superseded by the no-public-sign-up update.                                                                 |
| [`School_System_Copilot_Prompts.md`](./School_System_Copilot_Prompts.md), Phase 1 prompts 1.3 and 1.4                                                                                                                                                                                                                                                                                                                                                                                                                                          | Public `/auth/register` route and throttling                                         | Outdated implementation instructions; retain only as history or label superseded. Later Phase 1 prompts correctly remove and test the route. |
| [`phases/phase-0/step-0.14-governance-scaffolding.md`](./phases/phase-0/step-0.14-governance-scaffolding.md), security review                                                                                                                                                                                                                                                                                                                                                                                                                  | Says the public `/auth/register` route is currently exposed                          | Outdated status; the route was later removed.                                                                                                |
| [`phases/phase-1/step-1.16-admin-user-management-service.md`](./phases/phase-1/step-1.16-admin-user-management-service.md), limitations                                                                                                                                                                                                                                                                                                                                                                                                        | Says the public registration endpoint is outside that step                           | Outdated current-state statement; later auth work removed the route.                                                                         |
| [`phases/phase-1/step-1.3-auth-services.md`](./phases/phase-1/step-1.3-auth-services.md), [`step-1.4-auth-controller.md`](./phases/phase-1/step-1.4-auth-controller.md), [`step-1.6-password-recovery-email-verification.md`](./phases/phase-1/step-1.6-password-recovery-email-verification.md), [`step-1.7-auth-tests.md`](./phases/phase-1/step-1.7-auth-tests.md), [`step-1.9-account-recovery-tests.md`](./phases/phase-1/step-1.9-account-recovery-tests.md), and [`adr/0003-auth-email-delivery.md`](./adr/0003-auth-email-delivery.md) | Registration/signup workflow and verification references                             | Historical descriptions; do not treat as current public-account creation behavior.                                                           |

The Phase 1 prompt references that explicitly test `/auth/register` returns
404, the Phase 1 development-log entries, and the later no-public-sign-up
instructions describe the removal and are not contradictory current policy.
The Roadmap and prompt-library mentions of "term" and "semester" occur in
prohibitions, not as academic-period names.

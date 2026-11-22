# Phase 2 / Step 2.16: Controllers and RBAC

## Goal

Expose the implemented Phase 2 admissions and academic services through
validated, Swagger-documented HTTP controllers without moving business logic
out of the service layer.

## What Was Built

- Added admissions application, document review, application-fee, admission,
  credential resend, rejection, and study-mode endpoints.
- Added registrar controllers for academic structure, curriculum, course units,
  offerings, lecturer assignment, student records, sessions, announcements,
  calendar, and registrar home.
- Added lecturer-owned offering, session, report import, physical attendance,
  attendance override, announcement, calendar, and home endpoints.
- Added student-owned unit prompt/select/drop, timetable, Attend, attendance,
  announcement, calendar, and home endpoints.
- Added shared pagination and Phase 2 HTTP DTOs with `class-validator`,
  `class-transformer`, and Swagger decorators.

## Key Decisions

- Kept controllers as thin HTTP adapters; all mutations and authorization scope
  checks remain in services and repositories.
- Applied both `@Roles` and `@Permissions` as defense in depth. Permissions
  remain the source of authorization scope and roles provide the matrix's role
  boundary.
- Used `admissions:application:manage` plus `admissions:reject` for application
  rejection and `admissions:study-mode:change` for study-mode changes.
- Did not expose application-fee void authority in this step; only bursar
  application-fee confirmation is available.

## Business Rules

- Admin endpoints remain limited to the existing staff-account permission.
- Admissions officers can manage applications and review documents; admissions
  heads alone admit, reject, and change study mode.
- Registrar endpoints manage academic structure, curriculum, offerings,
  sessions, announcements, and calendar.
- Lecturer actions are scoped by existing OWN/assigned-offering service checks.
- Student actions are scoped by existing OWN student and enrollment checks.
- Meeting URLs remain absent from list/detail responses; the Attend endpoint
  alone may return a join URL.

## How to Run & Test

Run `pnpm typecheck` from `apps/api` and `pnpm build` from `apps/api`.
No implementation tests were added in this controller step; tests remain a
separate Phase 2 micro-phase as required by project instructions.

## Data/Permissions Impact

- No Prisma schema or migration changes.
- No permission seed changes.
- Endpoints use the Phase 2 permission keys from `docs/RBAC_MATRIX.md`.

## Known Limitations

- Application listing/detail repository surfaces are not yet present in the
  existing `ApplicationsService`; this step exposes the implemented create,
  update, withdrawal, admission, document, and fee operations.
- Provider attendance ingestion and report import remain separate service
  capabilities and are not broadened by these controllers.

## Copilot Usage

Copilot generated the HTTP adapter files and DTOs after inspecting the existing
Phase 2 services and RBAC matrix. Human review is required for route semantics
and role/permission metadata.

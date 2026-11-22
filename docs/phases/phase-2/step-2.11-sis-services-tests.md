<!-- Purpose: Record the separately scoped Phase 2.11 SIS service tests. -->

# Phase 2 / Step 2.11: SIS Services Tests

## Goal

Verify student-profile access and archival, study-mode audit behavior,
enrollment status transitions and progression, lecturer-profile authorization,
and transactional persistence boundaries.

## What Was Tested

- Student admission-profile creation, search pagination, own-record scope,
  restricted contact updates, archival, and study-mode change authorization.
- Enrollment-history ownership, defer transitions, progression across intake
  slots, final-programme completion, and rejection before intake closure.
- Lecturer-profile creation, department linkage, permission checks, and unique
  staff-number conflicts.
- Repository transactions for student creation and archival, study-mode audit
  writes, lecturer creation, and intake progression.
- The admission workflow's integration with `StudentsService` and its
  post-commit credential email ordering.

## How to Run & Test

- `corepack pnpm@12.21.0 --filter @school/api exec vitest run src/academic/students.service.spec.ts src/academic/students.repository.spec.ts src/academic/programme-enrollment.service.spec.ts src/academic/programme-enrollments.repository.spec.ts src/academic/lecturers.service.spec.ts src/academic/lecturers.repository.spec.ts src/admissions/admissions.service.spec.ts src/admissions/admissions.repository.spec.ts` — passed; 8 files and 36 tests.
- `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
- `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
- `corepack pnpm@12.21.0 --filter @school/api build` — passed.
- `corepack pnpm@12.21.0 --filter @school/api exec prettier --check --single-quote=false --print-width 100 src/academic/academic.module.ts src/academic/sis.types.ts src/academic/students.repository.ts src/academic/students.service.ts src/academic/students.repository.spec.ts src/academic/students.service.spec.ts src/academic/lecturers.repository.ts src/academic/lecturers.service.ts src/academic/lecturers.repository.spec.ts src/academic/lecturers.service.spec.ts src/academic/programme-enrollments.repository.ts src/academic/programme-enrollment.service.ts src/academic/programme-enrollments.repository.spec.ts src/academic/programme-enrollment.service.spec.ts` — passed.
- `corepack pnpm@12.21.0 --filter @school/api exec prettier --check --print-width 100 src/admissions/admission.service.ts src/admissions/admissions.repository.ts src/admissions/admissions.service.spec.ts src/admissions/admissions.repository.spec.ts src/admissions/admissions.module.ts` — passed.
- `corepack pnpm@12.21.0 exec prettier --config .prettierrc.json --check docs/ACADEMIC_MODEL.md docs/DATABASE_SCHEMA.md docs/DEVELOPMENT_LOG.md docs/phases/phase-2/step-2.3-students-lecturers-enrollment.md docs/phases/phase-2/step-2.11-sis-services.md docs/phases/phase-2/step-2.11-sis-services-tests.md` — passed.
- `git diff --check` — passed.

## Data/Permissions Impact

No schema or permission changes. The test suite verifies reuse of existing
RBAC permissions and transactionally audited history.

## Copilot Usage

Tests were added in a distinct step after the service implementation and
documented against the canonical RBAC, database, and API test instructions.

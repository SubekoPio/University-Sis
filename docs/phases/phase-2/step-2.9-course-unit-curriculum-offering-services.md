<!-- Purpose: Record Phase 2.9 course-unit, curriculum, and offering services. -->

# Phase 2 / Step 2.9: Course-Unit, Curriculum, and Offering Services

## Goal

Provide course-unit catalogue CRUD, curriculum configuration, prerequisite
validation, and shared offering management without adding HTTP controllers or
authorization guards.

## What Was Built

- Added `CourseUnitsService` and its Prisma repository for catalogue CRUD,
  general-unit faculty eligibility, and retirement of referenced units.
- Added `CurriculumService` and its Prisma repository for programme slot
  placements, elective-credit rules, and prerequisite sets.
- Added `OfferingsService` and its Prisma repository for unique shared offerings,
  curriculum-based bulk creation, capacity updates, lecturer assignments, and
  copying an earlier intake's offering setup.
- Registered the repositories and services in `AcademicModule`; no controllers
  or guards were added.

## Key Decisions

- Repository methods own Prisma access; services validate identifiers, active
  parents, enum values, and business rules.
- Setting curriculum placements replaces only the specified programme,
  study-year, and intake slot in one transaction. The schema's global
  `(programmeId, courseUnitId)` uniqueness still prevents duplicate placement
  elsewhere in the programme.
- Prerequisite validation checks the full proposed directed graph before
  replacing the stored prerequisite set.
- Offerings copied from the chronologically previous intake retain capacity,
  delivery mode, and lecturer roles, but start in `PLANNED`.

## Business Rules

- General units must either be open to all faculties or list active eligible
  faculties. Curriculum placement checks general-unit eligibility against the
  programme's faculty.
- Curriculum placements require active course units, a valid programme
  study-year, intake slot 1–3, and a `CORE` or `ELECTIVE` classification.
- Elective rules allow multiple rows per programme slot; each row requires
  whole-number credit bounds with a non-negative minimum no greater than the
  maximum.
- A course unit cannot be its own prerequisite, and the full prerequisite graph
  must remain acyclic.
- An intake has at most one offering per course unit. Bulk creation deduplicates
  curriculum units shared by multiple programmes and rejects already-existing
  offerings.
- Lecturer assignments require active lecturer profiles; replacement preserves
  the current `PRIMARY` or `ASSISTANT` role. The service permits at most one
  `PRIMARY` assignment at a time.

## How to Run & Test

- `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
- `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
- `corepack pnpm@12.21.0 exec prettier --check apps/api/src/academic/academic-catalog.types.ts apps/api/src/academic/course-units.repository.ts apps/api/src/academic/course-units.service.ts apps/api/src/academic/curriculum.repository.ts apps/api/src/academic/curriculum.service.ts apps/api/src/academic/offerings.repository.ts apps/api/src/academic/offerings.service.ts apps/api/src/academic/academic.module.ts docs/ACADEMIC_MODEL.md docs/DATABASE_SCHEMA.md docs/phases/phase-2/step-2.9-course-unit-curriculum-offering-services.md` — passed.
- `git diff --check` — passed.
- Tests are deferred to a separate test step, per project instructions.
- No migration was generated or applied, and no database was modified.

## Data/Permissions Impact

No Prisma schema, migration, seed, RBAC, or API endpoint changes. The new
services use the existing course-unit, curriculum, prerequisite, offering, and
lecturer-assignment models.

## Known Limitations

- Prerequisite-cycle validation and the one-primary assignment rule are
  service-level; lecturer assignment changes are serialized on the offering
  row, but direct database writes can bypass them because the schema has no
  unique constraint for primary lecturer assignments.
- Student course-unit selection, capacity enforcement at selection time, and
  all HTTP endpoints remain for later steps.

## Copilot Usage

The Phase 2.9 prompt, academic model, database schema contract, RBAC matrix,
academic-structure services, and existing repository conventions were reviewed.
Generated service and repository changes were checked with the API type-check
and linter; no tests were added in this implementation step.

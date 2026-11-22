<!-- Purpose: Record the Phase 2.2 course-unit, curriculum, and offering schema. -->

# Phase 2 / Step 2.2: Course Units, Curriculum, and Offerings

## Goal

Persist department-owned course units, programme curriculum placement,
eligibility, prerequisites, elective rules, and shared course-unit offerings.

## What Was Built

- Added the six Phase 2.2 Prisma models and their relations.
- Added level, course-unit status, curriculum type, and offering status enums.
- Added unique and composite keys, lookup indexes, timestamps, and restrictive
  deletion for curriculum and offering history.
- Added database checks limiting curriculum and elective-rule intake slots to
  1-3.
- Added a versioned migration and updated the academic and database schema docs.

## Key Decisions

- Level values are `LEVEL_100`, `LEVEL_200`, `LEVEL_300`, and `LEVEL_400`.
- Course-unit statuses are `ACTIVE`, `INACTIVE`, and `RETIRED`; offering
  statuses are `PLANNED`, `OPEN`, `CLOSED`, and `CANCELLED`.
- Multiple elective rules may exist for one programme, study year, and intake
  slot; the combination is indexed but not unique.
- One offering is uniquely identified by course unit and intake, so offerings
  are shared across eligible programmes.
- Faculty eligibility and prerequisite link records use composite primary
  keys to prevent duplicates.

## Business Rules

- Curriculum placements use `CORE` or `ELECTIVE` and an intake slot from 1-3.
- General-course-unit eligibility is represented by faculty allowlist records
  or `openToAllFaculties`.
- A course unit may have prerequisite course units; cycle detection remains a
  service-level rule for a later step.
- Offerings may have no capacity limit; a non-null capacity is stored as an
  integer.

## How to Run & Test

- `corepack pnpm@12.21.0 exec prisma format` — passed.
- `corepack pnpm@12.21.0 exec prisma validate` — passed.
- `corepack pnpm@12.21.0 exec prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` — passed; reviewed generated table, index, and foreign-key SQL. The intake-slot checks are included in the migration SQL because Prisma schema syntax does not represent numeric check constraints.
- `corepack pnpm@12.21.0 exec prettier --config .prettierrc.json --check docs/ACADEMIC_MODEL.md docs/DATABASE_SCHEMA.md docs/DEVELOPMENT_LOG.md docs/phases/phase-2/step-2.2-course-units-curriculum-offerings.md` — passed.
- `corepack pnpm@12.21.0 exec prisma migrate deploy` — not run; applies pending migrations to the configured database.
- No tests were run; tests belong in the separate Phase 2 test step.

## Data/Permissions Impact

Adds course-unit, curriculum, prerequisite, eligibility, and offering tables,
enums, indexes, foreign keys, and intake-slot checks. No permissions, seed
data, APIs, or authentication models were changed.

## Known Limitations

Prerequisite cycles, credit-bound relationships, and programme study-year
eligibility require service-level validation. The database allows multiple
elective rules for the same curriculum slot as confirmed.

## Copilot Usage

The Phase 2.2 prompt, academic model, database schema, RBAC matrix, and Prisma
instructions were reviewed. Enum values and elective-rule multiplicity were
confirmed before implementation.

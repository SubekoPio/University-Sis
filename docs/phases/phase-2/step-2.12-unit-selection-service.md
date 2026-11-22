<!-- Purpose: Record the Phase 2.12 course-unit selection service implementation. -->

# Phase 2 / Step 2.12: Course-Unit Selection Service

## Goal

Provide course-unit prompts, validated student selection and drops, and an
audited registrar override without adding HTTP controllers or changing the
Prisma schema.

## What Was Built

- Added `UnitSelectionService` and its Prisma repository, registered and
  exported by the academic module.
- Added prompted core and elective offerings, faculty-eligible general units,
  primary lecturer details, remaining capacity, and meeting sessions without
  meeting URLs.
- Added atomic unit selection with typed reasons for eligibility, prerequisite,
  capacity, timetable, core, elective-credit, duplicate, and window failures.
- Added transactional drops that preserve the registration row and prevent
  dropping compulsory core units or violating elective-credit bounds.
- Added a registrar override using `academic:enrollment:manage`; it bypasses
  only the selection window, requires a reason, and writes its audit record in
  the same transaction as the selection.

## Key Decisions

- Student selection requires `academic:unit:select` and is limited to the
  student's own profile. Prompt reads also allow the registrar's existing
  `academic:enrollment:manage` permission.
- The intake's `selectionClosesAt` is the drop deadline. A closed intake cannot
  be overridden.
- Earlier `COMPLETED` registrations are the available prerequisite-pass
  evidence. The current data model cannot distinguish failed or missed units,
  so retake prompts remain empty until assessment outcomes are modeled.
- Multiple elective-credit rows are alternative allowed ranges; any one range
  may be satisfied. The current schema has no overall credit-load limit, so no
  additional limit is inferred.
- Registration changes use serializable transactions and lock the active
  programme enrollment and affected offerings to coordinate load and capacity
  checks. Dropped registrations are retained and may be reselected.
- Sessions expose dates, delivery mode, and room only; meeting URLs remain
  private to the Attend workflow.
- No schema, seed, permission, controller, or route changes were made.

## How to Run & Test

- `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
- `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
- `corepack pnpm@12.21.0 --filter @school/api build` — passed.
- `corepack pnpm@12.21.0 --filter @school/api exec prettier --check --single-quote=false --print-width 100 src/academic/academic.module.ts src/academic/unit-selection.types.ts src/academic/unit-selection.service.ts src/academic/unit-selections.repository.ts` — passed.
- `corepack pnpm@12.21.0 exec prettier --config .prettierrc.json --check docs/ACADEMIC_MODEL.md docs/DATABASE_SCHEMA.md docs/DEVELOPMENT_LOG.md docs/phases/phase-2/step-2.12-unit-selection-service.md` — passed.
- `git diff --check` — passed.
- Focused behavioral tests are documented in the separate Phase 2.12 test
  step.

## Data/Permissions Impact

No Prisma schema or permission changes. The service reuses
`academic:unit:select` for student-owned selection and
`academic:enrollment:manage` for registrar overrides.

## Known Limitations

Retake discovery awaits assessment result data that can distinguish failed or
missed units. An overall credit-load limit awaits an authoritative setting.
Direct Prisma writes can bypass service-level capacity and selection rules.

## Copilot Usage

The canonical RBAC matrix, database schema, Phase 2.12 prompt, academic model,
backend instructions, and existing repository patterns were reviewed before
implementation.

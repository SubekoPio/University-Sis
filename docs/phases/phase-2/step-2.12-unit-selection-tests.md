<!-- Purpose: Record the separately scoped Phase 2.12 course-unit selection tests. -->

# Phase 2 / Step 2.12: Course-Unit Selection Tests

## Goal

Verify prompted-unit contents, eligibility and selection validation, own-record
scope, override boundaries, and atomic registration/audit writes separately
from the implementation step.

## What Was Tested

- Core preselection, elective ranges, faculty-general prompts, lecturer details,
  available seats, and meeting-URL omission.
- Required core inclusion, prerequisite evidence, capacity, timetable clashes,
  general-unit faculty eligibility, duplicate inputs, and alternative
  elective-credit ranges.
- Own-student access, compulsory-core drop protection, drop deadline, and
  registrar window override with written reason; override capacity checks remain
  enforced.
- Serializable selection transaction, override audit persistence, and dropped
  registration history preservation.

## How to Run & Test

- `corepack pnpm@12.21.0 --filter @school/api exec vitest run src/academic/unit-selection.service.spec.ts src/academic/unit-selections.repository.spec.ts` — passed; 2 files and 15 tests.
- `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
- `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
- `corepack pnpm@12.21.0 --filter @school/api build` — passed.
- `corepack pnpm@12.21.0 --filter @school/api exec prettier --check --single-quote=false --print-width 100 src/academic/academic.module.ts src/academic/unit-selection.types.ts src/academic/unit-selection.service.ts src/academic/unit-selection.service.spec.ts src/academic/unit-selections.repository.ts src/academic/unit-selections.repository.spec.ts` — passed.
- `corepack pnpm@12.21.0 exec prettier --config .prettierrc.json --check docs/ACADEMIC_MODEL.md docs/DATABASE_SCHEMA.md docs/DEVELOPMENT_LOG.md docs/phases/phase-2/step-2.12-unit-selection-service.md docs/phases/phase-2/step-2.12-unit-selection-tests.md` — passed.
- `git diff --check` — passed.

## Data/Permissions Impact

No schema or permission changes. The tests verify `academic:unit:select` own
scope and the registrar's existing `academic:enrollment:manage` permission.

## Copilot Usage

Tests were added in a distinct step after the service implementation and
documented against the canonical RBAC, database, and API test instructions.

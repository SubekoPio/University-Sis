# Phase 2 / Step 2.17: Service Tests

## Goal

Add focused Vitest coverage for the Phase 2 admissions, academic structure,
selection, attendance, communications, and home services.

## What Was Built

- Extended admissions coverage for missing documents, missing confirmed fees,
  transactional admission records, credential email failure, and user/student
  creation.
- Added exact three-intake and duplicate offering coverage.
- Added prompted-unit coverage for faculty-general and Computer Science-only
  units, closed windows, prerequisites, capacity, clashes, and elective credits.
- Added Attend coverage for physical students, outside-window clicks, private
  links, and click logging.
- Added continuous-presence coverage for uninterrupted stays, additive short
  visits, reconnect grace, shared offering class lists, and lecturer ownership.
- Added announcement audience matching and student, lecturer, and registrar home
  aggregation coverage.

## Key Decisions

- Kept tests at existing service boundaries and reused repository/RBAC mocks.
- Used transaction and callback mocks to verify validation occurs before writes.
- Did not alter production code.

## Business Rules

- Admission remains blocked when required documents or fee confirmation are
  missing.
- Academic years contain exactly three ordered, non-overlapping intakes.
- Each course unit has at most one offering per intake.
- Selection and attendance rules remain owned by their existing services.
- Meeting links are tested as private Attend results, not list/home fields.

## How to Run & Test

- `pnpm typecheck` in `apps/api`
- `pnpm test` in `apps/api`

Results:

- TypeScript type-check passed.
- 31 test files passed.
- 165 tests passed.

## Data/Permissions Impact

No Prisma schema, seed, migration, permission, or production source changes.

## Known Limitations

Controller HTTP tests remain a separate controller concern; this step focuses
on Phase 2 service behavior.

## Copilot Usage

Copilot reviewed existing service specs, added focused missing cases, ran
type-check and the complete API Vitest suite, and made no production edits.

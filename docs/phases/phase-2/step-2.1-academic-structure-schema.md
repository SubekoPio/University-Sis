<!-- Purpose: Record the Phase 2 academic-structure Prisma schema and migration. -->

# Phase 2 / Step 2.1: Academic Structure Schema

## Goal

Persist the foundational academic hierarchy and configurable intakes in Prisma
without generating APIs or changing authentication models.

## What Was Built

- Added `Faculty`, `Department`, `Programme`, `AcademicYear`, and `Intake` to
  `prisma/schema.prisma`.
- Added the confirmed `AwardLevel` and `IntakeStatus` enums.
- Added unique codes and labels, relation indexes, timestamps, restrictive
  parent deletion, and the unique year/sequence constraint.
- Added a SQL check constraint that limits each intake sequence to 1-3.
- Added the corresponding versioned migration and updated
  `docs/DATABASE_SCHEMA.md`.

## Key Decisions

- Intake names and dates are configurable data, not enum values.
- Parent deletion is restricted when academic children exist so historical
  academic structure cannot be removed by cascade.
- The intake sequence range is enforced by SQL because Prisma schema syntax
  does not express a numeric check constraint.

## Business Rules

- Academic-year policy defines three intakes. The database limits sequence
  values to 1, 2, or 3 and prevents duplicates, but does not require all three
  rows to exist.
- Faculty contains departments, departments contain programmes, and intakes
  belong to academic years.
- Programme award levels are `CERTIFICATE`, `DIPLOMA`, `BACHELOR`,
  `POSTGRADUATE_DIPLOMA`, `MASTERS`, and `DOCTORATE`.

## How to Run & Test

- `corepack pnpm@12.21.0 exec prisma format` — passed.
- `corepack pnpm@12.21.0 exec prisma validate` — passed.
- `corepack pnpm@12.21.0 exec prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` — passed; reviewed generated table and relation SQL. The custom intake sequence check is added in the versioned migration because it is not represented in Prisma schema syntax.
- `corepack pnpm@12.21.0 exec prettier --config .prettierrc.json --check docs/DATABASE_SCHEMA.md docs/DEVELOPMENT_LOG.md docs/phases/phase-2/step-2.1-academic-structure-schema.md` — passed after formatting.
- `corepack pnpm@12.21.0 exec prisma migrate deploy` — applies versioned
  migrations to the configured database; not run in this step.

## Data/Permissions Impact

Adds academic-structure tables, enum types, indexes, foreign keys, and an
intake sequence check. No authentication models, permissions, seeds, or APIs
were changed.

## Known Limitations

Course units, curricula, offerings, students, enrollment, and admissions
workflow models remain future Phase 2 work. Migration application must be
performed and verified separately in each target database.

## Copilot Usage

The Prisma instructions, Phase 2.1 prompt, existing schema/migrations, and
database schema documentation were reviewed. Award-level enum values were
confirmed before implementation.

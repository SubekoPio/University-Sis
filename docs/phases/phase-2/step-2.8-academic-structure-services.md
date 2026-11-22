<!-- Purpose: Record Phase 2.8 academic-structure services and repository behavior. -->

# Phase 2 / Step 2.8: Academic Structure Services

## Goal

Provide service and repository operations for faculties, departments,
programmes, academic years, and intakes without adding HTTP controllers or
authorization guards.

## What Was Built

- Added five services and five Prisma repositories under `apps/api/src/academic`.
- Added an `AcademicModule` that registers and exports those services; no
  controllers or guards were added.
- Added soft-delete timestamps and indexes to the five academic-structure
  models, with a versioned migration.
- Registered the academic module in the API root module.

## Key Decisions

- `createAcademicYear` validates all three intake definitions before persisting
  the year and intakes in one Prisma transaction; all start `UPCOMING`.
- Intake overlap, selection-window, and date-boundary rules are validated by
  services. Intake status changes use a compare-and-set repository operation.
- Unreferenced structure records may be hard-deleted. Referenced records are
  soft-deleted; active queries exclude soft-deleted records.
- Codes are normalized to uppercase. Deleted unique codes and labels remain
  reserved to preserve identity and history.

## Business Rules

- Every academic year created through the service has intake sequences 1, 2,
  and 3, with dates contained within the year and non-overlapping ranges.
- Selection opens before it closes, and the selection close time is strictly
  before the intake end date.
- Intake transitions must advance exactly one step:
  `UPCOMING` → `SELECTION_OPEN` → `ACTIVE` → `CLOSED`.
- Child creation or reassignment requires an active parent record.

## How to Run & Test

- `corepack pnpm@12.21.0 exec prisma format --schema prisma/schema.prisma` — passed.
- `corepack pnpm@12.21.0 exec prisma generate --schema prisma/schema.prisma` — passed.
- `corepack pnpm@12.21.0 exec prisma validate --schema prisma/schema.prisma` — passed.
- `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
- `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
- `corepack pnpm@12.21.0 exec prettier --check apps/api/src/academic apps/api/src/app.module.ts docs/DEVELOPMENT_LOG.md docs/ACADEMIC_MODEL.md docs/phases/phase-2/step-2.8-academic-structure-services.md` — passed.
- `git diff --check` — passed.
- To apply the migration after confirming `DATABASE_URL` targets the intended
  database, run `corepack pnpm@12.21.0 exec prisma migrate status`, then
  `corepack pnpm@12.21.0 exec prisma migrate deploy`. Neither was run here.
- No migration was deployed and no database was modified.
- Tests are intentionally deferred to a separate test step, per project
  instructions.

## Data/Permissions Impact

Adds nullable `deletedAt` fields and filtering indexes for `Faculty`,
`Department`, `Programme`, `AcademicYear`, and `Intake`; adds no permission or
API endpoint. Apply the versioned migration before using these repositories.

## Known Limitations

The Prisma schema still does not enforce that every year has exactly three
intakes or prohibit overlapping intake ranges at the database level; service
operations enforce these rules. Direct database writes can bypass them.
Soft-deleted codes and labels cannot be reused because their unique values are
retained.

## Copilot Usage

The Phase 2.8 prompt, RBAC matrix, database schema contract, Prisma models, and
existing NestJS service/repository patterns were reviewed. The soft-delete
fields and migration were added after confirming the existing models had no
archive marker.

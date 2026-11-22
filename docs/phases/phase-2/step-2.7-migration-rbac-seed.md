<!-- Purpose: Record the Phase 2.7 migration commands, RBAC seed, and sample data. -->

# Phase 2 / Step 2.7: Migration, RBAC, and Development Seed

## Goal

Document migration commands, provision Phase 2 roles and permissions exactly
as defined by `docs/RBAC_MATRIX.md`, and add idempotent development-only sample
data without removing the existing seed sections.

## What Was Built

- Added the `admissions_officer` and `admissions_head` roles while preserving
  existing roles.
- Added the requested admissions, academic, attendance, and communications
  permission grants. The Phase 1 `admin:user:manage` grant remains.
- Removed legacy admissions, academic, finance, LMS, examination, and report
  grants from `admin` whenever the seed runs.
- Added one academic year, three intakes, four faculties and programmes, five
  lecturers, 20 students, application examples, offerings, sessions, attendance
  defaults, announcements, and calendar events.
- Chose full curriculum coverage: 87 course units and 96 placements provide
  core and elective units in every study-year/intake slot for each programme.

## Key Decisions

- Existing permissions are upserted; legacy prohibited admin assignments are
  explicitly deleted so they cannot survive a seed rerun.
- Sample records use stable identifiers or existing natural unique keys for
  rerun safety. Sample accounts use random, hashed, undisclosed credentials.
- The sample-data stage returns without writing when `NODE_ENV=production`.
- Migration deployment applies all pending migrations; this step adds no schema
  migration of its own.

## Business Rules

- `admin` receives no admissions, academic, or finance permissions.
- Admissions decisions in sample records are attributed to an
  `admissions_head`, not `admin`.
- Online meeting links use the reserved `.invalid` domain and remain sample
  data only.
- Intake dates and class sessions are not duplicated as calendar events.

## How to Run & Test

Run from the repository root after confirming `DATABASE_URL` targets the
intended development database and `ADMIN_PASSWORD` is set. The production guard
skips only sample records; `db:seed` still upserts RBAC and the admin account.

```powershell
corepack pnpm@12.21.0 exec prisma validate --schema prisma/schema.prisma
corepack pnpm@12.21.0 exec prisma migrate status
corepack pnpm@12.21.0 exec prisma migrate deploy
corepack pnpm@12.21.0 db:seed
```

- Prisma client generation — passed.
- `corepack pnpm@12.21.0 exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --types node prisma/seed.ts` — passed.
- `corepack pnpm@12.21.0 exec eslint prisma/seed.ts` — passed.
- `corepack pnpm@12.21.0 exec prettier --check prisma/seed.ts docs/RBAC_MATRIX.md docs/DEVELOPMENT_LOG.md docs/phases/phase-2/step-2.7-migration-rbac-seed.md` — passed.
- `corepack pnpm@12.21.0 exec prisma validate --schema prisma/schema.prisma` — passed.
- `git diff --check` — passed.
- Migration deployment and database seeding were not run; tests belong in the
  separate Phase 2 test step.

## Data/Permissions Impact

Adds idempotent role and role-permission rows and non-production development
records. No schema migration or API was added in this step. No online payment
flag is enabled.

## Known Limitations

Only the seven existing/provisioned roles are seeded; the remaining matrix
roles and legacy permission aliases still need a later reconciliation. Sample
accounts do not have known login credentials.

## Copilot Usage

The Phase 2.7 prompt and current RBAC matrix were reviewed. The sample
curriculum was expanded to all programme slots after the user chose full
coverage over the approximately 14-course-unit option.

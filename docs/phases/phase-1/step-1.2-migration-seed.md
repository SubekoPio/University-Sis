# Phase 1 / Step 1.2: Migration and RBAC Seed

## Goal

Prepare the initial authentication/RBAC migration and an idempotent seed for
roles, matrix permissions, role grants, and one administrator.

## What Was Built

- Added the initial SQL migration under `prisma/migrations/`.
- Added `prisma/seed.ts`; it upserts the five matrix roles, all 61 permissions
  and their grants, and one administrator.
- Hashes `ADMIN_PASSWORD` with Argon2 and normalizes `ADMIN_EMAIL` (default
  `admin@university.local`). Existing administrator credentials are not
  overwritten on reruns.
- Added Prisma configuration, package scripts, runtime dependencies, and
  environment placeholders.

## Key Decisions

- The RBAC matrix is copied as the source for role-to-permission assignments.
- The seed upserts all seeded records; it does not change an existing admin
  password or status.
- The migration was generated from the Prisma schema without connecting to a
  database. It has not been applied.

## Business Rules

- A non-empty `ADMIN_PASSWORD` must be set outside source control before seeding.
- Role grants follow `docs/RBAC_MATRIX.md`; role and permission names are
  upserted by their unique keys.
- Seeding is wrapped in a transaction. The administrator receives the `admin`
  role.

## How to Run & Test

1. Copy `.env.example` to `.env`, set `POSTGRES_PASSWORD`, update
   `DATABASE_URL` to use that password and the intended database, and set
   `ADMIN_PASSWORD`. Optionally set `ADMIN_EMAIL`.
2. Ensure the target database is the intended development database and has
   been backed up if it contains data.
3. Apply the migration with `corepack pnpm db:migrate --name auth_rbac_init`.
4. Seed roles, permissions, and the admin with `corepack pnpm db:seed`.

- `corepack pnpm exec prisma validate --schema prisma\schema.prisma` — passed.
- `corepack pnpm exec prisma migrate diff --from-empty --to-schema-datamodel prisma\schema.prisma --script --output prisma\migrations\20261115171500_auth_rbac_init\migration.sql` — passed; generated without connecting to a database.
- Seed permission comparison against `docs/RBAC_MATRIX.md` — passed (61 permissions; no missing, extra, or mismatched grants).
- `corepack pnpm exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --types node prisma\seed.ts prisma.config.ts` — passed.
- `corepack pnpm db:seed` with `ADMIN_PASSWORD` unset — exited before connecting, as expected.
- Migration application and seed execution — not run: no `.env` or `DATABASE_URL` / `ADMIN_PASSWORD` is configured, and the responding local database target is unknown.

## Data/Permissions Impact

The migration and seed are prepared but have not changed any database. The seed
adds no permission beyond those listed in the RBAC matrix. No APIs or services
were added.

## Known Limitations

- Migration application and seed execution require confirmation of the target
  database and local environment variables.
- The seed does not reset an existing administrator password; change it through
  the authentication flow once available.

## Copilot Usage

Copilot derived the permission-to-role assignments from `docs/RBAC_MATRIX.md`,
then reviewed all 61 seeded permission mappings against that matrix.

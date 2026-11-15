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

### Files created or changed

- `prisma/migrations/20261115171500_auth_rbac_init/migration.sql`
- `prisma/seed.ts`, `prisma.config.ts`
- `package.json`, `pnpm-lock.yaml`, `.env.example`

## Key Decisions

- The RBAC matrix is copied as the source for role-to-permission assignments.
- The seed upserts all seeded records; it does not change an existing admin
  password or status.
- The seed is idempotent and wrapped in a transaction. The administrator
  password is hashed with Argon2; `ADMIN_PASSWORD` is mandatory.
- The initial migration and seed were applied successfully to the local
  development database. The later email-verification migration is separate.

## Business Rules

- A non-empty `ADMIN_PASSWORD` must be set outside source control before seeding.
- Role grants follow `docs/RBAC_MATRIX.md`; role and permission names are
  upserted by their unique keys.
- The administrator receives the `admin` role. On seed reruns an existing
  administrator's password and status are not overwritten.

## How to Run & Test

1. Copy `.env.example` to `.env`; configure `POSTGRES_PASSWORD`,
   `DATABASE_URL`, and a non-empty `ADMIN_PASSWORD`. Optionally configure
   `ADMIN_EMAIL`.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Apply pending migrations with `corepack pnpm@12.21.0 db:migrate`.
4. Seed roles, permissions, and the administrator with
   `corepack pnpm@12.21.0 db:seed`.

- `corepack pnpm@12.21.0 exec prisma validate --schema prisma\schema.prisma` — passed.
- `corepack pnpm@12.21.0 exec prisma migrate diff --from-empty --to-schema-datamodel prisma\schema.prisma --script --output prisma\migrations\20261115171500_auth_rbac_init\migration.sql` — passed; generated without connecting to a database.
- Seed permission comparison against `docs/RBAC_MATRIX.md` — passed (61 permissions; no missing, extra, or mismatched grants).
- `corepack pnpm@12.21.0 db:migrate` — applied the initial auth/RBAC migration to the local development database.
- `corepack pnpm@12.21.0 db:seed` — completed successfully for the local development database.
- `corepack pnpm@12.21.0 exec tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --types node prisma\seed.ts prisma.config.ts` — passed.

## Data/Permissions Impact

The initial migration was applied to the local development database. The seed
adds the five roles, 61 matrix permissions, role grants, and one administrator.
No APIs or services were added in this step.

## Known Limitations

- The email-verification column is added by the later Step 1.6 migration; it
  must be applied before using that updated API against an older database.
- The seed does not reset an existing administrator password; change it through
  the authentication flow once available.

## Copilot Usage

Copilot derived the permission-to-role assignments from `docs/RBAC_MATRIX.md`,
then reviewed all 61 seeded permission mappings against that matrix.

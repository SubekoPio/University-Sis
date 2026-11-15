# Phase 1 / Step 1.1: Prisma Authentication and RBAC Schema

## Goal

Define authentication and RBAC data models, relations, indexes, and lifecycle
fields without generating application APIs or running a migration.

## What Was Built

- Added `prisma/schema.prisma` with `User`, `Role`, `Permission`, `UserRole`,
  `RolePermission`, `Session`, `PasswordResetToken`, and
  `EmailVerificationToken`.
- Added `UserStatus`, UUID identifiers, unique keys, lookup indexes, explicit
  foreign-key deletion behavior, and timestamps on every model.
- Updated `docs/DATABASE_SCHEMA.md` to distinguish implemented Prisma models
  from planned models.

## Key Decisions

- Used UUID primary keys and `prisma/schema.prisma` as the canonical schema.
- Used composite primary keys for the RBAC join models.
- Cascaded deletion of a user to that user's auth records and role assignments;
  role and permission deletion removes only related join records.
- Added `ACTIVE`, `SUSPENDED`, and `DISABLED` as `UserStatus` values. Review
  these values before the first migration.

## Business Rules

- Persist only password and token hashes, never their plaintext values.
- Normalize login email before persistence; enforce uniqueness on `email`.
- Each role/permission assignment and token hash is unique.
- Account removal clears sessions, recovery tokens, verification tokens, and
  role assignments. This does not define deletion behavior for future academic,
  financial, or audit records.

## How to Run & Test

- Schema validation: `$env:DATABASE_URL = 'postgresql://school:school@localhost:5432/school?schema=public'; corepack pnpm dlx prisma@6.19.0 validate --schema prisma\schema.prisma` — passed.
- Documentation formatting: `corepack pnpm exec prettier --config .prettierrc.json --check docs\DATABASE_SCHEMA.md docs\DEVELOPMENT_LOG.md docs\phases\phase-1\step-1.1-prisma-schema.md` — passed.
- No migration, API, service, or seed data was generated.

## Data/Permissions Impact

Added Prisma model definitions only; no database migration or deployed data was
changed. Existing RBAC permission definitions were not changed. The `UserStatus`
values require review before migration.

## Known Limitations

- The schema has not been migrated or tested against a live database.
- Prisma validation used a temporary Prisma CLI; Prisma is not a project dependency.
- Authentication field lengths, email normalization enforcement, token
  retention, and final account status values need review before migration.

## Copilot Usage

Copilot added the requested schema and documentation from the repository's
database schema, RBAC matrix, roadmap, and Prisma instructions. The schema and
deletion policies require review before migration.

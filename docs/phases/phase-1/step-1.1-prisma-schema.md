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

### Files created or changed

- `prisma/schema.prisma`
- `docs/DATABASE_SCHEMA.md`

## Key Decisions

- Used UUID primary keys and `prisma/schema.prisma` as the canonical schema.
- Used composite primary keys for the RBAC join models.
- Cascaded deletion of a user to that user's auth records and role assignments;
  role and permission deletion removes only related join records.
- Added `ACTIVE`, `SUSPENDED`, and `DISABLED` as `UserStatus` values; these
  values were included in the initial migration.
- The later account-recovery step added `User.emailVerified`, defaulting to
  `false`, through a separate migration.

## Business Rules

- Persist only password and token hashes, never their plaintext values.
- Normalize login email before persistence; enforce uniqueness on `email`.
- Each role/permission assignment and token hash is unique.
- Account removal clears sessions, recovery tokens, verification tokens, and
  role assignments. This does not define deletion behavior for future academic,
  financial, or audit records.

## How to Run & Test

- `$env:DATABASE_URL = 'postgresql://school:school@127.0.0.1:5432/school?schema=public'; corepack pnpm@12.21.0 exec prisma validate --schema prisma\schema.prisma` — passed; validation does not connect to PostgreSQL.
- No migration, API, service, or seed data was generated.

## Data/Permissions Impact

Added Prisma model definitions only in this step; no migration or deployed data
was changed by this step. The initial migration in Step 1.2 created these
authentication and RBAC tables. `emailVerified` is a later schema/migration
addition in Step 1.6. No permission grants were changed here.

## Known Limitations

- The follow-up email-verification migration's status is environment-specific;
  verify it against the target database before running the updated API.
- Email normalization is applied in application services and the seed; the
  unique column alone does not enforce lowercase normalization for arbitrary
  direct database writes.
- Token cleanup/retention jobs are not implemented.

## Copilot Usage

Copilot added the requested schema and documentation from the repository's
database schema, RBAC matrix, roadmap, and Prisma instructions. The schema and
deletion policies were reviewed against the initial migration; future
domain-model relations still require design review.

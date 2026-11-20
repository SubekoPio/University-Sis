<!-- Purpose: Record the User account lifecycle schema change and migration status. -->

# Phase 1 / Step 1.15: User Account Lifecycle Fields

## Goal

Extend only the existing `User` model to record administrator account
creation, temporary-password lifecycle, and account deactivation metadata.

## What Was Built

- Added `mustChangePassword` with a database default of `false`,
  `temporaryPasswordExpiresAt`, creator/deactivator references and timestamps
  to `User`.
- Added `DEACTIVATED` to `UserStatus`.
- Added nullable self-relations with `onDelete: SetNull` and indexes for
  temporary-password expiry and creator/deactivator reverse lookups.
- Added the additive migration
  `prisma/migrations/20261120193000_add_user_lifecycle_fields/migration.sql`.
- Updated the authentication section of `docs/DATABASE_SCHEMA.md`.

## Key Decisions

- The database default `false` preserves `mustChangePassword = false` for
  existing rows.
- `createdById` and `deactivatedById` reference `User` with `SetNull`, so
  deleting an actor does not cascade-delete the affected account.
- The migration was generated from a Prisma schema diff and has not been
  applied to a database.

## Business Rules

- Student accounts are created by administrators following admission; students
  do not sign themselves up.
- `mustChangePassword` and `temporaryPasswordExpiresAt` store account
  lifecycle state; authentication enforcement is outside this schema-only
  step.
- Deactivation metadata is nullable for existing and bootstrap accounts.

## How to Run & Test

- `corepack pnpm@12.21.0 exec prisma format --schema prisma/schema.prisma` — passed.
- `corepack pnpm@12.21.0 exec prisma validate --schema prisma/schema.prisma` — passed.
- Prisma schema diff from the committed baseline to the updated schema — passed;
  SQL changes only the `UserStatus` enum and `User` table.
- `corepack pnpm@12.21.0 exec prisma migrate dev --schema prisma/schema.prisma --name add_user_lifecycle_fields --create-only` — could not connect to `localhost:5433` (P1001); the migration was generated offline instead and was not applied.
- Apply the reviewed pending migration when PostgreSQL is available:
  `corepack pnpm@12.21.0 exec prisma migrate dev --schema prisma/schema.prisma`.
- No service/API tests were added; behavior tests are a separate step.

## Data/Permissions Impact

The migration adds nullable lifecycle metadata, indexes, two nullable
self-referential foreign keys, and the `DEACTIVATED` enum value. The
`mustChangePassword` column is `NOT NULL DEFAULT false`; existing users retain
the default. No other Prisma model, role, permission, service, or API changed.

## Known Limitations

- The migration is not applied because the configured local PostgreSQL server
  was unreachable.
- These fields do not themselves disable public registration or enforce
  temporary-password expiration/deactivation; those behaviors require
  follow-up service and API work, intentionally excluded here.

## Copilot Usage

Copilot updated the schema and schema documentation, generated the SQL diff
from the committed Prisma baseline, and validated the result. No service or
API code was generated.

<!-- Purpose: Record the User lifecycle schema needed for administrator-provisioned accounts. -->

# Phase 1 / Step 1.10: User Account Lifecycle Fields

## Goal

Extend only the existing `User` model to represent temporary-password and
deactivation state, while preserving existing account defaults.

## What Was Built

- Added `mustChangePassword` (default `false`), nullable
  `temporaryPasswordExpiresAt`, `createdById`, `deactivatedAt`, and
  `deactivatedById` to `User`.
- Added `DEACTIVATED` to `UserStatus`, self-relations for account creators and
  deactivators, and lookup indexes.
- Added the migration
  `prisma/migrations/20261120193000_add_user_lifecycle_fields/migration.sql`.

## Key Decisions

- Existing accounts keep `mustChangePassword = false` through the database
  default.
- Creator and deactivator references are nullable and use `onDelete: SetNull`;
  deleting an actor does not delete the managed account.
- The migration is checked in; whether it has been applied depends on the
  target database.

## Business Rules

- Administrators create accounts; students do not sign themselves up.
- This schema step stores lifecycle state only. Enforcement is documented in
  the later authentication step.
- Existing records may have no creator or deactivation metadata.

## How to Run & Test

- `corepack pnpm@12.21.0 exec prisma format --schema prisma/schema.prisma` — passed.
- `corepack pnpm@12.21.0 exec prisma validate --schema prisma/schema.prisma` — passed.
- Prisma schema diff review — passed; the migration changes only `UserStatus`
  and `User`.
- `prisma migrate dev --create-only` — could not connect to PostgreSQL (P1001);
  the migration was generated offline and was not applied in that environment.

## Data/Permissions Impact

Adds the listed `User` columns, indexes, two nullable self-referential foreign
keys, and a `UserStatus` enum value. It changes no other model, role, or
permission.

## Known Limitations

The migration's applied state must be checked separately for each database.
These fields alone do not disable registration or enforce password expiry.

## Copilot Usage

Copilot inspected the existing Prisma model and produced an additive migration.
Schema formatting, validation, and migration contents were reviewed; no service
or API code was added in this step.

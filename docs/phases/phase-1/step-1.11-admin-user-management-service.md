<!-- Purpose: Record administrator account provisioning and lifecycle service behavior. -->

# Phase 1 / Step 1.11: Administrator User-Management Service

## Goal

Provide a service and Prisma repository for admin-managed accounts, temporary
credentials, role changes, account lifecycle, and paginated user lookup.

## What Was Built

- Added `AdminUsersService` and `AdminUsersRepository` in `apps/api/src/users`.
- Added secure temporary-password generation, Argon2 hashing, credential
  delivery/resend, role updates, deactivation/reactivation, and user listing.
- Added nullable `User.name`, its search index, and the append-only `AuditLog`
  model in `20261120210000_admin_user_management`.
- Added the idempotent `admin:user:manage` permission seed and an escaped
  temporary-credentials email template.

## Key Decisions

- The service checks `admin:user:manage`, not a role name.
- Admin-capability grants and removals are rejected until second-admin approval
  exists; initial account roles cannot grant admin capability.
- Credential email failures are audited and do not roll back account creation.

## Business Rules

- Temporary credentials use cryptographic randomness, are hashed before
  persistence, and expire after `TEMP_PASSWORD_TTL_DAYS` (default 7).
- A user must change the temporary password; resend rotates it and revokes
  existing sessions.
- An administrator cannot deactivate themselves or remove their own
  admin-capability assignment. Deactivation and reactivation require reasons.
- Listing supports search, role, status, and bounded pagination. Responses do
  not include password material.

## How to Run & Test

- `corepack pnpm@12.21.0 exec prisma format --schema prisma/schema.prisma` — passed.
- `corepack pnpm@12.21.0 exec prisma validate --schema prisma/schema.prisma` — passed.
- `corepack pnpm@12.21.0 exec prisma generate --schema prisma/schema.prisma` — passed.
- From `apps/api`, `corepack pnpm@12.21.0 run typecheck`, `run lint`, and
  `run build` — passed.
- Service and repository behavior tests are recorded in Step 1.14.

## Data/Permissions Impact

Adds nullable `User.name`, its index, `AuditLog` and lookup indexes, and the
`admin:user:manage` permission grant to the admin seed. The migration is
versioned; database application status is environment-specific.

## Known Limitations

Second-admin approval is not implemented; changes that would grant or remove
admin capability are denied. Audit immutability is enforced by application
interfaces, not a database trigger.

## Copilot Usage

Copilot followed the existing repository, email, RBAC, and Prisma patterns,
then reviewed the service boundaries and generated migration. Controller
behavior and focused tests are recorded in later steps.

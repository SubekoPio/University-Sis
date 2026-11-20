<!-- Purpose: Record the administrator user-management service and persistence changes. -->

# Phase 1 / Step 1.16: Administrator User-Management Service

## Goal

Provide a permission-gated service for administrator-created user accounts,
temporary credentials, role assignment, account lifecycle changes, and paged
user lookup without adding HTTP controllers.

## What Was Built

- Added `AdminUsersService` and its Prisma repository under `apps/api/src/users`.
- Added secure temporary-password generation, Argon2id hashing, email delivery,
  resend support, user listing, role updates, deactivation, and reactivation.
- Added a reusable RBAC core module so user management can authorize by
  permission and invalidate role-change caches without an HTTP-module cycle.
- Added nullable `User.name`, an append-only `AuditLog` model, and the
  `20261120210000_admin_user_management` migration.
- Added `admin:user:manage` for the `admin` role in the RBAC matrix and seed.
- Added an escaped HTML template for temporary credentials.

## Key Decisions

- The service checks `admin:user:manage`; it does not authorize by role name.
- Admin-capability grants/removals are rejected until a separate second-admin
  approval workflow exists. This also applies to initial role assignment.
- Existing users retain a nullable name; accounts created through this service
  require a non-empty name.
- The existing login flow requires verified email. An administrator-provisioned
  account is marked verified only after the credential email is accepted;
  failed delivery leaves it unverified and can be retried.
- The service returns safe user data and a delivery status, never the temporary password.
  Audit metadata records role IDs and delivery outcomes, not credentials.

## Business Rules

- Temporary passwords use cryptographic randomness, are Argon2id-hashed, and
  expire after `TEMP_PASSWORD_TTL_DAYS` (default 7). The account requires a
  password change.
- A failed credential email does not roll back account creation or credential
  rotation. The failure is audited and `resendCredentials` remains available.
- Resending credentials and deactivation revoke active sessions.
- An administrator cannot deactivate themselves or remove their own
  admin-capability assignment. Deactivation and reactivation require a reason.
- User listing filters by search, role, and status; pagination defaults to 25
  rows and is capped at 100.

## How to Run & Test

- `corepack pnpm@12.21.0 exec prisma format --schema prisma/schema.prisma` — passed.
- `corepack pnpm@12.21.0 exec prisma validate --schema prisma/schema.prisma` — passed.
- `corepack pnpm@12.21.0 exec prisma generate --schema prisma/schema.prisma` — passed.
- `corepack pnpm@12.21.0 run typecheck` from `apps/api` — passed.
- `corepack pnpm@12.21.0 run lint` from `apps/api` — passed.
- `corepack pnpm@12.21.0 run build` from `apps/api` — passed.
- Behavior tests are intentionally documented and added in the separate
  Phase 1 / Step 1.17.

## Data/Permissions Impact

The migration adds nullable `User.name`, its search index, and `AuditLog` with a
nullable actor reference and lookup indexes. It does not alter existing
accounts. The RBAC seed idempotently grants `admin:user:manage` only to the
`admin` role. The new migration has not been applied; apply pending migrations
in order when PostgreSQL is available.

## Known Limitations

- There is no controller or `@Permissions`-decorated endpoint in this step.
- The existing login service does not yet enforce `mustChangePassword` or
  `temporaryPasswordExpiresAt`; this service persists the state but does not
  change login behavior.
- The existing public registration endpoint is outside this service-only step.
- Admin-capability changes remain unavailable until a second-approver workflow
  is implemented.
- Audit immutability is enforced by the application repository interface; no
  database trigger prevents direct SQL updates or deletes.

## Copilot Usage

Copilot inspected the existing Prisma, authentication, email, and RBAC
boundaries; implemented the service and migration; then ran schema validation,
API type-checking, lint, and build. No controller was generated.

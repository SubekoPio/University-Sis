<!-- Purpose: Document the administrator user-management HTTP API implementation. -->

# Phase 1 / Step 1.20: Administrator User-Management API

## Goal

Expose the existing `AdminUsersService` operations through validated,
permission-protected HTTP endpoints with usable OpenAPI documentation.

## What Was Built

- Added the six requested user-management routes in `AdminUsersController`.
- Added request DTOs for account creation, list filters, user IDs, role
  assignments, and lifecycle reasons.
- Applied the JWT and `admin:user:manage` permission guards at controller
  scope; throttled credential resends.
- Registered the controller in a separate HTTP module so the service-focused
  `UsersModule` remains independent of HTTP guard dependencies.
- Added Swagger decorators and exposed the generated API document at
  `/api/docs`.

## Key Decisions

- The controller passes validated inputs and the authenticated actor ID
  directly to `AdminUsersService`; it contains no account-management rules or
  database access.
- The new HTTP module imports the existing `UsersModule` and `RbacModule`
  rather than introducing a module cycle.
- The resend endpoint uses the existing five-requests-per-minute throttle
  convention.

## Business Rules

- Every route requires a JWT and the `admin:user:manage` permission.
- Role assignment safeguards, self-deactivation checks, required reasons,
  credential delivery, and audit behavior remain in the existing service.
- The API does not expose temporary passwords in its response.

## How to Run & Test

- From `apps/api`, `corepack pnpm@12.21.0 run typecheck` — passed.
- From `apps/api`, `corepack pnpm@12.21.0 run lint` — passed.
- From `apps/api`, `corepack pnpm@12.21.0 run build` — passed.
- Controller and route behavior tests are recorded in the separate Phase 1 /
  Step 1.21.

## Data/Permissions Impact

No schema, migration, seed, or permission changes. The endpoints use the
existing `admin:user:manage` permission. Added the Nest Swagger package and
OpenAPI setup.

## Known Limitations

Swagger response entries document status and behavior descriptions; response
payloads retain the existing service return types.

## Copilot Usage

Copilot inspected the admin service, RBAC guard, module, and request-validation
conventions; added the HTTP adapter and Swagger setup; then ran typecheck, lint,
and build.

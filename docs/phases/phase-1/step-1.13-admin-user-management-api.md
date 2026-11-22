<!-- Purpose: Record the validated, permission-protected administrator users API. -->

# Phase 1 / Step 1.13: Administrator User-Management API

## Goal

Expose administrator user-management operations through validated,
JWT- and permission-protected HTTP routes.

## What Was Built

- Added `AdminUsersController` and registered it through the admin HTTP module.
- Added `POST /admin/users`, `GET /admin/users`,
  `POST /admin/users/:id/resend-credentials`,
  `PATCH /admin/users/:id/roles`, and deactivate/reactivate routes.
- Added DTO validation, Swagger metadata, and a resend rate limit.
- Applied `JwtAuthGuard`, `PermissionsGuard`, and
  `@Permissions("admin:user:manage")` at controller scope.

## Key Decisions

- The controller delegates to `AdminUsersService` and contains no persistence
  or account-lifecycle business rules.
- The service and HTTP module remain separated to avoid coupling the service
  module to HTTP guard dependencies.
- Resend follows the existing five-requests-per-minute throttle convention.

## Business Rules

- Every route requires a valid JWT and `admin:user:manage`.
- The service enforces role-grant restrictions, required reasons, and
  self-deactivation safeguards.
- Temporary passwords are never returned in API responses.

## How to Run & Test

- From `apps/api`, `corepack pnpm@12.21.0 run typecheck`, `run lint`, and
  `run build` — passed.
- Controller and end-to-end coverage is recorded in Step 1.14.

## Data/Permissions Impact

No schema or new permission was added in this API step. Routes use the existing
`admin:user:manage` grant.

## Known Limitations

The controller exposes service operations, but no administrator user-management
screen is included in this step.

## Copilot Usage

Copilot inspected the service, guard, DTO, module, and Swagger conventions,
then added the HTTP adapter and validation metadata.

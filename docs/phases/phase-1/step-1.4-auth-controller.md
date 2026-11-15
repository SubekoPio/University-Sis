# Phase 1 / Step 1.4: Authentication Controller and DTOs

## Goal

Expose the existing authentication service through validated HTTP endpoints,
with throttling on login and registration and a consistent error response.

## What Was Built

- Added `AuthController` endpoints for login, register, refresh, and logout.
- Added class-validator DTOs for credentials and refresh-token request bodies.
- Enabled a global validation pipe that transforms DTOs, rejects unknown
  properties, and rejects invalid values.
- Added per-IP throttling of five requests per minute on login and registration.
- Added a global exception filter returning
  `{ statusCode, code, message, timestamp, path }` for errors.

### Files created or changed

- `apps/api/src/auth/auth.controller.ts`,
  `apps/api/src/auth/dto/login.dto.ts`,
  `apps/api/src/auth/dto/register.dto.ts`,
  `apps/api/src/auth/dto/refresh-token.dto.ts`,
  `apps/api/src/auth/auth.module.ts`
- `apps/api/src/main.ts`,
  `apps/api/src/app.module.ts`,
  `apps/api/src/common/http-exception.filter.ts`
- `apps/api/package.json`, `pnpm-lock.yaml`

## Key Decisions

- Login and refresh pass request IP and user-agent metadata to `AuthService`;
  controllers do no persistence or authentication business logic.
- Logout accepts the opaque refresh token in its JSON body and returns
  `{ success: true }` after the service call.
- Validation messages are joined into one string so error response fields keep
  stable types. Unexpected server errors are logged and return a generic
  message.

## Business Rules

- Login and registration requests are limited to five requests per minute per
  client IP.
- DTOs reject unknown fields, invalid email addresses, empty values, and
  oversized password/token values before invoking services.
- The controller delegates all account and session behavior to `AuthService`.

## How to Run & Test

- Ensure the repository-root `.env` has `JWT_ACCESS_SECRET` set before starting
  the API.
- Start the API with `corepack pnpm@12.21.0 --filter @school/api dev`.
- Validation commands:
  - `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
  - `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
  - `corepack pnpm@12.21.0 --filter @school/api build` — passed.
- Controller and DTO behavior tests are recorded in Phase 1 / Step 1.7.

## Data/Permissions Impact

No Prisma schema, migration, seed, or RBAC changes.

## Known Limitations

- Authentication, role, and permission guards remain outside this controller
  task. These endpoints are the public credential/session workflows.
- No OpenAPI documentation or global request-body size configuration was added.

## Copilot Usage

Copilot added the controller, DTOs, rate-limit configuration, global validation,
and error filter against the existing `AuthService` signatures. The service
implementation was left unchanged.

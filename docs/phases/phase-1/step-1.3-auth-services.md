# Phase 1 / Step 1.3: Authentication Services

## Goal

Implement injectable registration, login, refresh-token rotation and logout
services, using Argon2id for passwords and short-lived signed access tokens.
No HTTP controllers, guards, or frontend code are included.

## What Was Built

- Added `AuthModule` and `AuthService` under `apps/api/src/auth/`.
- Added Argon2id password hashing and HS256 access-token generation.
- Added opaque 256-bit refresh tokens; only SHA-256 digests are stored in the
  existing `Session` table.
- Added transactional session rotation. Reuse of a revoked refresh token
  revokes the user's remaining active sessions.
- Added `UsersService` and a Prisma repository, plus a shared Prisma service
  for repository access.
- Registered the auth module and global `ConfigModule`; added the required
  auth configuration keys to `.env.example`.

### Files created or changed

- `apps/api/src/auth/auth.config.ts`,
  `apps/api/src/auth/auth.module.ts`,
  `apps/api/src/auth/auth.repository.ts`,
  `apps/api/src/auth/auth.service.ts`,
  `apps/api/src/auth/auth.types.ts`,
  `apps/api/src/auth/password-hashing.service.ts`
- `apps/api/src/users/users.module.ts`,
  `apps/api/src/users/users.repository.ts`,
  `apps/api/src/users/users.service.ts`
- `apps/api/src/database/prisma.module.ts`,
  `apps/api/src/database/prisma.service.ts`,
  `apps/api/src/app.module.ts`
- `.env.example`, `apps/api/package.json`, `pnpm-lock.yaml`

## Key Decisions

- Access-token signing uses `JWT_ACCESS_SECRET` from `ConfigService`; startup
  rejects a missing or shorter-than-32-byte secret.
- Access and refresh lifetimes are configurable in seconds. Defaults are 900
  seconds and 2,592,000 seconds respectively.
- Refresh tokens are opaque rather than JWTs. Their 256 bits of random entropy
  allow a fast SHA-256 digest for lookup without storing the bearer value.
- Registration normalizes email and creates no role assignment because the
  registration role and approval workflow are not defined by the schema or
  RBAC matrix.

## Business Rules

- Login returns the same credential error for unknown, invalid-password, and
  inactive accounts.
- Password hashes and refresh-token values are never included in responses.
- Rotation revokes the old session and creates its replacement in one database
  transaction. Reuse detection revokes all active sessions for that user.
- Logout revokes only the session identified by the supplied refresh token and
  is idempotent.

## How to Run & Test

1. Set a random secret of at least 32 bytes as `JWT_ACCESS_SECRET` in the
   repository-root `.env`; the API loads it whether started from the API
   workspace or repository root. Do not commit the secret. The access and
   refresh lifetimes can be configured with `JWT_ACCESS_TTL_SECONDS` and
   `AUTH_REFRESH_TTL_SECONDS`.
2. Run the API with `corepack pnpm@12.21.0 --filter @school/api dev`.
3. This implementation step was checked with:
   - `corepack pnpm@12.21.0 exec prisma generate --schema prisma\schema.prisma` — passed.
   - `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
   - `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
   - `corepack pnpm@12.21.0 --filter @school/api build` — passed.
4. Auth behavior tests are recorded in Phase 1 / Step 1.7.

## Data/Permissions Impact

No Prisma models, migrations, seeds, or RBAC permissions changed. The services
use the existing `User`, `UserStatus`, and `Session` contracts.

## Known Limitations

- Controllers, request DTO validation, access-token verification guards,
  rate-limiting, and email verification were not part of this step; they were
  added in later Phase 1 steps.
- New registrations are active users without a role until a separately defined
  workflow assigns one.
- Starting the API requires `JWT_ACCESS_SECRET`; the later RBAC step also
  makes Redis a startup dependency.

## Copilot Usage

Copilot implemented the service and repository wiring against the existing
Prisma schema and RBAC matrix. Password/session handling and the lack of an
implicit registration role were reviewed against those sources.

The session lifecycle decision is proposed in
[`0001-auth-session-lifecycle.md`](../../adr/0001-auth-session-lifecycle.md).

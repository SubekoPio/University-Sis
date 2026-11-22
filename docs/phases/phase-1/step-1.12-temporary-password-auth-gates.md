<!-- Purpose: Record public-registration removal and forced temporary-password change gates. -->

# Phase 1 / Step 1.12: Login Gating and Temporary Password Change

## Goal

Disable public registration and require administrator-issued temporary
credentials to be changed before the account can use other endpoints.

## What Was Built

- Removed the `POST /auth/register` route; it now resolves to 404.
- Added a throttled, authenticated `POST /auth/change-password` operation.
- Added expiry checks at login, refresh, and password change, with
  administrator-contact guidance for expired credentials.
- Added the global forced-change guard, which restricts the session to password
  change and logout and returns `MUST_CHANGE_PASSWORD` elsewhere.
- Password change clears temporary state, verifies email, and revokes other
  sessions while preserving the session used to change the password.

## Key Decisions

- A missing temporary-password expiry is treated as expired.
- The existing password contract remains non-empty, with a 1024-character
  maximum at the API boundary; no additional strength rule was added.
- Removing the HTTP route does not make `POST /auth/register` available to the
  public; account creation is handled through the admin service.

## Business Rules

- Temporary-password sessions cannot use recovery or ordinary API routes.
- The user must supply the current temporary password and cannot reuse it.
- Expired credentials require administrator assistance.

## How to Run & Test

- From `apps/api`, `corepack pnpm@12.21.0 run build` — passed.
- Auth service, controller, repository, and HTTP behavior tests are recorded
  in Step 1.14.

## Data/Permissions Impact

No schema, seed, or permission changes in this step. The implementation uses
the lifecycle fields from Step 1.10 and preserves the existing session model.

## Known Limitations

Expired temporary credentials cannot be recovered through self-service; an
administrator must resend credentials.

## Copilot Usage

Copilot inspected the auth service, controller, guards, repositories, and
session flow, then implemented the route restriction and password-change
behavior. Tests are recorded separately.

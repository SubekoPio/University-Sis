<!-- Purpose: Document the forced temporary-password change and authentication restrictions. -->

# Phase 1 / Step 1.18: Temporary-Password Authentication Gates

## Goal

Remove public registration and require administrator-issued temporary
credentials to be changed before the session can use other endpoints.

## What Was Built

- Removed `POST /auth/register`; the service-level registration operation
  remains internal and no public registration route is exposed.
- Rejected expired or missing-expiry temporary credentials at login with
  instructions to contact an administrator.
- Added throttled `POST /auth/change-password`, requiring the current temporary
  password and a different replacement password.
- Restricted valid temporary-password sessions to password change and logout,
  returning the `MUST_CHANGE_PASSWORD` error code elsewhere.
- Changed the password atomically, marked the email verified, cleared temporary
  password state, and revoked every other session while preserving the current
  session.
- Extended the authentication lookup and request identity with the lifecycle
  state and current session ID needed by these checks.

## Key Decisions

- Public route removal lets Nest return its normal 404 for `POST /auth/register`;
  the internal service-level registration behavior is retained.
- A missing temporary-password expiry is treated as expired to fail closed.
- The existing password policy is retained: non-empty and at most 1024
  characters, with no new strength requirement.
- The session restriction runs globally for requests carrying an active bearer
  session, so otherwise-public routes cannot be used to bypass the gate.

## Business Rules

- A successfully authenticated temporary-password account must change its
  temporary password before accessing any endpoint other than password change
  or logout.
- The replacement cannot reuse the temporary password.
- A failed or expired password change does not clear the forced-change state.
- Password changes preserve only the session used to complete the change.

## How to Run & Test

- From `apps/api`, `corepack pnpm@12.21.0 run build` — passed.
- Focused behavior tests are recorded in the separate Phase 1 / Step 1.19.

## Data/Permissions Impact

No schema, migration, seed, or permission changes. The implementation uses
existing `User` lifecycle fields and records the behavioral contract in
`docs/DATABASE_SCHEMA.md`.

## Known Limitations

- A user with an expired temporary password must contact an administrator for
  credential reissue; self-service recovery does not override this requirement.

## Copilot Usage

Copilot inspected the existing auth, repository, session, and RBAC boundaries,
implemented the controller/service and shared guard support, then built the API.
Tests were intentionally left for the separate test step.

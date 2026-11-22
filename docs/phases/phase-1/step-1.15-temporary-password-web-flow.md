<!-- Purpose: Record the web login and forced temporary-password-change experience. -->

# Phase 1 / Step 1.15: Frontend Authentication Updates

## Goal

Connect the web login flow to the temporary-password API contract and guide
users to replace an administrator-issued password before continuing.

## What Was Built

- Added `/change-password` with current password, new password, confirmation,
  policy guidance, and expiry/admin-contact messaging.
- Routed logins and `MUST_CHANGE_PASSWORD` responses to the required form.
- Added shared client auth-state observation and a minimal signed-in `/` home.
- Added API-client behavior tests for the password-change flag, refresh-gate
  fallback, forced-change errors, and successful local state cleanup.

## Key Decisions

- The current API login response omits `mustChangePassword`; when absent, the
  client probes the existing refresh endpoint. Normal logins therefore rotate
  the refresh session once during that probe.
- Password validation follows the API contract and does not invent a stronger
  password policy.
- No public Register/Sign up page, route, or link was present to remove.
  The existing footer already used design-system tokens and was not changed.

## Business Rules

- Forced-change sessions are directed to `/change-password` before ordinary
  app use.
- Expired temporary passwords display instructions to contact an administrator.
- A successful change clears local forced-change state and continues to `/`.

## How to Run & Test

Run from `apps/web`:

- `corepack pnpm@12.21.0 run test` — passed (1 file, 10 tests).
- `corepack pnpm@12.21.0 run typecheck` — passed.
- `corepack pnpm@12.21.0 run lint` — passed.
- `corepack pnpm@12.21.0 run build` — passed; the existing Tailwind config
  emitted a non-blocking module-type warning.
- Browser check — passed for the change form, expiry guidance, signed-in home,
  and forced-change redirect.

## Data/Permissions Impact

No backend, schema, migration, seed, or permission changes.

## Known Limitations

The refresh-gate probe rotates the normal login session when the server omits
the flag. The signed-in root is a minimal landing page until a dashboard is
implemented. No footer edit was needed.

## Copilot Usage

Copilot inspected the auth pages, API client, API behavior, and design tokens,
implemented the web flow, and ran the web checks and browser validation.

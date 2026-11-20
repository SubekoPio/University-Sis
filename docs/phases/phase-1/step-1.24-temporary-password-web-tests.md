<!-- Purpose: Record web tests for forced-password-change navigation and API state. -->

# Phase 1 / Step 1.24: Temporary-Password Web Tests

## Goal

Verify the client detects temporary-password requirements, guides users through
the replacement flow, and retains the existing API refresh behavior.

## What Was Built

- Extended `apps/web/src/lib/api-client.test.ts` to cover login responses with
  `mustChangePassword`, the refresh-gate fallback when the flag is absent,
  API-driven forced-change state, successful local state cleanup, and expired
  password messaging.
- Updated the test browser mock with the event APIs used by the shared auth
  state subscription.
- Retained coverage for attaching tokens, one-time refresh, and sharing a
  refresh request across concurrent calls.

## Key Decisions

- Kept tests in a separate step from the UI implementation.
- Used the existing Vitest API-client suite rather than adding a component
  testing dependency.
- Preserved all existing backend and auth test files.

## Business Rules

- A login response with `mustChangePassword: true` routes to the required form.
- When the field is omitted, the current server's refresh gate determines
  whether the session requires a change.
- A `MUST_CHANGE_PASSWORD` API response stores the requirement and its message;
  success clears the local requirement and notice.
- Expired temporary passwords retain the administrator-contact message.

## How to Run & Test

Run these commands from `apps/web`:

- `corepack pnpm@12.21.0 run test` — passed (1 test file, 10 tests).
- `corepack pnpm@12.21.0 run typecheck` — passed.
- `corepack pnpm@12.21.0 run lint` — passed.
- `corepack pnpm@12.21.0 run build` — passed.

Browser validation confirmed the change form, expiration guidance, signed-in
home, and forced-password redirect.

## Data/Permissions Impact

No schema, migration, seed, permission, or backend changes.

## Known Limitations

The current API omits `mustChangePassword` from login responses, so the client
uses the existing refresh endpoint as a gate probe when the field is absent.
The minimal signed-in home remains a placeholder pending dashboard features.

## Copilot Usage

Copilot added API-client tests, corrected the test browser mock after it exposed
the new event dependency, reran web checks, and recorded their results.

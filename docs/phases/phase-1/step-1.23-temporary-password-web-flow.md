<!-- Purpose: Document the web UI for forced temporary-password changes. -->

# Phase 1 / Step 1.23: Temporary-Password Web Flow

## Goal

Route temporary-password accounts into a validated password-change flow and
provide a signed-in home destination without adding public registration.

## What Was Built

- Added `/change-password` with current password, replacement password,
  confirmation, inline policy guidance, and API error feedback.
- Routed login responses that report `mustChangePassword` to the change page;
  API `MUST_CHANGE_PASSWORD` errors also set the client session flag and route
  there with their message.
- Displayed administrator contact guidance for expired temporary passwords.
- Replaced the root login redirect with a minimal signed-in home and added
  sign-out behavior.
- Extended `AuthField` so helper text is programmatically associated with its
  input.
- Added a shared auth-state subscription so forced-password responses from any
  API request navigate without reloading the page.
- Confirmed the shared footer already uses only the `brand` and `card` tokens;
  it did not need modification. No public registration page or sign-up link
  existed.

## Key Decisions

- The existing API policy is non-empty passwords up to 1024 characters; the
  form reflects that rule and recommends a unique passphrase without imposing
  an unsupported strength requirement.
- `AuthUser.mustChangePassword` is optional because the current login response
  does not include that field. The API client probes the existing refresh gate
  when the flag is absent; the shared auth-state observer handles the resulting
  `MUST_CHANGE_PASSWORD` response.
- The new root page is a minimal authenticated landing destination because no
  dashboard route exists yet.

## Business Rules

- Students do not self-register; public registration remains unavailable.
- Temporary-password changes require the current password, a different
  replacement, and matching confirmation.
- Expired temporary passwords display explicit administrator-contact guidance.

## How to Run & Test

Run these commands from `apps/web`:

- `corepack pnpm@12.21.0 run typecheck` — passed.
- `corepack pnpm@12.21.0 run lint` — passed.
- `corepack pnpm@12.21.0 run build` — passed.

Frontend behavior tests are recorded in the separate Phase 1 / Step 1.24.

## Data/Permissions Impact

No schema, migration, seed, permission, or backend changes. The UI continues to
rely on server-side session and authorization enforcement.

## Known Limitations

The current backend login response does not return `mustChangePassword`, so
normal logins without an explicit flag make one refresh request to discover
whether the server enforces the temporary-password gate. The signed-in root is
a placeholder until application workspaces exist.

## Copilot Usage

Copilot inspected the existing auth pages, API client, design tokens, and
password contract; added the client-side flow and route; and ran typecheck,
lint, build, and browser validation.

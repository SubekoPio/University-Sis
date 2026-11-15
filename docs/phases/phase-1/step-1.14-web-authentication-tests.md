# Phase 1 / Step 1.14: Web Authentication Tests

## Goal

Add focused automated coverage for the new browser API client's access-token
attachment and refresh-on-401 behavior.

## What Was Built

- Added Vitest coverage proving protected requests attach the saved access
  token.
- Verified a 401 triggers one refresh, stores the rotated token pair, and
  retries the original request once with the new access token.
- Verified a second 401 is surfaced without another refresh or retry.
- Verified concurrent unauthorized requests share one in-flight refresh.

## Key Decisions

- Added Vitest to `apps/web` because the package did not have an existing test
  runner; this follows the API package's established Vitest convention.
- Tests stub browser session storage and `fetch`, so they run without a live
  API or browser environment.

## Business Rules

- A protected request can be retried at most once after a successful refresh.
- Simultaneous 401 responses use a shared refresh request to preserve refresh
  token rotation behavior.
- Authentication and recovery requests remain outside the protected-request
  refresh retry path.

## How to Run & Test

- `pnpm --filter @school/web test` — passed; 1 file, 4 tests.
- `pnpm --filter @school/web typecheck` — passed.
- `pnpm --filter @school/web lint` — passed.
- `pnpm --filter @school/web build` — passed; Next.js emitted a non-blocking
  module-type warning for the existing Tailwind config.

## Data/Permissions Impact

No schema, migration, seed, permission, or backend route changes.

## Known Limitations

- The tests cover the API client but do not automate browser-level component
  behavior; route rendering and mobile layout were checked manually in the
  separate Phase 1 / Step 1.13.

## Copilot Usage

Copilot added tests against the token-storage and API-refresh contract, then
verified them with mocked browser storage and network responses.

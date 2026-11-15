# ADR 0004: Store Web Auth Tokens in Session Storage

- **Status:** Proposed
- **Date:** 2026-11-15

## Context

The requested web client needs to attach access tokens to API calls and refresh
them once after a protected request returns 401. The current backend contract
returns access and refresh tokens in JSON and does not provide an HttpOnly
cookie session.

## Decision

Store the returned token pair in browser `sessionStorage` for the current tab.
Attach the access token to protected API requests. Share one refresh request
between concurrent unauthorized requests and retry each original request at
most once.

## Alternatives

- **HttpOnly secure cookies:** preferred for reducing JavaScript access to
  credentials, but not available without changing the backend contract and
  adding cookie/CSRF handling.
- **In-memory-only storage:** limits persistence but loses the session on
  reload.
- **`localStorage`:** rejected because it persists credentials beyond the
  current tab session.

## Consequences

- The token pair survives a page reload in the same tab but is not intended to
  persist as a long-lived browser preference.
- Same-origin JavaScript can read these tokens; an XSS vulnerability could
  expose them. This choice does not replace CSP or output-safety controls.
- Moving to HttpOnly cookies would require coordinated API, CORS, CSRF, and
  frontend changes.

The current implementation is in `apps/web/src/lib/api-client.ts`.

# Phase 1 / Step 1.13: Web Authentication Pages

## Goal

Provide responsive login, password recovery, password reset, and email
verification pages in `apps/web`, backed by the existing authentication API.

## What Was Built

- Added `/login`, `/forgot-password`, `/reset-password`, and `/verify-email`
  App Router pages with React Hook Form and Zod validation.
- Added TanStack Query mutations for authentication and recovery requests, with
  pending, error, and success feedback.
- Added a typed API client that attaches the stored access token to protected
  requests and shares a refresh request across concurrent 401 responses before
  retrying each protected request once.
- Added the shared query provider, responsive authentication shell, shadcn
  form/card primitives, semantic status banners, and brand-token footer.
- Added optional `?token=` prefill for reset and verification pages. The token
  query is resolved inside Suspense so the static page shell can be prerendered.
- Redirected the root route to `/login`.

## Key Decisions

- No backend code or API contracts were changed. The API client defaults to
  `http://localhost:3001`; deployments can set `NEXT_PUBLIC_API_BASE_URL`.
- Tokens are held in `sessionStorage` for the current browser tab. Protected
  requests retry only once after refresh; authentication and recovery requests
  do not trigger automatic refresh.
- Frontend Zod constraints mirror the current API DTO length limits.
- No post-login redirect was added because this step does not introduce a
  protected landing page.

## Business Rules

- Password-reset and verification tokens are accepted as pasted text or as a
  `token` query parameter.
- Forgot-password success displays the API's generic response; account
  existence is not inferred by the UI.
- Form feedback includes text and semantic status icons; color is not the sole
  status indicator.

## How to Run & Test

- Start the web app with `pnpm --filter @school/web dev`.
- The local API must be reachable at `http://localhost:3001`, or configure
  `NEXT_PUBLIC_API_BASE_URL` for another API origin.
- `pnpm --filter @school/web typecheck` — passed.
- `pnpm --filter @school/web lint` — passed.
- `pnpm --filter @school/web build` — passed; Next.js emitted a non-blocking
  module-type warning for the existing Tailwind config.
- Browser check — login, forgot-password, reset-password, and verify-email
  rendered; query-token prefill worked; a 390px mobile viewport had no
  horizontal overflow.
- Focused API-client automated tests are recorded in the separate Phase 1 /
  Step 1.14.

## Data/Permissions Impact

No schema, migration, seed, permission, or backend route changes.

## Known Limitations

- Auth tokens are stored in browser `sessionStorage`; an HttpOnly-cookie
  session would require a backend contract change, which was out of scope.
- There is no registration page or post-login destination in this step.

## Copilot Usage

Copilot implemented the frontend against the existing API DTOs and reviewed
the route behavior, token refresh flow, accessible form feedback, and design
token usage.

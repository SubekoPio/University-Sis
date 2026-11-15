# Phase 1 / Step 1.8: Frontend Authentication UI

## Goal

Provide responsive login, password-recovery, password-reset, and email-
verification pages in `apps/web`, using the existing authentication API without
changing backend behavior.

## What Was Built

- Added the four routes `/login`, `/forgot-password`, `/reset-password`, and
  `/verify-email`, plus a root redirect to `/login`.
- Added React Hook Form and Zod validation, TanStack Query mutations, and
  explicit pending, error, and success states.
- Added a typed API client that attaches the saved access token and retries a
  protected request once after a successful refresh. Concurrent 401 responses
  share one in-flight refresh request.
- Added a responsive authentication shell, reusable field and status
  components, shadcn card/input/label primitives, and a shared Footer using
  only semantic design-system tokens.
- Supports prefilled reset and verification tokens through `?token=...`.

### Files created or changed

- `apps/web/package.json`, `pnpm-lock.yaml`
- `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`,
  `apps/web/src/app/providers.tsx`
- `apps/web/src/app/login/page.tsx`,
  `apps/web/src/app/forgot-password/page.tsx`,
  `apps/web/src/app/reset-password/page.tsx`,
  `apps/web/src/app/verify-email/page.tsx`
- `apps/web/src/components/auth/auth-field.tsx`,
  `apps/web/src/components/auth/auth-page-shell.tsx`,
  `apps/web/src/components/auth/login-form.tsx`,
  `apps/web/src/components/auth/forgot-password-form.tsx`,
  `apps/web/src/components/auth/reset-password-form.tsx`,
  `apps/web/src/components/auth/verify-email-form.tsx`
- `apps/web/src/components/layout/footer.tsx`
- `apps/web/src/components/ui/card.tsx`,
  `apps/web/src/components/ui/input.tsx`,
  `apps/web/src/components/ui/label.tsx`,
  `apps/web/src/components/ui/status-banner.tsx`
- `apps/web/src/lib/api-client.ts`,
  `apps/web/src/lib/api-client.test.ts`

## Key Decisions

- The API base URL defaults to `http://localhost:3001`; deployments may set
  `NEXT_PUBLIC_API_BASE_URL`.
- Tokens are stored in browser `sessionStorage` for the current tab. An
  HttpOnly-cookie design would require a backend contract change.
- Password and token length limits mirror the existing API DTOs. The pages do
  not invent additional password-strength rules.
- The reset and verification query values resolve beneath Suspense so the
  surrounding static page shell can be prerendered.
- No post-login redirect was added because this step does not create a
  protected landing page.

## Business Rules

- A protected request is retried at most once after refresh; login and recovery
  requests do not initiate refresh.
- Forgot-password feedback uses the API's generic response and does not infer
  whether an account exists.
- Status messages use visible text and icons in addition to semantic colors.
- Registration is not a UI route in this step.

## How to Run & Test

- Start the web app: `pnpm --filter @school/web dev`.
- Configure the API at `http://localhost:3001`, or set
  `NEXT_PUBLIC_API_BASE_URL`.
- `pnpm --filter @school/web typecheck` — passed.
- `pnpm --filter @school/web lint` — passed.
- `pnpm --filter @school/web test` — passed; 1 file, 4 API-client tests.
- `pnpm --filter @school/web build` — passed; Next.js printed a non-blocking
  module-type warning for the existing Tailwind config.
- Browser check — all four routes rendered, query-token prefill worked, and a
  390px viewport had no horizontal overflow.

## Data/Permissions Impact

No schema, migration, seed, permission, or backend route changes.

## Known Limitations

- `sessionStorage` is accessible to same-origin JavaScript; HttpOnly-cookie
  storage remains a possible future backend/frontend design change.
- The client does not redirect to a dashboard after login because no such
  destination is part of this phase.
- The route forms have manual browser checks; automated frontend tests focus on
  the API client's token-refresh behavior.

## Copilot Usage

Copilot implemented the pages against the existing API DTOs and reviewed the
design-token usage, responsive layout, token refresh flow, and accessible form
feedback. The code and build output were reviewed before documenting this step.

The browser token-storage decision is proposed in
[`0004-browser-token-storage.md`](../../adr/0004-browser-token-storage.md).

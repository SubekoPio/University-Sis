# Phase 2 / Step 2.18: Shared App Shell

## Goal

Create the shared protected application shell and role-based entry routing
without adding backend dependencies or role data providers.

## What Was Built

- Added `AppShell`, `NavigationRail`, `TopBar`, and role-specific placeholder
  home pages.
- Added grouped role navigation for student, lecturer, registrar, administrator,
  admissions officer/head, and bursar workspaces.
- Added desktop rail collapse, mobile slide-over behavior, tooltips, active
  `aria-current`, skip-to-content, and accent focus rings.
- Added profile menu, current intake label, and multi-role switcher.
- Updated login and root entry routing to resolve role destinations.
- Added `/403` and wrong-role shell states.
- Preserved the existing brand-token footer.

## Key Decisions

- Frontend role resolution accepts optional `roles` and `permissions` fields
  from auth responses and falls back to read-only role workspace probes.
- Authorization remains server-side; frontend role routing is navigation
  behavior only.
- Admissions officer/head share `/admissions` and resolve to the most privileged
  available admissions role.
- Bursar navigation uses `/finance/application-fees` and waits for the full
  Finance home in Phase 3.

## Business Rules

- Admin, admissions, academic, and finance routes remain role-specific.
- The student, lecturer, registrar, admissions, bursar, and admin workspaces
  deny mismatched role routes.
- Enabled false navigation items are omitted.
- Only design-system semantic brand tokens are used.

## How to Run & Test

- `pnpm typecheck` in `apps/web`
- `pnpm build` in `apps/web`

Both checks passed. UI tests are intentionally separate from this implementation
step.

## Data/Permissions Impact

- No backend, Prisma, permission seed, or API changes.
- Uses optional auth response role metadata and existing protected endpoints only.
- Navigation permission keys mirror `docs/RBAC_MATRIX.md`.

## Known Limitations

- Admissions officer/head and bursar roles require optional role or permission
  claims or a future frontend-safe authorization endpoint; the current login
  API does not expose those claims.
- Navigation destinations without Phase 2 placeholder pages may return Next.js
  not-found responses until their pages are implemented.

## Copilot Usage

Copilot inspected the design system and existing web auth patterns, generated
the shell and role pages, and verified the implementation with strict
TypeScript and a production Next.js build.

## Follow-up Validation

- Removed redundant synchronous effect state updates from the redirect branches.
- Configured the Next.js ESLint plugin to resolve the app-router workspace root.
- Serialized pre-commit lint-staged batches to avoid concurrent ESLint processes
  exhausting local resources.
- Fixed remaining API non-null assertions and a redundant fee-status assignment
  exposed by the full staged lint run.

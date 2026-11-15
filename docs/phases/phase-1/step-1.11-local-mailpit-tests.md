# Phase 1 / Step 1.11: Local Mailpit Tests

## Goal

Verify Mailpit SMTP message construction, provider selection, and the
production-mode restriction without requiring a running SMTP server.

## What Was Built

- Added tests confirming messages use the configured local SMTP host and sender.
- Added coverage for invalid SMTP configuration.
- Verified that Mailpit is selected only when configured and cannot be selected
  with `NODE_ENV=production`.

## Key Decisions

- Mock Nodemailer transport calls so tests never open a network connection.
- Use Nest's testing module to exercise the actual email-provider binding.

## Business Rules

- Development messages are sent to the configured local Mailpit host only.
- Production configuration cannot select the Mailpit provider.

## How to Run & Test

- `corepack pnpm@12.21.0 --filter @school/api exec vitest run src/auth` —
  passed; 6 files, 25 tests.
- `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
- `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
- `corepack pnpm@12.21.0 --filter @school/api build` — passed.
- `docker compose config --quiet` — passed.
- `corepack pnpm@12.21.0 exec prettier --check apps/api/src/auth/email/mailpit-email.service.ts apps/api/src/auth/email/mailpit-email.service.spec.ts apps/api/src/auth/email/email.module.ts docker-compose.yml docs/phases/phase-1/step-1.10-local-mailpit.md` — passed.

## Data/Permissions Impact

No persisted data, schema, migration, seed, or permission changes. The test
suite uses in-memory mocks and does not connect to Mailpit or Resend.

## Known Limitations

- The tests mock SMTP delivery; local Docker connectivity should be checked when
  starting Mailpit in the developer's environment.

## Copilot Usage

Copilot added tests for the provider boundary and production restriction. The
test setup was reviewed to ensure that no real email or external network
requests occur.

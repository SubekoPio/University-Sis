# Phase 1 / Step 1.10: Local Mailpit Email Delivery

## Goal

Provide a local-only email capture option for account recovery and verification
without requiring a Resend account, API key, or verified sender domain.

## What Was Built

- Added a Mailpit SMTP `EmailService` implementation using Nodemailer.
- Added `EMAIL_PROVIDER` selection between `mailpit` and `resend`; Resend remains
  the default if no provider is selected.
- Added a Compose Mailpit service with SMTP and web UI ports bound to localhost.
- Configured `.env.example` for local Mailpit use with a non-deliverable test
  sender address.
- Prevented selecting Mailpit when `NODE_ENV=production`.

## Key Decisions

- Mailpit stores messages locally for inspection at `http://localhost:8025`; it
  does not deliver them to real recipients.
- The default host is `localhost` for an API running on the host. An API running
  inside Compose should use `MAILPIT_HOST=mailpit`.
- Resend remains available for deployment when `EMAIL_PROVIDER=resend` and
  `RESEND_API_KEY` plus a verified `EMAIL_FROM` are configured.

## Business Rules

- Mailpit is not permitted when the application runs with
  `NODE_ENV=production`.
- The existing authentication workflows continue to use the `EmailService`
  interface and do not depend on either provider.

## How to Run & Test

- Set `EMAIL_PROVIDER=mailpit`, `EMAIL_FROM="University SIS <noreply@example.test>"`,
  `MAILPIT_HOST=localhost`, and `MAILPIT_SMTP_PORT=1025` in the repository-root
  `.env`.
- Start only the local mail catcher with `docker compose up -d mailpit`; this
  does not start the database, Redis, or MinIO.
- Open `http://localhost:8025` to inspect verification and reset messages.
- Automated tests and build results are recorded in the separate Phase 1 /
  Step 1.11.

## Data/Permissions Impact

No schema, migration, seed, RBAC, or frontend changes. Mailpit retains captured
messages in memory and does not send them to external recipients.

## Known Limitations

- Mailpit messages are temporary and are lost when its container is recreated.
- The test sender uses the reserved `.test` domain and must not be used with the
  Resend provider for real delivery.

## Copilot Usage

Copilot added the local SMTP provider and Compose service behind the existing
email interface. Provider selection, production restriction, and localhost-only
port publishing were reviewed to avoid accidental external delivery.

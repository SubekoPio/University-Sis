# Phase 1 / Step 1.6: Password Recovery and Email Verification

## Goal

Add password recovery and email verification to the API with expiring,
single-use tokens, without changing the frontend.

## What Was Built

- Added `POST /auth/forgot-password`, `POST /auth/reset-password`,
  `POST /auth/verify-email`, and `POST /auth/resend-verification`.
- Added validated request DTOs and per-IP throttling for all recovery and
  verification endpoints.
- Added a provider-neutral `EmailService` interface and a Resend implementation
  configured through `RESEND_API_KEY` and `EMAIL_FROM`.
- Added simple HTML templates and registration-time verification email delivery.
- Added transactional token consumption: password reset updates the password
  and revokes active sessions; email verification marks the account verified.
- Added the `User.emailVerified` field and its follow-up migration.
- Added local Mailpit SMTP capture behind the same email interface; Resend
  remains available for deployment.

### Files created or changed

- `prisma/schema.prisma`,
  `prisma/migrations/20261115195000_user_email_verification/migration.sql`,
  `docs/DATABASE_SCHEMA.md`
- `apps/api/src/auth/password-recovery.repository.ts`,
  `apps/api/src/auth/password-recovery.service.ts`,
  `apps/api/src/auth/auth.service.ts`,
  `apps/api/src/auth/auth.controller.ts`,
  `apps/api/src/auth/auth.module.ts`,
  `apps/api/src/auth/auth.types.ts`
- `apps/api/src/auth/dto/email-address.dto.ts`,
  `apps/api/src/auth/dto/reset-password.dto.ts`,
  `apps/api/src/auth/dto/verify-email.dto.ts`
- `apps/api/src/auth/email/email-service.interface.ts`,
  `apps/api/src/auth/email/email-templates.ts`,
  `apps/api/src/auth/email/email.module.ts`,
  `apps/api/src/auth/email/resend-email.service.ts`,
  `apps/api/src/auth/email/mailpit-email.service.ts`
- `apps/api/src/users/users.repository.ts`, `.env.example`,
  `docker-compose.yml`, `apps/api/package.json`, `pnpm-lock.yaml`

## Key Decisions

- Raw tokens are generated with 32 bytes of cryptographic randomness and only
  SHA-256 hashes are persisted.
- Reset tokens expire after one hour; verification tokens expire after 24 hours.
- Forgot-password and resend-verification responses do not disclose account
  existence or email-delivery failures. Registration reports an email-send
  failure; the user can request another verification message afterward.
- Email transport selection is behind `EmailService`. `EMAIL_PROVIDER` selects
  `resend` or `mailpit`; Mailpit is rejected in production. The sample `.env`
  selects Mailpit locally, while the code defaults to Resend if the variable is
  absent.
- Missing Resend configuration does not prevent startup, but an attempted
  Resend send fails explicitly.

## Business Rules

- Login is denied until the account's email address has been verified.
- A reset token may be consumed only once; successful reset revokes every
  active session for that user in the same database transaction.
- A verification token may be consumed only once and only before expiration.
- Password reset and verification endpoints reject invalid or expired tokens.

## How to Run & Test

- Set `RESEND_API_KEY` and `EMAIL_FROM` in the repository-root `.env` to a
  Resend API key and verified sender when using Resend; or configure the
  Mailpit values from `.env.example` for local capture.
- Start the local catcher with `docker compose up -d mailpit` and inspect
  messages at `http://localhost:8025`.
- Apply pending database migrations with `corepack pnpm@12.21.0 db:migrate`.
- `corepack pnpm@12.21.0 exec prisma validate --schema prisma\schema.prisma` —
  passed.
- `corepack pnpm@12.21.0 --filter @school/api build` — passed.
- `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
- Recovery and provider tests are recorded in Phase 1 / Step 1.7 and the
  follow-up Phase 1 / Steps 1.9–1.12.

## Data/Permissions Impact

Added `User.emailVerified Boolean @default(false)` and migration
`20261115195000_user_email_verification`. The initial authentication and RBAC
migration was applied to the local development database. The follow-up
email-verification migration is generated; its application status must be
checked in the target database. No roles or permissions changed.

## Known Limitations

- Resend delivery requires a configured API key and verified sender; local
  Mailpit capture does not deliver to real inboxes.
- In local development Mailpit is an alternative; it captures rather than
  delivers to real inboxes.
- Set `ADMIN_EMAIL` to a deliverable address before seeding; the seeded admin
  account must use `/auth/resend-verification` to obtain a verification token
  before login because the seed does not send an email.
- If registration succeeds in creating the account but email delivery fails,
  the account remains unverified and can use the resend-verification endpoint.
- The migration must be applied before running the updated API against an
  existing database.

## Copilot Usage

Copilot implemented the recovery and verification workflows against the
existing Prisma token models. Token persistence, enumeration-safe responses,
email-provider error handling, and session revocation boundaries were reviewed
against the requested behavior.

The provider and token-lifecycle decisions are proposed in
[`0003-auth-email-delivery.md`](../../adr/0003-auth-email-delivery.md).

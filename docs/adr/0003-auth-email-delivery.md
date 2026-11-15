# ADR 0003: Isolate Auth Email Delivery Behind a Provider Interface

- **Status:** Proposed
- **Date:** 2026-11-15

## Context

Registration verification, password recovery, and email verification need
outbound messages. Local development should not require real delivery
credentials or risk sending test messages externally, while deployment needs a
real provider.

## Decision

Use the `EmailService` interface for authentication workflows. Support Resend
for real delivery and Mailpit SMTP for local capture, selected with
`EMAIL_PROVIDER`. The application code defaults to Resend if the variable is
unset; `.env.example` selects Mailpit locally. Reject Mailpit when
`NODE_ENV=production`.

Generate one-time tokens with 32 bytes of randomness and persist only SHA-256
hashes. Forgot-password and resend-verification responses remain generic;
email delivery failures in those flows are logged without logging tokens.

## Alternatives

- **Call Resend directly from recovery workflows:** rejected because it
  couples business logic to one provider and makes isolated tests harder.
- **Use Resend for local development:** rejected because it requires a verified
  sender and sends to a real provider.
- **Treat Mailpit as a production-capable provider:** rejected because it is a
  local capture tool, not a delivery service.

## Consequences

- Tests can mock one provider-neutral interface.
- Local email messages can be inspected through Mailpit without delivery to
  real recipients.
- Resend requires a configured API key and verified sender for deployment.
- Registration can create an account before a provider failure is returned;
  the account remains unverified and can request verification again.

The current implementation is in `apps/api/src/auth/email/` and
`apps/api/src/auth/password-recovery.service.ts`.

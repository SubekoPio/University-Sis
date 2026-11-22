<!-- Purpose: Record Phase 2.10 admissions services and the website intake endpoint. -->

# Phase 2 / Step 2.10: Admissions Services

## Goal

Implement admissions application, document, fee, and admission workflows, plus
the single secured website intake endpoint, using the existing Phase 2 schema.

## What Was Built

- Added application create/update/withdraw, document review, application-fee,
  and admission services with Prisma repositories and transaction boundaries.
- Added `POST /integrations/applications`, protected by API key or HMAC,
  validated DTOs, idempotency by `externalRef`, and a per-minute rate limit.
- Extended `AdminUsersService` to create student-role accounts in the admission
  transaction and to send or resend temporary credentials after commit.
- Returned first-year curriculum placements for the admitted intake as prompted
  course units without creating premature `UnitRegistration` selections.

## Key Decisions

- ID, transcript, certificate, and photo are required; `OTHER` documents do not
  block document approval.
- Each qualifying fee deposit must meet the configured fee on its own and use
  the configured currency. Deposits remain in integer minor units.
- Admission preserves the application's student schedule, records the chosen
  study mode, starts the programme enrollment in study year 1 and the selected
  intake slot, and starts intake registration in `PENDING`.
- Student numbers use a unique `SIS-<UUID>` value because no institutional
  numbering format is defined in the current schema or domain documentation.
- The integration HMAC signs the raw request bytes; API-key comparisons and
  HMAC comparisons use constant-time equality checks.

## Business Rules

- Only active users with the relevant admissions permission may manage
  applications, review documents, record/void fees, or admit applicants.
- Admission requires all four required document types approved, a non-voided
  qualifying fee record, and an admitting user distinct from every user who
  approved an application document.
- The user who recorded a fee cannot void it. Voids require a reason and update
  the existing record rather than deleting it.
- User account, student profile, admission, programme enrollment, intake
  registration, and application state commit atomically.
- Credential email is attempted after that transaction. Failed delivery is
  audited without undoing admission; resend rotates the temporary credential.
- Website retries with an existing `externalRef` return the existing
  application without changing it.

## How to Run & Test

- `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
- `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
- `git diff --check` — passed.
- Application tests are intentionally deferred to the separately scoped
  admissions test step.
- No migration or database operation was needed or run.

## Data/Permissions Impact

No Prisma schema, migration, seed, or permission-key changes. The implementation
uses the existing `admissions:application:manage`,
`admissions:document:review`, `admissions:fee:confirm`, and `admissions:admit`
permissions. The API root now registers the admissions module.

## Known Limitations

- Prompts are derived from enrollment and active curriculum placements; the
  existing schema intentionally has no pending `UnitRegistration` state.
- The only HTTP route added is the secured external application intake. Staff
  and student-facing admissions routes remain future work.
- Student-number formatting can be replaced when the institution defines its
  numbering policy.

## Copilot Usage

Reviewed the canonical RBAC and database documents, Phase 2 admissions schema
and service prompt, existing account-provisioning and email services, and
academic repository patterns. Required application document types were
confirmed before implementation. Admission, fee, permission, and email
transaction behavior remains subject to the separate test step.

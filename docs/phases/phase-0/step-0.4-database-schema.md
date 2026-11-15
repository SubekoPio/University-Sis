# Phase 0 / Step 0.4: Database Schema Documentation

## Goal

Document the proposed SIS data model and its business invariants before Prisma
models and migrations are implemented.

## What Was Built

- Added `docs/DATABASE_SCHEMA.md` with proposed model groups for Auth/RBAC, SIS
  and Academic, Finance, feature flags, LMS, Exams, and audit logging.
- Recorded relationship, money, payment, history-retention, and access-scope
  invariants from the roadmap and RBAC matrix.
- Listed unresolved decisions and migration/seed expectations.

## Key Decisions

- Marked the document as a draft logical model because the repository currently
  has no Prisma schema or migrations.
- Kept unspecified cardinalities, ID types, and numbering policies as decisions
  requiring review instead of presenting them as implemented facts.
- Kept the canonical document path as `docs/DATABASE_SCHEMA.md`, matching the
  roadmap and project instructions.

## Business Rules

- Money is stored in integer minor units with currency, never floating point.
- Only Finance records active physical bank deposits; payments are not deleted
  and voids require a reason and maker-checker approval.
- Online card, bank, and mobile payments remain disabled behind separate
  feature flags, all default OFF.
- RBAC and ownership checks are enforced at the service/API layer, not inferred
  from database relations alone.
- Academic, financial, and audit history must not be destructively deleted.

## How to Run & Test

- Documentation-only change; no database or application tests were run.
- Prettier validation: `corepack pnpm@12.21.0 exec prettier --config .prettierrc.json --check docs/DATABASE_SCHEMA.md docs/phases/phase-0/step-0.4-database-schema.md docs/DEVELOPMENT_LOG.md docs/CHANGELOG.md`.

## Data/Permissions Impact

No database schema, migration, seed, endpoint, or permission implementation was
changed. The RBAC matrix and roadmap were reviewed. This document proposes
future schema constraints and points back to the RBAC matrix for authorization.

## Known Limitations

- No Prisma schema or migrations exist yet, so the model catalog requires human
  review and reconciliation when implementation begins.
- `docs/DATABASE_SCHEMA.md` is a logical design, not proof that any model,
  constraint, or migration is already deployed.
- The project has unresolved decisions for IDs, institutional scope, academic
  cardinalities, payment allocation, receipt numbering, and retention.

## Copilot Usage

Copilot drafted the model catalog from the roadmap, architecture, prompts, and
RBAC matrix. The absence of an implemented Prisma schema was verified before
documenting the design as proposed rather than current.

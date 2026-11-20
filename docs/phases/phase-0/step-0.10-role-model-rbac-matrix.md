<!-- Purpose: Record the Phase 0 role and permission-policy documentation step. -->

# Phase 0 / Step 0.10: Role Model and RBAC Matrix

## Goal

Define the institution's job-based role catalogue, scoped permission matrix,
and separation-of-duties rules before dependent feature implementation.

## What Was Built

- Redrafted `docs/RBAC_MATRIX.md` with 14 role columns, 96 permission rows,
  scope meanings, default-deny guidance, and separation-of-duties controls.
- Added `docs/ROLES.md` with each role's purpose, first-needed phase, and
  small/medium/large institution account estimates.
- Recorded the proposed authorization decision in
  [`ADR 0005`](../../adr/0005-role-model-and-separation-of-duties.md).

## Key Decisions

- Roles are job-based permission bundles. Multiple roles produce a union of
  grants; role names are not the endpoint authorization contract.
- Deny by default and enforce record scopes in the server and owning queries.
- Separation-of-duties restrictions remain mandatory even when a user holds
  multiple roles.
- Staffing counts are planning estimates, not institution requirements.

## Business Rules

- `admin` has no grade, finance-record, or admissions-decision access.
- The payment recorder cannot void the payment; the document reviewer cannot
  admit the applicant; administrator grants require a second administrator.
- Lecturers enter marks, an HOD or exams officer moderates, and the registrar
  publishes results. An actor cannot perform multiple stages alone.
- Physical bank deposits are the active payment path; online payment methods
  remain unavailable while their separate flags are OFF.

## How to Run & Test

This step changed governance documentation only; it has no runtime test.

- `corepack pnpm@12.21.0 exec prettier --check docs/RBAC_MATRIX.md docs/ROLES.md docs/phases/phase-0/step-0.10-role-model-rbac-matrix.md docs/adr/0005-role-model-and-separation-of-duties.md` — passed.
- `git diff --check` — passed.

## Data/Permissions Impact

This step changed the policy documents only, not Prisma models, migrations,
seed data, endpoints, or application code. The current schema has persisted
`Role`, `Permission`, `UserRole`, and `RolePermission` models, but the
implementation does not yet match this policy: `prisma/seed.ts` contains five
roles and 61 permission keys, while the matrix contains 14 roles and 96 keys.
The seed also grants `admin` finance, admission-review, and grade permissions
that this matrix denies.

## Known Limitations

- The documented role model is not yet reflected in seed data or production
  endpoint decorators.
- `RolesGuard` still supports role-name authorization; the production
  permission-based policy has not yet been applied to endpoints.
- The payment, admission, administrator-grant, and result-publication
  separation-of-duties workflows are documented but are not implemented in the
  current application modules.
- Staffing estimates for student and lecturer accounts remain dependent on
  institutional enrollment and staffing ratios.

## Copilot Usage

Copilot drafted the role and permission documentation from the Phase 0
requirements. The grants and estimates were reviewed against the current
matrix, Prisma seed, and schema; the code gaps above are intentionally
recorded rather than represented as completed behavior.

<!-- Purpose: Record Phase 0 governance scaffolding and the actual-code documentation audit. -->

# Phase 0 / Step 0.14: Governance and Documentation Scaffolding

## Goal

Document Phase 0.10–0.14 work using the phase-step template, add governance
review scaffolding, and identify architecture/design-system documentation that
does not match or fully describe the current code.

## What Was Built

- Added placeholder reviewer teams in `.github/CODEOWNERS` and expanded the
  PR template with explicit role, permission, separation-of-duties,
  documentation, code-comment, and design-token prompts.
- Added `docs/runbooks/README.md` and the intake-by-intake
  `docs/ACCESS_REVIEW.md` template.
- Added a TypeScript-AST-based CI checker that compares literal
  `@Permissions` values against `docs/RBAC_MATRIX.md`; added four Node tests
  and wired both into CI.
- Reworked Phase 0.10, 0.11, 0.13, and 0.14 records to follow
  `docs/phases/step-template.md`, created the missing 0.12 record, and added
  one newest-first development-log entry per step.
- Drafted [`ADR 0005`](../../adr/0005-role-model-and-separation-of-duties.md).

## Key Decisions

- Permission decorators must use string literals so CI can verify each key.
  Non-literal and malformed arguments fail closed.
- The scanner covers TypeScript in `apps/` and `packages/`; this repository
  currently contains no `@Permissions` decorators.
- Code-owner teams remain clearly marked placeholders until real organization
  teams and branch protection are configured.
- The phase records distinguish documented policy from implemented runtime
  behavior.

## Business Rules

- Review every staff account and its roles at each intake; record the
  confirmer and the access removed, if any.
- Keep completed access-review records in a restricted institutional location,
  not in Git.
- Preserve default-deny and separation-of-duties controls from
  `docs/RBAC_MATRIX.md`.
- A CODEOWNERS file alone does not require approval; repository branch
  protection must require Code Owner reviews.

## How to Run & Test

- `node --test .github/scripts/check-permissions-matrix.test.mjs` — 4 tests passed.
- `node .github/scripts/check-permissions-matrix.mjs` — passed; 0 decorators
  checked across 77 TypeScript files.
- Negative integration fixture with `@Permissions("test:ci_probe:read")` —
  checker failed with exit code 1 as expected; the temporary fixture was
  removed.
- `corepack pnpm@12.21.0 exec prettier --check .github/pull_request_template.md .github/workflows/ci.yml .github/scripts/check-permissions-matrix.mjs .github/scripts/check-permissions-matrix.test.mjs docs/runbooks/README.md docs/ACCESS_REVIEW.md docs/DEVELOPMENT_LOG.md docs/phases/phase-0/step-0.14-governance-scaffolding.md` — passed.
- `git diff --check` — passed.

## Data/Permissions Impact

No application endpoint, permission grant, schema, migration, or seed data was
changed by this governance step. The CI checker adds a documentation-consistency
gate only; it does not apply guards to routes or enforce workflow separation
of duties.

## Known Limitations

- Replace all placeholder CODEOWNERS teams and enable required code-owner
  approval before relying on reviewer routing.
- The current authorization source does not yet match the matrix: the seed
  defines five roles and 61 permission keys; the matrix defines 14 roles and
  96 keys. No production `@Permissions` decorators are present, and
  `RolesGuard` remains available and is used by an E2E test.
- Payment, admission, administrator-grant, and result-publication
  separation-of-duties workflows are documented but not implemented in the
  current application modules.

### Documentation accuracy audit

These files were inspected but intentionally not modified in this task:

- `docs/ARCHITECTURE.md`
  - **Modules and dependencies:** the table describes target modules without
    clear per-module implementation status; most listed business modules are
    not present in `apps/api/src`.
  - **Modules and dependencies:** the Academic and Finance descriptions use
    `terms`, `programs`, and `courses`, conflicting with the required
    `intake`, `programme`, and `course unit` terminology.
  - **Request flow, item 2:** it describes public login/recovery routes but
    omits the currently public `POST /auth/register` endpoint, which conflicts
    with the no-public-sign-up rule.
  - **Request flow, item 3:** it says permission guards apply from the matrix,
    but there are no production `@Permissions` decorators; the guards are
    opt-in and the E2E example uses `RolesGuard`.
  - **Request flow, item 9** and **Data and infrastructure boundaries,
    Files:** `StorageService` is described as the binary-file path, but no
    implementation exists in the current API source.
- `docs/DESIGN_SYSTEM.md`
  - **Color tokens** and **Usage rules** match the current Tailwind/CSS tokens
    and status components; no token-value drift was found.
  - **Contrast and accessibility** documents light-background pairings only.
    `apps/web/src/app/globals.css` also defines a `.dark` theme, but the
    design-system document does not specify or validate dark-mode semantic
    status pairings. This is a documentation gap, not a stale light-token
    value.

## Copilot Usage

Copilot checked the requested phase records, ADR, and documentation findings
against the current repository. The gaps above are reported as follow-up work;
no application source was changed.

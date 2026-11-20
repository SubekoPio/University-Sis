<!-- Purpose: Record the Phase 0 Copilot instruction updates and their limits. -->

# Phase 0 / Step 0.11: Copilot Instructions Update

## Goal

Align global and scoped Copilot guidance with the project's terminology,
admissions, authorization, payment, attendance, documentation, and UI rules.

## What Was Built

- Updated `.github/copilot-instructions.md`, the four scoped files in
  `.github/instructions/`, and `apps/api/AGENTS.md`.
- Kept all six files below 60 lines. Current counts are 39, 17, 16, 15, 12,
  and 28 lines, respectively.

## Key Decisions

- Put shared rules in the root instructions and implementation-specific
  guidance in scoped files.
- Preserve existing package rules; make the requested requirements explicit
  without changing application code.
- Treat the files as authoring guidance, not as proof that runtime behavior
  already complies.

## Business Rules

- Use `intake`, `programme`, and `course unit`; never use `term` or `semester`.
- Do not allow public student sign-up; accounts are created by admins and
  students are admitted.
- Require permission-key checks with `@Permissions`, default-deny behavior,
  and the RBAC matrix's scopes and separation-of-duties rules.
- Keep physical bank deposits recorded by Finance as the active payment path;
  online payment flags remain OFF.
- Count only a qualifying continuous online-attendance stay and never expose
  meeting URLs in list or detail responses.
- Use semantic UI tokens and never convey status by color alone.

## How to Run & Test

This instruction-only step has no runtime test.

- `corepack pnpm@12.21.0 exec prettier --check .github/copilot-instructions.md .github/instructions/backend.instructions.md .github/instructions/frontend.instructions.md .github/instructions/prisma.instructions.md .github/instructions/tests.instructions.md` — passed.
- PowerShell line-count check for all six instruction files — passed; each is under 60 lines.
- `git diff --check` — passed.

## Data/Permissions Impact

No application code, schema, migration, seed, endpoint, or permission grant
changed. These instructions describe the required behavior but do not implement
it.

## Known Limitations

- `apps/api/src/auth/auth.controller.ts` currently exposes a public
  `/auth/register` endpoint, contrary to the no-public-sign-up rule.
- The current permission guard is not applied through production
  `@Permissions` decorators; the role guard is exercised by an E2E test.
- `apps/api/AGENTS.md` has a Prettier warning that was also present on the
  original `HEAD` baseline; it was not reformatted in this step.

## Copilot Usage

Copilot drafted the instructions. The user reviewed and approved the proposed
instruction diff before it was saved.

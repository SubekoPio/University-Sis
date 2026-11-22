<!-- Purpose: Record the Phase 2 academic domain, permission, and terminology documentation. -->

# Phase 2 / Step 2.0: Domain Documentation and Instructions

## Goal

Document the Phase 2 academic model, propose precise Copilot instruction
language, add the Phase 2 permission assignments, and inventory legacy
terminology before schema or API work begins.

## What Was Built

- Drafted `docs/ACADEMIC_MODEL.md` from the Phase 2 roadmap and prompt library.
- Added the hierarchy, intake, curriculum, shared offering, admissions,
  student-schedule, offering-delivery, and continuous-attendance rules.
- Added the Phase 2 permission keys and role scopes to `docs/RBAC_MATRIX.md`.
- Listed documentation and archived prompts that retain legacy term or
  public-registration wording.
- Added a reviewed proposal for Copilot instructions; the instruction file was
  not changed because the Phase 2 prompt specifies review before saving.

## Key Decisions

- Used the exact permission keys and role grants in Phase 2 Prompt 2.7.
- Kept permission checks scoped by role assignment, record ownership, and
  separation of duties; the admin receives no Phase 2 academic, admissions, or
  finance permissions.
- Left unresolved retake eligibility and result-treatment policy as decisions
  for approval rather than inventing rules.

## Business Rules

- An academic year has exactly three intakes, with configurable names, dates,
  and selection windows.
- Eligible programmes share one offering per course unit per intake.
- Applicants apply through the separate website integration or admission
  office, pass document review and fee confirmation, and are admitted with a
  student schedule before the student account is created. Offering delivery
  mode is configured independently for each course-unit offering.
- Online `PRESENT` requires the configured continuous-stay share. Interrupted
  stays are never summed; reconnect grace and warning threshold are separately
  configurable.

## How to Run & Test

- `corepack pnpm@12.21.0 exec prettier --check docs/ACADEMIC_MODEL.md docs/RBAC_MATRIX.md docs/phases/phase-2/step-2.0-domain-documentation.md docs/DEVELOPMENT_LOG.md` — passed.
- Documentation search for `term`, `semester`, and sign-up uses of `register` — completed; findings are listed in `docs/ACADEMIC_MODEL.md`.
- No application tests were run; this step changes documentation only.

## Data/Permissions Impact

No Prisma schema, migration, seed, API, or application code was changed. The
RBAC matrix defines Phase 2 policy; matching seed changes are deferred to
Phase 2 Step 2.7.

## Known Limitations

The permission catalogue contains legacy Phase 0 rows with similar scopes.
Reconcile and remove/alias those before implementing Phase 2 endpoints and
seed grants. Retake rules require institutional approval.

## Copilot Usage

Copilot compared the Phase 2 roadmap and prompts with the current RBAC matrix
and searched documentation for legacy terminology. The Copilot instruction
text is proposed for review, not saved.

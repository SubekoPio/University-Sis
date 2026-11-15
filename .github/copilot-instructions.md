# Project Instructions

These instructions apply across the University SIS monorepo. Follow the relevant scoped instructions in `.github/instructions/` as well.

## Required context

- Before planning or changing application code, read `docs/RBAC_MATRIX.md` and `docs/DATABASE_SCHEMA.md` when they have been scaffolded.
- Until those canonical files exist, use the corresponding planned context in `docs/School_System_Copilot_Roadmap.md` and `docs/School_System_Copilot_Prompts.md` (Phase 0.4). Do not invent permissions or database contracts beyond that source material; if a task needs decisions it does not cover, draft/review the canonical docs first or ask for clarification.
- Follow the existing project structure and conventions in the affected package.

## TypeScript

- Use TypeScript strict mode and preserve type safety.
- Never use `any`. Prefer precise types, type guards, and `unknown` only at untrusted boundaries.
- Do not suppress type errors to make a change pass.

## Backend architecture

- Keep backend responsibilities layered: **Controller → Service → Repository (Prisma)**.
- Controllers handle HTTP concerns and delegate; they contain no business logic.
- Put business rules in services and database access in repositories using Prisma.
- Validate request DTOs with `class-validator`.
- Protect every endpoint with the appropriate RBAC decorators, based on `docs/RBAC_MATRIX.md`. Do not leave an endpoint unprotected or infer permissions.
- Store monetary amounts as integer minor units. Never store or calculate money as floating-point values.

## Code comments

- Always comment code: add a file header describing purpose and use, TSDoc for exported symbols, and concise block comments explaining why non-obvious logic exists.
- Keep comments accurate when behavior changes. Do not add comments that merely repeat obvious code.
- Add `///` documentation to Prisma models and fields.

## Tests

- Write tests in a separate, explicitly scoped step after the implementation step. Do not bundle feature implementation and its tests into one step unless specifically asked.
- Follow the test framework and patterns already used in the affected package.

## Documentation

- Document every development step in `docs/phases/` and add a corresponding entry to `docs/DEVELOPMENT_LOG.md`, creating the required documentation structure as established by Phase 0.9 when it has not yet been scaffolded.
- Update related source-of-truth documentation when changing schema, permissions, API behavior, or design tokens.
- Do not claim a step is documented until its phase record and development-log entry have been created.

## UI design system

- Before changing UI, read `docs/DESIGN_SYSTEM.md` when it has been scaffolded. Until then, use the design-system rules in Section 5 of `docs/School_System_Copilot_Roadmap.md` and the Phase 0.8 prompt in `docs/School_System_Copilot_Prompts.md`.
- Use only its semantic color tokens, including semantic status colors and their soft variants. Never use raw color values or introduce a new color outside the design system.
- Preserve accessible status communication: do not convey status by color alone.

## Payments

- **ACTIVE:** only physical bank deposits are available. Finance records the deposit and issues the receipt.
- **COMING SOON:** online card, bank, and mobile payments each require their own feature flag: `payments.online.card`, `payments.online.bank`, and `payments.online.mobile`. Each flag defaults to OFF.
- Never enable an online payment flag in application code or seed data. Keep online methods unavailable while their respective flags are off.

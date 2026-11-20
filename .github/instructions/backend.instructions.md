---
applyTo: "apps/api/**"
---

# Backend Instructions

- Read `docs/RBAC_MATRIX.md` and `docs/DATABASE_SCHEMA.md` first when they have been scaffolded. Until then, use the corresponding Phase 0.4 source material in `docs/School_System_Copilot_Roadmap.md` and `docs/School_System_Copilot_Prompts.md`; do not guess beyond it.
- Preserve the **Controller → Service → Repository (Prisma)** boundaries. Controllers translate HTTP input/output and delegate; services own business rules; repositories own persistence.
- Keep controllers free of business logic and direct database access.
- Use "intake" (never "term" or "semester"), "programme", and "course unit"; there are three intakes per academic year.
- Validate incoming DTOs with `class-validator` and use the project's established validation pipeline.
- Use `@Permissions` with keys from `docs/RBAC_MATRIX.md` on every endpoint; never check role names. Deny by default and enforce scopes and separation-of-duties rules.
- Do not provide public sign-up: admins create accounts, and students are admitted.
- Keep TypeScript strict and use no `any`.
- Represent money as integer minor units throughout DTOs, service logic, and persistence. Never use floating-point amounts.
- ACTIVE payments are physical bank deposits recorded by Finance with receipts. Online card, bank, and mobile payments are COMING SOON behind separate `payments.online.card`, `payments.online.bank`, and `payments.online.mobile` flags, default OFF; never enable them in code or seed data.
- Mark online attendance PRESENT only after a continuous stay meets the configured session share; never add interrupted time. Never return meeting URLs in list or detail responses.
- Add a file-purpose header, TSDoc for exports, and brief why-comments for non-obvious logic. Keep existing comments accurate.
- Document each implementation step under `docs/phases/` and in `docs/DEVELOPMENT_LOG.md`. Write or update tests in a separate step.

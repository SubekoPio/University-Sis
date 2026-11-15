---
applyTo: "apps/api/**"
---

# Backend Instructions

- Read `docs/RBAC_MATRIX.md` and `docs/DATABASE_SCHEMA.md` first when they have been scaffolded. Until then, use the corresponding Phase 0.4 source material in `docs/School_System_Copilot_Roadmap.md` and `docs/School_System_Copilot_Prompts.md`; do not guess beyond it.
- Preserve the **Controller → Service → Repository (Prisma)** boundaries. Controllers translate HTTP input/output and delegate; services own business rules; repositories own persistence.
- Keep controllers free of business logic and direct database access.
- Validate incoming DTOs with `class-validator` and use the project's established validation pipeline.
- Apply the appropriate RBAC decorator to every endpoint using the permissions in `docs/RBAC_MATRIX.md`; do not rely on authentication alone.
- Keep TypeScript strict and use no `any`.
- Represent money as integer minor units throughout DTOs, service logic, and persistence. Never use floating-point amounts.
- Keep online payment methods disabled by default behind their separate `payments.online.card`, `payments.online.bank`, and `payments.online.mobile` flags. Never enable those flags in code or seed data.
- Add a file-purpose header, TSDoc for exports, and brief why-comments for non-obvious logic. Keep existing comments accurate.
- Document each implementation step under `docs/phases/` and in `docs/DEVELOPMENT_LOG.md`. Write or update tests in a separate step.

---
applyTo: "**/*.prisma"
---

# Prisma Instructions

- Read `docs/DATABASE_SCHEMA.md` and `docs/RBAC_MATRIX.md` before changing the Prisma schema when they have been scaffolded. Until then, use the corresponding Phase 0.4 source material in `docs/School_System_Copilot_Roadmap.md` and `docs/School_System_Copilot_Prompts.md`; do not invent data or permission contracts beyond it.
- Keep schema changes aligned with the documented database model and established repository boundaries.
- Store monetary values as integer minor units; do not use floating-point database types for money.
- Add `///` documentation for every model and field, describing intent and relevant constraints.
- Preserve relations, referential behavior, indexes, uniqueness, and nullability required by the documented model. Do not make unrelated schema changes.
- Keep migration and seed changes consistent with the schema. Never enable online payment flags in code or seed data; their individual defaults must remain OFF.
- Document each schema step under `docs/phases/` and in `docs/DEVELOPMENT_LOG.md`. Write or update tests in a separate step.

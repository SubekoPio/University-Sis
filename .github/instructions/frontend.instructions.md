---
applyTo: "apps/web/**"
---

# Frontend Instructions

- Before changing UI, read `docs/DESIGN_SYSTEM.md` when it has been scaffolded. Until then, use Section 5 of `docs/School_System_Copilot_Roadmap.md` and the Phase 0.8 design-system prompt in `docs/School_System_Copilot_Prompts.md`; do not invent colors or tokens.
- Use only semantic color tokens defined by the design system for all UI states, including success, warning, error, info, and coming-soon states. Do not use raw hex/RGB values or ad hoc colors.
- Do not use the `badge` token for generic status; follow the design system's reserved token usage.
- Communicate status with text and, where appropriate, an icon as well as color.
- Show online card, bank, and mobile payments as "Coming soon" while their individual `payments.online.card`, `payments.online.bank`, and `payments.online.mobile` flags are OFF. Keep the physical Finance-recorded bank deposit flow as the active payment path.
- Never enable online payment flags in frontend code or seed data.
- Keep TypeScript strict and use no `any`; add file-purpose headers, TSDoc for exports, and why-comments for non-obvious logic.
- Follow the existing Next.js, React, Tailwind CSS v4, and component patterns in `apps/web`.
- Document each implementation step under `docs/phases/` and in `docs/DEVELOPMENT_LOG.md`. Write or update tests in a separate step.

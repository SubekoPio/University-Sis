---
applyTo: "**/*.{spec,test,e2e-spec}.ts"
---

# Test Instructions

- Tests are written in a separate step from the feature implementation step. Keep that separation visible in the phase documentation and development log.
- Read `docs/RBAC_MATRIX.md` and `docs/DATABASE_SCHEMA.md` before writing tests that depend on permissions or persisted data when they have been scaffolded. Until then, use their corresponding Phase 0.4 source material in `docs/School_System_Copilot_Roadmap.md` and `docs/School_System_Copilot_Prompts.md`; do not assume contracts beyond it.
- Use the test runner, assertions, fixtures, and mock conventions already established by the package. The API uses Vitest; use `vi` APIs rather than Jest APIs there.
- Test observable behavior and boundaries, including `@Permissions` checks, deny-by-default scopes, separation of duties, admin-created/admission-based accounts, and integer minor-unit money handling.
- Cover physical bank-deposit receipts, online-payment flags remaining OFF, continuous attendance thresholds without summing interrupted time, and meeting URLs omitted from list/detail responses where applicable.
- Keep tests isolated and deterministic; do not depend on production services or shared mutable state.
- Add a file-purpose header and concise Arrange / Act / Assert comments, with why-comments for non-obvious setup or expectations.
- Document the test step under `docs/phases/` and in `docs/DEVELOPMENT_LOG.md`.

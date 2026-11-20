<!-- Purpose: Track completed roadmap steps in newest-first order. -->

# Development Log

Entries are listed newest first. Add one entry for each completed roadmap step.

| Date       | Phase / step                                                     | Summary                                                                                                                     | PR link        |
| ---------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 2026-11-21 | Phase 1 / Step 1.24 — Temporary-password web tests               | Added API-client coverage for login flags, forced-change redirects, local state cleanup, and expired-password messaging.    | Not opened yet |
| 2026-11-21 | Phase 1 / Step 1.23 — Temporary-password web flow                | Added the forced-password-change page, API error routing, expired-password guidance, and signed-in root destination.        | Not opened yet |
| 2026-11-20 | Phase 1 / Step 1.22 — Account lifecycle and administration tests | Added account credential, forced-password session, and admin user-management E2E coverage without production changes.       | Not opened yet |
| 2026-11-20 | Phase 1 / Step 1.21 — Administrator user-management API tests    | Added HTTP coverage for route delegation, validation, RBAC metadata, OpenAPI output, and resend throttling.                 | Not opened yet |
| 2026-11-20 | Phase 1 / Step 1.20 — Administrator user-management API          | Added permission-protected routes, validated DTOs, Swagger docs, and resend throttling.                                     | Not opened yet |
| 2026-11-20 | Phase 1 / Step 1.19 — Temporary-password auth tests              | Added unit, repository, controller, and HTTP coverage for route removal, expiry, session gates, and throttling.             | Not opened yet |
| 2026-11-20 | Phase 1 / Step 1.18 — Temporary-password auth gates              | Removed public registration and added forced-password-change, expiry, and session restrictions.                             | Not opened yet |
| 2026-11-20 | Phase 1 / Step 1.17 — Administrator user-management tests        | Added 14 service/repository tests for permissions, credentials, audit records, session revocation, and lifecycle rules.     | Not opened yet |
| 2026-11-20 | Phase 1 / Step 1.16 — Administrator user-management service      | Added permission-gated account lifecycle, temporary credentials, audit records, and a pending schema migration.             | Not opened yet |
| 2026-11-20 | Phase 1 / Step 1.15 — User account lifecycle fields              | Added User password/deactivation metadata, `DEACTIVATED`, self-relations, indexes, and a reviewed migration (not applied).  | Not opened yet |
| 2026-11-20 | Phase 0 / Step 0.14 — Governance and access review               | Added CODEOWNERS placeholders, PR governance checks, intake access-review scaffolding, and a CI RBAC matrix check.          | Not opened yet |
| 2026-11-20 | Phase 0 / Step 0.13 — Environment configuration                  | Added Zod startup validation, environment examples, focused tests, and variable documentation.                              | Not opened yet |
| 2026-11-20 | Phase 0 / Step 0.12 — Semantic design tokens                     | Verified the existing semantic tokens, status components, and raw-hex lint rule; no UI source changes were needed.          | Not opened yet |
| 2026-11-20 | Phase 0 / Step 0.11 — Copilot instructions update                | Added terminology, admission-only student accounts, permission-based authorization, payment, attendance, URL, and UI rules. | Not opened yet |
| 2026-11-20 | Phase 0 / Step 0.10 — Role model and RBAC matrix                 | Redrafted the 14-role permission matrix, separation-of-duties controls, role purposes, and staffing estimates.              | Not opened yet |
| 2026-11-15 | Phase 1 / Step 1.14 — Web authentication tests                   | Added four Vitest cases for access-token attachment, refresh-once, and concurrent refresh handling.                         | Not opened yet |
| 2026-11-15 | Phase 1 / Step 1.13 — Web authentication pages                   | Added responsive auth pages, Zod forms, a refresh-aware API client, shared query provider, and brand-token footer.          | Not opened yet |
| 2026-11-15 | Phase 1 / Step 1.12 — Auth lifecycle and E2E tests               | Added auth login/refresh/reset lifecycle unit coverage and Supertest coverage for sessions and role guards.                 | Not opened yet |
| 2026-11-15 | Phase 1 / Step 1.11 — Local Mailpit tests                        | Verified SMTP message construction, development provider selection, production restriction, and invalid config.             | Not opened yet |
| 2026-11-15 | Phase 1 / Step 1.10 — Local Mailpit email delivery               | Added a development-only SMTP capture provider and localhost-bound Compose service, without requiring Resend.               | Not opened yet |
| 2026-11-15 | Phase 1 / Step 1.9 — Account recovery tests                      | Added recovery token, transactional session-revocation, verified-login, DTO, enumeration-safe, and throttling coverage.     | Not opened yet |
| 2026-11-15 | Phase 1 / Step 1.8 — Frontend authentication UI                  | Added responsive authentication pages, validated forms, refresh-aware API client, query provider, and tokenized footer.     | Not opened yet |
| 2026-11-15 | Phase 1 / Step 1.7 — Authentication tests                        | Added Vitest unit/repository/controller coverage and Supertest auth, session, and role-guard E2E coverage.                  | Not opened yet |
| 2026-11-15 | Phase 1 / Step 1.6 — Password recovery and verification          | Added hashed single-use tokens, verified-email gating, Resend/Mailpit delivery, and session revocation on reset.            | Not opened yet |
| 2026-11-15 | Phase 1 / Step 1.5 — RBAC guards                                 | Added opt-in JWT, role, permission, OWN-scope, and Redis-cached authorization infrastructure.                               | Not opened yet |
| 2026-11-15 | Phase 1 / Step 1.4 — Auth controller and DTOs                    | Added validated auth endpoints, per-IP throttling, and normalized HTTP error responses.                                     | Not opened yet |
| 2026-11-15 | Phase 1 / Step 1.3 — Authentication services                     | Added injectable auth workflows, Argon2id password hashing, JWT access tokens, and rotating hashed refresh sessions.        | Not opened yet |
| 2026-11-15 | Phase 1 / Step 1.2 — Migration and RBAC seed                     | Applied the initial auth/RBAC migration and idempotently seeded five roles, 61 permissions, and the admin user.             | Not opened yet |
| 2026-11-15 | Phase 1 / Step 1.1 — Prisma auth and RBAC schema                 | Added authentication and RBAC models, constraints, relations, and lifecycle fields.                                         | Not opened yet |
| 2026-11-15 | Phase 0 / Step 0.4 — Database schema documentation               | Drafted the planned logical model and invariants ahead of schema implementation.                                            | Not opened yet |
| 2026-11-15 | Phase 0 / Step 0.9 — Documentation scaffold                      | Added step-document templates, project logs, ADR template, PR checklist, and exported-API JSDoc linting.                    | Not opened yet |

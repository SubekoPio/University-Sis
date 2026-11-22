# School Management System: Copilot Prompt Library

Ready-to-paste prompts for every micro-phase of the roadmap. Each prompt is kept under ~250 words, states its scope, and tells Copilot what **not** to do.

> **Standing rules for every prompt:** (1) **always comment code** (file header, TSDoc on every function/class, block comments explaining why); (2) **document every step** using the step-documentation prompt that closes each phase; (3) **all UI uses the brand tokens** (`brand #312E81`, `accent #4F46E5`, `badge #0D9488`, `surface #F9FAFB`, `card #FFFFFF`, `ink #111827`, `line #E5E7EB`) and the status tokens (`success #15803D`, `warning #B45309`, `error #B91C1C`, `info #4F46E5`, `field #6B7280`, each with a soft tint) via `docs/DESIGN_SYSTEM.md`, never raw hex values; (4) **terminology**: use **intake** (never "term" or "semester"), **programme**, and **course unit**; (5) **payments**: the live process is physical (the student pays at the bank, Finance records the deposit and issues the receipt); online card, bank and mobile payments show **"Coming soon"** behind per-method feature flags (default OFF).

---

## How to Use This Library

1. **Open a new chat for every prompt.** This keeps context clean.
2. **Attach context first.** Use the `#file` references shown in each prompt (or drag the files into chat).
3. **Pick the mode listed.** _Ask_ = plan or generate for review, _Edit_ = apply changes to selected files, _Agent_ = only for well-scoped tasks once conventions are stable.
4. **Review the diff and confirm the code is commented**, run build and tests, **run the step-documentation prompt**, then commit before moving on.
5. **Replace placeholders** such as `<module>` and `<path>` with your real names.
6. To make a prompt reusable, save it as `.github/prompts/<phase>-<step>.prompt.md` with this header:

```markdown
---
mode: "edit"
description: "Phase X, Step Y: short title"
---
```

### Standard Footer (append to EVERY prompt)

```text
Rules: follow .github/copilot-instructions.md. Do not modify or regenerate existing
files unless I name them. Do not add features I did not list. If anything is unclear,
ask me before generating.
Comments (mandatory): start each file with a header comment; add a TSDoc block
(summary, @param, @returns, @throws) to every exported class/function/DTO; comment
every logical block explaining WHY; name the business rule being enforced; comment
security-sensitive code with the threat it prevents. Never remove existing comments.
```

### UI Footer (append to every frontend prompt, in addition to the standard footer)

```text
Design: read #file:docs/DESIGN_SYSTEM.md. Use ONLY the semantic Tailwind tokens:
bg-brand (#312E81, navigation rail), bg-accent (#4F46E5, primary CTAs, links, focus),
bg-badge (#0D9488, GPA and attendance badges only), bg-surface (#F9FAFB, page),
bg-card (#FFFFFF, cards), text-ink (#111827), border-line (#E5E7EB),
border-field (#6B7280, inputs). Status: success #15803D / bg-success-soft #DCFCE7,
warning #B45309 / bg-warning-soft #FEF3C7, error #B91C1C / bg-error-soft #FEE2E2,
info #4F46E5 / bg-info-soft #EEF2FF. Every status shows an icon AND a text label
(never color alone). Never hardcode hex values. One primary CTA per view. Visible focus rings.
Comment every component (props, purpose) and each major JSX section.
```

### Naming Used Below

| Placeholder            | Meaning           |
| ---------------------- | ----------------- |
| `apps/api`             | NestJS backend    |
| `apps/web`             | Next.js frontend  |
| `prisma/schema.prisma` | Prisma schema     |
| `docs/*.md`            | Context documents |

---

# Phase 0: Foundation & Copilot Setup

### 0.1 Monorepo Skeleton

**Mode:** Ask → then run commands manually

```text
Propose a monorepo structure for a school management system.

Apps:
- apps/api (NestJS, TypeScript strict)
- apps/web (Next.js App Router, Tailwind, shadcn/ui)
- packages/shared (shared types, zod schemas, constants)

Use pnpm workspaces and Turborepo.

Give me:
1. The folder tree
2. Root package.json, pnpm-workspace.yaml, turbo.json
3. Shared tsconfig base
4. The exact commands to scaffold each app

Do not write any business logic or feature code.
```

### 0.2 Docker Compose

**Mode:** Edit

```text
Create docker-compose.yml at the repo root for local development.

Services:
- PostgreSQL 16 (named volume, healthcheck)
- Redis 7 (healthcheck)
- MinIO (S3-compatible, console enabled, named volume)
- A one-shot service that creates a default bucket "school-files"

Also create .env.example with every variable these services need.
Use no hardcoded secrets. Do not create application code.
```

### 0.3 Copilot Instruction Files

**Mode:** Ask (review before saving)

```text
Draft .github/copilot-instructions.md for this project.

Include conventions:
- TypeScript strict, no `any`
- Backend layering: Controller → Service → Repository (Prisma)
- Controllers contain no business logic
- DTO validation with class-validator
- Every endpoint protected by RBAC decorators
- Money stored as integer minor units, never floats
- Terminology: use "intake" (never "term"/"semester"), "programme", "course unit"; three intakes per academic year
- Never overwrite existing files unless told
- Tests are written in a separate step
- Always read docs/RBAC_MATRIX.md and docs/DATABASE_SCHEMA.md first
- ALWAYS comment code: file headers, TSDoc on exports, block comments explaining why
- Document every step in docs/phases/ and docs/DEVELOPMENT_LOG.md
- UI uses only the semantic color tokens from docs/DESIGN_SYSTEM.md (including status colors)
- Payments: ACTIVE = physical bank deposits recorded by Finance + receipts. COMING SOON = online card/bank/mobile, each behind its own flag (payments.online.card|bank|mobile, default OFF); never enable these in code or seed data

Then draft scoped files in .github/instructions/ for backend, frontend, prisma, and tests, each with an applyTo glob.
Keep each file under 40 lines.
```

### 0.4 Context Documents

**Mode:** Ask

```text
Draft docs/RBAC_MATRIX.md for a school system.

Roles: student, lecturer, bursar (finance), registrar, admin.
Several users may hold the bursar role; permissions are checked per signed-in
user. Include finance permissions: finance:payment:record, finance:payment:void
(approver must differ from the recorder), finance:receipt:read,
finance:report:read.
Modules: auth, SIS, academic, finance, LMS, exams, reports.

Produce a table: rows = permissions (e.g. finance:payment:create),
columns = roles, cells = Y / N / OWN (own records only).

Then draft docs/ARCHITECTURE.md describing modules, their dependencies, and the
request flow (client → API → service → DB/Redis/storage).
Do not write code.
```

### 0.5 CI Pipeline

**Mode:** Edit

```text
Create .github/workflows/ci.yml.

Triggers: pull_request and push to main.
Jobs: install (pnpm cache), lint, type-check, test (with Postgres and Redis
service containers), build.
Run jobs in parallel where possible. Fail on any error.

Do not add deployment steps yet.
```

### 0.6 Quality Gates

**Mode:** Edit

```text
Set up code quality tooling at the repo root:
- ESLint (typescript-eslint, strict)
- Prettier
- Husky pre-commit running lint-staged
- commitlint with Conventional Commits

Provide config files and the package.json scripts.
Do not reformat the entire repo; only add config.
```

### 0.7 Design Tokens

**Mode:** Edit

```text
Implement the brand design tokens for apps/web.

Palette:
- brand   #312E81 Deep Indigo (navigation rail)
- accent  #4F46E5 Electric Indigo (primary CTAs, links, focus rings)
- badge   #0D9488 Teal (GPA and attendance badges only)
- surface #F9FAFB (page background)
- card    #FFFFFF (cards, tables, modals)
- ink     #111827 (text)
- line    #E5E7EB (borders)
- field   #6B7280 (input borders)

Status colors (strong for text/icons, soft for backgrounds):
- success #15803D / #DCFCE7   - warning #B45309 / #FEF3C7
- error   #B91C1C / #FEE2E2   - info    #4F46E5 / #EEF2FF

Do:
1. Add these as named colors in tailwind.config.ts.
2. Map them to shadcn/ui CSS variables in globals.css
   (background, foreground, card, primary, border, ring, sidebar).
3. Create docs/DESIGN_SYSTEM.md with a token table, usage rules, and
   contrast notes (white on teal is about 3.7:1, so use it only for large or
   bold text, or pair it with an icon and label), and the rule that every status
   uses an icon plus a text label, never color alone.
4. Add reusable <StatusBanner variant="success|warning|error|info"> and an
   <ComingSoonBadge> (info-soft background, info text, text label "Coming soon") component.
5. Add an ESLint rule or script that flags raw hex colors in components.

Comment every token with its role. Do not build any pages yet.
```

### 0.8 Documentation Scaffold

**Mode:** Edit

```text
Create the documentation scaffold.

Files:
- docs/DEVELOPMENT_LOG.md (newest-first entries: date, phase/step, summary, PR link)
- docs/CHANGELOG.md (Keep a Changelog format)
- docs/adr/0000-template.md (context, decision, alternatives, consequences)
- docs/phases/README.md explaining the step-document naming convention
- docs/phases/step-template.md with sections: Goal, What Was Built,
  Key Decisions, Business Rules, How to Run & Test, Data/Permissions Impact,
  Known Limitations, Copilot Usage
- .github/pull_request_template.md with a checklist: step doc added, log updated,
  code commented, schema/RBAC/design docs updated, tests passing

Also configure eslint-plugin-jsdoc to require doc blocks on exported functions,
classes, and methods. Add explanatory comments to every config file.
```

### Phase 0 Updates (added after the initial build)

> Phase 0 was built and run with prompts 0.1 to 0.8 above, which are **unchanged**. These follow-ups define the **role model** and bring the foundation docs, configuration and design tokens in line with later decisions. They are numbered from 0.10 so they do not clash with the roadmap table. Run them **in order: Phase 0 updates, then Phase 1 updates (1.10 to 1.16), then Phase 2**.

### 0.10 Role Model & RBAC Matrix Update

**Mode:** Ask (review before saving)
**Context:** `#file:docs/RBAC_MATRIX.md #file:docs/ARCHITECTURE.md`

```text
Redraft docs/RBAC_MATRIX.md and create docs/ROLES.md. Do not write code.

Roles (key: job):
- admin: system administrator (accounts, roles, settings, feature flags, audit
  log); NO access to grades, money or admissions decisions
- admissions_officer: enter applications, review documents
- admissions_head: admit, reject, approve study-mode and student-schedule changes
- registrar: programmes, intakes, course units, curriculum, offerings, student
  records, publish results
- bursar (Finance Officer): record bank deposits, issue receipts, confirm
  application fees
- finance_manager: fee structures, void payments, reconciliation, finance reports
- lecturer, student
- Later: hod (OWN-DEPT), dean (OWN-FACULTY), exams_officer,
  communications_officer, support_desk, auditor (read-only)

Matrix: rows = permissions named module:resource:action, columns = roles, cells =
Y / N / OWN / OWN-DEPT / OWN-FACULTY. Users may hold several roles; permissions
are the union; deny by default; code checks permissions, never role names.

Add a "Separation of duties" section: the recorder of a payment cannot void it;
the document reviewer cannot be the admitting user; granting admin needs a second
admin; lecturers enter marks, HOD or exams officer moderates, registrar publishes.
In docs/ROLES.md give each role's purpose, first phase needed, and expected
account counts for a small, medium and large institution.
```

### 0.11 Copilot Instructions Update

**Mode:** Ask (review before saving)
**Context:** `#file:.github/copilot-instructions.md #file:.github/instructions`

```text
Update our Copilot instruction files. Show the diff before saving, do not remove
existing rules, and keep each file under 60 lines.

Add these rules:
- Terminology: "intake" (never "term" or "semester"), "programme", "course unit";
  three intakes per academic year
- No public sign-up: accounts are created by admins; students are admitted
- Authorization: check permissions with @Permissions, never role names; deny by
  default; follow docs/RBAC_MATRIX.md and its separation-of-duties rules
- Payments: ACTIVE = physical bank deposits recorded by Finance, with receipts;
  COMING SOON = online card/bank/mobile behind payments.online.* flags (default
  OFF, never enabled in code or seed data)
- Online attendance: PRESENT only for a continuous stay of at least the
  configured share of the session; on-and-off time is never added up
- Never return meeting URLs in list or detail responses
- Comments and docs: file header, TSDoc on exports, why-comments, and a step
  document after each micro-phase
- UI: only the semantic color tokens, including status colors; status is never
  shown by color alone
```

### 0.12 Design Tokens Update

**Mode:** Edit
**Context:** `#file:docs/DESIGN_SYSTEM.md #file:apps/web/tailwind.config.ts`

```text
Extend the existing design tokens. Do not change the existing ones.

Add (strong for text and icons, soft for backgrounds):
- field   #6B7280 (input borders)
- success #15803D / #DCFCE7
- warning #B45309 / #FEF3C7
- error   #B91C1C / #FEE2E2
- info    #4F46E5 / #EEF2FF

Do:
1. Add them to tailwind.config.ts and globals.css (map error to shadcn's
   destructive variable), with a comment on each token's role.
2. Update docs/DESIGN_SYSTEM.md: status rules (icon plus text label, never color
   alone), a contrast table, "teal is reserved for GPA and attendance", and the
   "Coming soon" badge rule (info-soft background, info text).
3. Add <StatusBanner variant="success|warning|error|info"> and <ComingSoonBadge>.
4. Extend the raw-hex lint rule to cover the new tokens.
```

### 0.13 Environment & Config Update

**Mode:** Edit

```text
Add the new configuration, validated at startup. Do not change existing variables.

Add to .env.example (a comment on every line) and to the typed config module
(zod; fail fast when a required value is missing):
- APP_URL (login URL used in emails), EMAIL_FROM, RESEND_API_KEY
- TEMP_PASSWORD_TTL_DAYS=7
- WEBSITE_INTEGRATION_SECRET (signs requests from the university website to the
  admissions endpoint)
- MEETING_ALLOWED_HOSTS (hosts allowed in meeting links)
- ATTENDANCE_MIN_CONTINUOUS_PERCENT=75, ATTENDANCE_RECONNECT_GRACE_SECONDS=180,
  ATTENDANCE_WARNING_PERCENT=75
- APPLICATION_FEE_AMOUNT_MINOR and CURRENCY
- SCHOOL_NAME, SCHOOL_LOGO_KEY
- FEATURE_ONLINE_CARD_ENABLED, FEATURE_ONLINE_BANK_ENABLED,
  FEATURE_ONLINE_MOBILE_ENABLED, all false (seed values only)

Never commit real secrets. Add a short README section describing each variable.
```

### 0.14 Governance & Docs Scaffold Update

**Mode:** Edit

```text
Add governance and documentation scaffolding. Comment every file.

1. .github/CODEOWNERS: require a named reviewer for auth, RBAC, finance,
   admissions and prisma/migrations (use placeholder team handles).
2. Update .github/pull_request_template.md with: roles or permissions changed?
   docs/RBAC_MATRIX.md updated? separation of duties preserved? code commented?
   step document added? design tokens only?
3. Create docs/runbooks/README.md and docs/ACCESS_REVIEW.md (a template to run
   every intake: each staff account, its roles, who confirmed it, what was
   removed).
4. Add a small CI script that fails when a permission used in a @Permissions
   decorator is missing from docs/RBAC_MATRIX.md.
```

### 0.15 Update the Phase 0 Documentation

**Mode:** Ask

```text
Document the Phase 0 updates (0.10 to 0.14) using #file:docs/phases/step-template.md.

Do NOT edit the existing step documents for 0.1 to 0.8. Create
docs/phases/phase-0/step-0.10-<name>.md through step-0.14-<name>.md.

Then:
1. Append one entry per step to docs/DEVELOPMENT_LOG.md (newest first).
2. Draft an ADR in docs/adr/: the role model, permission-based checks, and the
   separation-of-duties rules.
3. List out-of-date sections in docs/ARCHITECTURE.md and docs/DESIGN_SYSTEM.md.

Base everything on the actual code in #codebase. Do not modify source code.
```

---

# Phase 1: Authentication & RBAC

### 1.1 Prisma Schema

**Mode:** Ask
**Context:** `#file:docs/RBAC_MATRIX.md #file:prisma/schema.prisma`

```text
Add Prisma models for authentication and RBAC.

Models:
- User, Role, Permission, UserRole, RolePermission
- Session (refresh token hash, user agent, ip, expiresAt, revokedAt)
- PasswordResetToken (token hash, expiresAt, usedAt)
- EmailVerificationToken (token hash, expiresAt, usedAt)

Include:
- Relations with explicit onDelete behavior
- Indexes on lookup fields (email, token hash, userId)
- Enums (e.g. UserStatus)
- createdAt / updatedAt on every model
- Unique constraints where appropriate

Do NOT generate APIs, services, or seed data.
Do not modify existing models.
```

### 1.2 Migration & Seed

**Mode:** Edit

```text
Write a Prisma seed script (prisma/seed.ts) that:
- Creates the roles: student, lecturer, bursar, registrar, admin
- Creates permissions listed in docs/RBAC_MATRIX.md
- Links them per the matrix
- Creates one admin user with a password from an env variable

Make it idempotent (safe to run twice). Use upsert.
Also give me the commands to migrate and seed.
```

### 1.3 Auth Services

**Mode:** Edit
**Context:** `#file:prisma/schema.prisma`

```text
Create the NestJS auth module services in apps/api/src/auth.

Services:
- login (verify password, issue access + refresh tokens, create Session)
- register
- refreshToken (rotate refresh token, revoke old session, detect reuse)
- logout (revoke session)
- password hashing with argon2
- JWT generation (short-lived access token, hashed refresh token stored)

Use dependency injection and a UsersService.
Do NOT create controllers, guards, or frontend code.
Read secrets from ConfigService, never hardcode.
```

### 1.4 Auth Controllers & DTOs

**Mode:** Edit

```text
Create AuthController and DTOs for the existing AuthService.

Endpoints: POST /auth/login, /auth/register, /auth/refresh, /auth/logout.
Use class-validator on every DTO. Return consistent error shapes.
Add rate limiting (ThrottlerModule) on login and register.
Controllers must only call services. Do not alter AuthService.
```

### 1.5 RBAC Guards

**Mode:** Edit
**Context:** `#file:docs/RBAC_MATRIX.md`

```text
Create RBAC infrastructure in apps/api/src/common/rbac.

Include:
- @Roles() and @Permissions() decorators
- JwtAuthGuard
- RolesGuard
- PermissionsGuard (resolves permissions from the user's roles, cached in Redis)
- @CurrentUser() decorator
- Support for an "OWN" scope check helper (resource owner = current user)

Deny by default. Do not apply guards to any existing controller yet.
Do not generate tests in this step.
```

### 1.6 Password Recovery & Email Verification

**Mode:** Edit

```text
Add password recovery and email verification to apps/api/src/auth.

Features:
- POST /auth/forgot-password (always returns 200 to avoid user enumeration)
- POST /auth/reset-password (single-use, expiring token, revoke all sessions)
- POST /auth/verify-email
- POST /auth/resend-verification (rate limited)
- Store only token hashes; 1h expiry for reset, 24h for verification

Send emails through the Resend SDK behind an EmailService interface.
Use simple HTML email templates. Do not touch the frontend.
```

### 1.7 Auth Tests

**Mode:** Edit

```text
Write tests for the auth module only.

Unit tests (Jest): AuthService login success/failure, refresh rotation,
reuse detection, token expiry, password reset single-use.
E2E tests (supertest): login, refresh, logout, protected route 401/403,
role-restricted route.

Mock EmailService. Do not change production code; if you find a bug,
list it instead of fixing it.
```

### 1.8 Frontend Auth UI

**Mode:** Edit

```text
Create Next.js authentication pages in apps/web.

Pages: /login, /forgot-password, /reset-password, /verify-email.

Use shadcn/ui, React Hook Form with zod validation, and TanStack Query.
Create an API client module that attaches the access token and handles
refresh-on-401 once.
Include loading, error, and success states, and be mobile responsive.
Do not modify backend code.

Also apply the UI Footer: use only brand tokens from #file:docs/DESIGN_SYSTEM.md.
Comment every component and major JSX section.
```

### 1.9 Document the Phase

**Mode:** Ask

```text
Write the step documents for Phase 1 using #file:docs/phases/step-template.md.

For each completed step (1.1 to 1.8), create
docs/phases/phase-1/step-1.<n>-<name>.md covering: goal, files created or
changed (paths), key decisions and trade-offs, business rules implemented,
how to run and test (exact commands), data and permissions impact, known
limitations, and Copilot usage notes.

Then:
1. Append one entry per step to docs/DEVELOPMENT_LOG.md (newest first).
2. List any decision that deserves an ADR and draft it in docs/adr/.
3. List out-of-date sections in docs/DATABASE_SCHEMA.md and docs/RBAC_MATRIX.md.

Base everything on the actual code in #codebase. Do not invent features. Do not
modify source code in this step.
```

### Phase 1 Updates (added after the initial build)

> Phase 1 was built and run with prompts 1.1 to 1.9 above, which are **unchanged**. The admissions model means **students never sign themselves up**: admins create every account and the system emails default login details. These follow-up prompts adjust the finished auth module. Run them **in order, before Phase 2**.

### 1.10 Auth Schema Changes

**Mode:** Edit
**Context:** `#file:prisma/schema.prisma`

```text
Students never sign themselves up; admins create accounts. Extend the existing
User model only.

Add to User:
- mustChangePassword Boolean default false
- temporaryPasswordExpiresAt DateTime?
- createdById String? (the admin who created the account, relation to User)
- deactivatedAt DateTime? and deactivatedById String?
Make sure UserStatus has a DEACTIVATED value (add it if missing).

Existing users keep mustChangePassword = false. Add indexes where needed and
/// comments. Give me the migration command.
Do not change other models. Do not generate services or APIs in this step.
```

### 1.11 Admin User Services

**Mode:** Edit
**Context:** `#file:prisma/schema.prisma #file:docs/RBAC_MATRIX.md`

```text
Create AdminUsersService in apps/api/src/users (services only, no controllers).

Methods:
- createUser(dto, adminId): email, name, roleIds. Generate a cryptographically
  random temporary password (12+ characters, no predictable pattern), hash it
  with argon2, set mustChangePassword = true, temporaryPasswordExpiresAt
  (configurable, default 7 days) and createdById. Email the login URL and
  credentials through EmailService (Resend template).
- resendCredentials(userId, adminId): new temporary password, revoke all sessions
- updateRoles(userId, roleIds, adminId): add or remove roles with an audit entry
- deactivateUser / reactivateUser (reason required): revoke all sessions on
  deactivation
- listUsers(filters): search, role, status, pagination

Rules: never log or store the plain password; send it only in the email; a
failed email must not roll back user creation (record it and allow resend); an
admin cannot deactivate themselves or remove their own admin role.
Add the permission admin:user:manage (admin only) to docs/RBAC_MATRIX.md and the
seed, idempotently.
```

### 1.12 Login Gating & Change Password

**Mode:** Edit
**Context:** `#file:apps/api/src/auth`

```text
Update the existing auth module. Modify ONLY the auth service, auth controller and
their DTOs, and list every file you change.

1. Disable the public POST /auth/register: return 404 and remove its route. Keep
   the underlying logic internal for AdminUsersService.
2. Login: when mustChangePassword is true, the session may call ONLY
   POST /auth/change-password and logout; every other endpoint returns 403 with
   code MUST_CHANGE_PASSWORD. Reject an expired temporary password with a message
   to contact an administrator.
3. POST /auth/change-password: requires the current (temporary) password,
   validates the password policy, rejects reuse of the temporary password, clears
   mustChangePassword, marks the email as verified, and revokes all other sessions.
Rate limit the endpoint. Comment every change.
```

### 1.13 Admin User Controllers

**Mode:** Edit

```text
Create AdminUsersController and DTOs for the existing AdminUsersService.

Endpoints: POST /admin/users, GET /admin/users,
POST /admin/users/:id/resend-credentials, PATCH /admin/users/:id/roles,
POST /admin/users/:id/deactivate, POST /admin/users/:id/reactivate.

Guard all of them with the JWT guard and @Permissions('admin:user:manage').
Use class-validator DTOs, Swagger docs, and a rate limit on resend.
Controllers only call the service. Do not modify the service.
```

### 1.14 Update Auth Tests

**Mode:** Edit

```text
Add tests for the Phase 1 updates. Do not edit existing auth tests unless one
fails because register is now disabled, and list any such change.

Unit: createUser (random password, mustChangePassword set, email sent, email
failure does not roll back), resendCredentials revokes sessions, deactivation
revokes sessions, an admin cannot deactivate themselves, expired temporary
password rejected.
E2E: POST /auth/register returns 404; a first login with a temporary password
allows only change-password and logout (403 MUST_CHANGE_PASSWORD elsewhere); after
change-password normal access works and old sessions are revoked; a non-admin
gets 403 on /admin/users; an admin can create, list, change roles and deactivate.

Do not change production code; list bugs instead.
```

### 1.15 Frontend Auth Updates

**Mode:** Edit

```text
Update the existing apps/web auth pages. Modify only the files you list.

1. Remove any public "Register" or "Sign up" page, link and route.
2. Add /change-password: current (temporary) password, new password with the
   policy hints, and confirmation. Show it automatically when the API returns
   MUST_CHANGE_PASSWORD or login reports mustChangePassword. After success,
   continue into the app.
3. Show a clear message when the temporary password has expired, telling the user
   to contact an administrator.

Use shadcn/ui, React Hook Form with zod, TanStack Query and the existing API
client. Do not modify backend code.

Also apply the UI Footer: use only brand tokens from #file:docs/DESIGN_SYSTEM.md.
Comment every component and major JSX section.
```

### 1.16 Update the Phase 1 Documentation

**Mode:** Ask

```text
Document the Phase 1 updates (1.10 to 1.15) using #file:docs/phases/step-template.md.

Do NOT edit the existing step documents for 1.1 to 1.9. Create
docs/phases/phase-1/step-1.10-<name>.md through step-1.15-<name>.md.

Then:
1. Append one entry per step to docs/DEVELOPMENT_LOG.md (newest first).
2. Draft an ADR in docs/adr/: admin-created accounts with temporary credentials,
   forced change at first login, and no public sign-up.
3. List out-of-date sections in docs/DATABASE_SCHEMA.md and docs/RBAC_MATRIX.md.

Base everything on the actual code in #codebase. Do not modify source code.
```

---

# Phase 2: Core Academic & Student Information System

> **Status:** Phase 1 (auth and RBAC) is complete. Run the Phase 1 updates (1.10 to 1.16) first; admissions depends on them. Phase 2 builds on the existing models and changes only one Phase 1 file: the login flow, which gains a role-based redirect in step 2.18.
>
> **Domain model (use these words everywhere):** Application → Admission → Student. Faculty → Department → Programme (e.g. BSc Computer Science) → curriculum of **Course Units** → **Course Unit Offering** (one per unit per **intake**, with lecturer(s)) → class sessions → attendance.
> **Intakes:** three per academic year (default January, May, September; configuration). Never use "term" or "semester".
> **Students never sign themselves up.** Applicants apply through the university website (a separate site) or the admission office; admins review documents, confirm the application fee, admit them with a **study mode (ONLINE or PHYSICAL)** and a **student schedule (DAY, EVENING, WEEKEND, or DISTANCE)**, and the system emails default login details. Each shared offering independently specifies delivery as PHYSICAL, ONLINE, or HYBRID. The programme's course units load automatically; the student selects them on the **Course Units** page.
> **Online attendance:** a student is PRESENT only if their longest **continuous** time in the lecture (reconnects up to a short grace merged) reaches the minimum share of the session; on-and-off time is never added up.

### 2.0 Domain Docs & Instructions

**Mode:** Ask (review before saving)
**Context:** `#file:.github/copilot-instructions.md #file:docs/DATABASE_SCHEMA.md #file:docs/RBAC_MATRIX.md`

```text
Update our docs for the academic domain model. Do not write code.

1. Draft docs/ACADEMIC_MODEL.md explaining:
   - Hierarchy: Faculty > Department > Programme > Curriculum > CourseUnit >
     Offering > ClassSession > Attendance
   - Three intakes per academic year (configurable names and dates)
   - Core, elective, retake and general (shared) course units
   - One offering per unit per intake; students from any eligible programme share it
   - Admissions: apply (website or office) > document review > application fee
     confirmed > admit (with study mode and student schedule) > default login emailed > units auto-loaded
   - Student schedule DAY, EVENING, WEEKEND, or DISTANCE, separate from each
     offering's PHYSICAL, ONLINE, or HYBRID delivery
   - The continuous-time online attendance rule and its configurable numbers
2. Propose additions to .github/copilot-instructions.md: terminology (intake,
   programme, course unit), "no public sign-up", and the attendance rule.
3. List the new Phase 2 permissions for each role in docs/RBAC_MATRIX.md (admin,
   admissions_officer, admissions_head, registrar, bursar, lecturer, student).
4. List existing docs or prompts that still say "term", "semester" or
   "register" in the sign-up sense.
```

### 2.1 Academic Structure Schema

**Mode:** Ask
**Context:** `#file:prisma/schema.prisma #file:docs/ACADEMIC_MODEL.md`

```text
Add Prisma models for the academic structure.

Models:
- Faculty (code, name)
- Department (facultyId, code, name)
- Programme (departmentId, code, name, awardLevel enum, durationYears)
- AcademicYear (label e.g. "2026", startDate, endDate)
- Intake (academicYearId, sequence 1..3, name, startDate, endDate,
  selectionOpensAt, selectionClosesAt, status enum: UPCOMING, SELECTION_OPEN,
  ACTIVE, CLOSED)

Constraints: unique (academicYearId, sequence); sequence limited to 1..3;
unique codes; sensible onDelete behavior; indexes; timestamps.
Intake names are data, not enums. Add /// doc comments on every model and field.

Do NOT generate APIs. Do not modify auth models. Never name anything Term or Semester.
```

### 2.2 Course Unit & Curriculum Schema

**Mode:** Ask
**Context:** `#file:prisma/schema.prisma #file:docs/ACADEMIC_MODEL.md`

```text
Add Prisma models for course units, curriculum and offerings.

Models:
- CourseUnit (code unique, name, creditUnits, level, ownerDepartmentId,
  isGeneral Boolean, openToAllFaculties Boolean, status)
- CourseUnitFacultyEligibility (courseUnitId, facultyId)
- ProgrammeCourseUnit (programmeId, courseUnitId, studyYear, intakeSlot 1..3,
  type enum CORE | ELECTIVE); unique (programmeId, courseUnitId)
- ProgrammeElectiveRule (programmeId, studyYear, intakeSlot, minCredits,
  maxCredits)
- CourseUnitPrerequisite (courseUnitId, prerequisiteId)
- CourseUnitOffering (courseUnitId, intakeId, capacity nullable, status,
  deliveryMode PHYSICAL | ONLINE | HYBRID);
  UNIQUE (courseUnitId, intakeId): ONE offering per unit per intake, shared
  by all programmes

Add indexes, enums, timestamps and /// comments. Do NOT generate APIs.
```

### 2.3 Student, Lecturer & Enrollment Schema

**Mode:** Ask
**Context:** `#file:prisma/schema.prisma`

```text
Add Prisma models for students, lecturers and course unit selection.

Models:
- Student (userId one-to-one, studentNumber unique, phone String?,
  dateOfBirth DateTime? @db.Date, gender String?, nationality String?,
  nationalId String? unique, address String?, nextOfKinName String?,
  nextOfKinPhone String?, nextOfKinRelationship String?,
  schedule enum DAY | EVENING | WEEKEND | DISTANCE)
- Lecturer (userId one-to-one, departmentId, staffNumber unique)
- OfferingLecturer (offeringId, lecturerId, role enum PRIMARY | ASSISTANT)
- ProgrammeEnrollment (studentId, programmeId, admissionIntakeId,
  currentStudyYear, currentIntakeSlot 1..3, status enum ACTIVE | DEFERRED |
  COMPLETED | WITHDRAWN); history preserved, no destructive updates
- IntakeRegistration (studentId, intakeId, status enum PENDING | REGISTERED |
  DEFERRED | WITHDRAWN | SUSPENDED | COMPLETED); unique (studentId, intakeId)
- UnitRegistration (studentId, offeringId, intakeId, status SELECTED | DROPPED |
  COMPLETED, isRetake, selectedAt); unique (studentId, offeringId)

Student schedule is independent of CourseUnitOffering.deliveryMode
(PHYSICAL | ONLINE | HYBRID). Do not put programmeId or admissionYear on
Student; programme and admission intake belong to ProgrammeEnrollment.
Record student-schedule and offering-delivery changes in the existing AuditLog.
Keep ProgrammeEnrollment history and do not destructively update or delete it.

Add indexes, enums, timestamps and /// comments. Do NOT generate APIs.
Do not change auth data or behavior; add only inverse Student/Lecturer relation
fields on User as required for Prisma one-to-one relations.
```

### 2.4 Admissions Schema

**Mode:** Ask
**Context:** `#file:prisma/schema.prisma`

```text
Add Prisma models for admissions.

Models:
- Application (applicant name, email, phone, dateOfBirth, nationality,
  desiredProgrammeId, desiredIntakeId, studyMode ONLINE | PHYSICAL,
  schedule DAY | EVENING | WEEKEND | DISTANCE, source WEBSITE | ADMISSION_OFFICE,
  externalRef nullable unique (the website's application id), status enum SUBMITTED |
  UNDER_REVIEW | DOCS_APPROVED |
  DOCS_REJECTED | FEE_CONFIRMED | ADMITTED | REJECTED | WITHDRAWN,
  enteredById nullable, admittedById nullable, admittedAt nullable,
  studentId nullable)
- ApplicationDocument (applicationId, type enum ID | TRANSCRIPT | CERTIFICATE |
  PHOTO | OTHER, storageKey, status PENDING | APPROVED | REJECTED,
  reviewerNote nullable, reviewedById nullable, reviewedAt nullable)
- ApplicationFeeRecord (applicationId, amountMinor Int, currency ISO 4217
  three-letter code, bankName, bankReference, depositDate, recordedById,
  status RECORDED | VOIDED, voidedAt nullable, voidedById nullable,
  voidReason nullable and required when voided); unique (bankName, bankReference)
- AdmissionRecord (applicationId unique, studentId, programmeId,
  admissionIntakeId, studyMode, schedule, admittedById, admittedAt)

Add indexes, enums, timestamps and /// comments. Do NOT generate APIs.
```

### 2.5 Sessions & Attendance Schema

**Mode:** Ask
**Context:** `#file:prisma/schema.prisma`

```text
Add Prisma models for class sessions and attendance.

Models:
- TimetableSlot (offeringId, dayOfWeek enum MONDAY | TUESDAY | WEDNESDAY |
  THURSDAY | FRIDAY | SATURDAY | SUNDAY, startTime and endTime as local SQL
  TIME values, room nullable, deliveryMode PHYSICAL | ONLINE | HYBRID,
  defaultMeetingUrl nullable)
- ClassSession (offeringId, slotId nullable, startsAt, endsAt, deliveryMode,
  room nullable, meetingUrl nullable, meetingProvider nullable String
  (provider key; do not define provider values before selection),
  externalMeetingId nullable, status SCHEDULED | HELD | CANCELLED)
- SessionJoin (sessionId, studentId, clickedAt): log of Attend clicks
- PresenceInterval (sessionId, studentId, joinedAt, leftAt, source
  PROVIDER_WEBHOOK | REPORT_IMPORT | MANUAL)
- AttendanceRecord (sessionId, studentId, status PRESENT | ABSENT,
  method ONLINE_PRESENCE | LECTURER_MARKED, longestContinuousSeconds,
  totalSeconds, computedAt, overriddenById nullable, overrideReason nullable);
  unique (sessionId, studentId)
- AttendanceRule (global singleton id=1; minContinuousPercent default 75,
  reconnectGraceSeconds default 180, minAttendancePercentWarning default 75)

The AttendanceRule applies to all sessions. Merge reconnect gaps only within
reconnectGraceSeconds; mark PRESENT online only when the longest continuous
interval reaches minContinuousPercent of the session. Never add interrupted
intervals together. Meeting URLs must not appear in list or detail responses.

Add indexes, enums, timestamps, sensible onDelete behavior and /// comments.
Do NOT generate APIs.
```

### 2.6 Announcements & Calendar Schema

**Mode:** Ask
**Context:** `#file:prisma/schema.prisma`

```text
Add Prisma models for announcements and the academic calendar.

Models:
- Announcement (title, body, imageKey nullable, category enum GENERAL |
  ACADEMIC | FINANCE | EXAM | EVENT, status DRAFT | PUBLISHED | ARCHIVED,
  isPinned, sortOrder, publishAt, expiresAt nullable, createdById)
- AnnouncementAudience (announcementId, audienceType enum ALL_STUDENTS |
  ALL_LECTURERS | ROLE | FACULTY | PROGRAMME | INTAKE | COURSE_UNIT_OFFERING,
  targetId nullable)
- CalendarEvent (title, description, type enum HOLIDAY | ACADEMIC | EVENT,
  startsAt, endsAt, allDay, createdById)
- CalendarEventAudience (same shape as AnnouncementAudience)

Index (status, publishAt, expiresAt). Intake dates and class sessions are
DERIVED in the calendar, not stored as events. Add /// comments.
Do NOT generate APIs.
```

### 2.7 Migration, RBAC & Seed

**Mode:** Edit
**Context:** `#file:docs/RBAC_MATRIX.md #file:prisma/seed.ts`

```text
1. Give me the commands to migrate.
2. Seed the roles admissions_officer and admissions_head (idempotent; keep the
   existing roles) and add the Phase 2 permissions to docs/RBAC_MATRIX.md and the
   seed, exactly as the matrix defines them:
   admissions:application:manage, admissions:document:review (admissions_officer
   and admissions_head); admissions:admit, admissions:reject,
   admissions:study-mode:change (study-mode and student-schedule changes;
   admissions_head);
   admissions:fee:confirm
   (bursar); academic:structure:manage, academic:curriculum:manage,
   academic:offering:manage, academic:offering:assign-lecturer,
   academic:session:manage (registrar; lecturer OWN for sessions);
   academic:unit:select, academic:session:attend (student OWN);
   academic:classlist:read, attendance:review, attendance:override (lecturer
   OWN); announcements:manage, calendar:event:manage (registrar);
   announcements:post-own (lecturer OWN offerings).
   admin:user:manage already exists from Phase 1 update 1.11. Do NOT give admin
   any admissions, academic or finance permission.
3. Extend prisma/seed.ts with development-only sample data (skip when
   NODE_ENV=production; idempotent; keep existing sections):
   - 1 academic year, 3 intakes (January, May, September)
   - Faculties: Science & Technology, Health Sciences, Law, Business
   - Programmes: BSc Computer Science, BSc Nursing, LLB Law, BBA Business
   - About 14 course units incl. 3 GENERAL units with eligible faculties
   - Curriculum with CORE and ELECTIVE units per study year/intake slot
   - Offerings with lecturers; timetable slots; sessions (physical, online with
     a placeholder meeting URL, hybrid)
   - 5 lecturers; 20 students (mixed ONLINE and PHYSICAL)
   - Sample applications in different statuses
   - Default AttendanceRule; announcements and calendar events
```

### 2.8 Academic Structure Services

**Mode:** Edit

```text
Create apps/api/src/academic services: FacultiesService, DepartmentsService,
ProgrammesService, AcademicYearsService, IntakesService.

Rules:
- createAcademicYear creates its THREE intakes (sequence 1..3) in one
  transaction; intakes cannot overlap; a year cannot have more than three
- The selection window must close before the intake's end date
- Intake status transitions: UPCOMING > SELECTION_OPEN > ACTIVE > CLOSED
- Soft delete where records are referenced

Services and repositories only. No controllers or guards yet.
```

### 2.9 Course Unit & Curriculum Services

**Mode:** Edit

```text
Create CourseUnitsService, CurriculumService and OfferingsService.

CourseUnitsService: CRUD; mark a unit general; set eligible faculties or
openToAllFaculties.
CurriculumService: set the course units for a programme by studyYear +
intakeSlot as CORE or ELECTIVE; elective min/max credits; prerequisites with
cycle rejection.
OfferingsService: ONE offering per unit per intake (reject duplicates);
bulk-create offerings for an intake from the curriculum; capacity; assign,
replace and remove lecturers (PRIMARY and ASSISTANT); copy offerings and
lecturers from the previous intake.

Services only. No controllers yet.
```

### 2.10 Admissions Services

**Mode:** Edit
**Context:** `#file:prisma/schema.prisma`

```text
Create apps/api/src/admissions services.

ApplicationsService: create (staff entry at the admission office, or from the
website), update, withdraw.
DocumentReviewService: approve or reject each document with a note; when all
required documents are approved the application becomes DOCS_APPROVED.
ApplicationFeeService: record the fee (bank, reference, amount, date), reject a
duplicate (bank, reference); FEE_CONFIRMED when the amount meets the configured
application fee; void with reason (never delete).
AdmissionService.admit(applicationId, adminId, studyMode, schedule): allowed ONLY if
documents are approved AND the fee is confirmed, otherwise a typed error. The
admitting user (admissions:admit) must differ from the user who approved the
documents. In one
transaction: create the User (student role, via AdminUsersService), Student,
AdmissionRecord (including study mode and schedule), ProgrammeEnrollment and
IntakeRegistration. Store the student's schedule on Student, not
ProgrammeEnrollment; keep study mode on Application and AdmissionRecord.
Send the credentials email AFTER the commit; an email failure must not undo the
admission (record it and allow resend). The programme's course units for the
student's first study year and intake slot then appear as prompted units.

Also a secured website intake: POST /integrations/applications guarded by an API
key or HMAC signature, rate limited, idempotent by externalRef.
Services and that one endpoint only.
```

### 2.11 SIS Services

**Mode:** Edit

```text
Create StudentsService, ProgrammeEnrollmentService and LecturersService.

Features:
- Student CRUD (soft delete), search, pagination, unique student numbers
- Enrollment history preserved; defer, withdraw, complete
- Study-mode and student-schedule changes are approved by admissions_head and
  recorded in AuditLog; offering delivery-mode changes are also audited.
- Progression: advance currentStudyYear and currentIntakeSlot after an intake
  completes
- Lecturer profiles linked to a department

Use Prisma transactions where several writes happen. Services only.
```

### 2.12 Course Unit Selection Logic (Prompted Units)

**Mode:** Edit

```text
Create UnitSelectionService in apps/api/src/academic.

getPromptedUnits(studentId, intakeId) returns:
- core: CORE units for the student's programme at their study year and intake
  slot (pre-selected, compulsory)
- electives: ELECTIVE units for that slot, with the min/max credit rule
- retakes: units the student failed or missed earlier (isRetake)
- generalUnits: general units open to the student's faculty
Each item includes the offering, primary lecturer, seats left and sessions.

selectUnits(studentId, intakeId, offeringIds) validates:
- Selection window open; programme or faculty eligibility; prerequisites passed
- Capacity; timetable clashes; credit load limits; core units included;
  elective min/max met; no duplicates
Return typed error reasons. One transaction. Also dropUnit (before the deadline)
and admin override with audit log. Service only.
```

### 2.13 Class Sessions & Online Meeting Services

**Mode:** Edit

```text
Create TimetableService, SessionService and AttendService.

TimetableService: manage slots; generateSessions for an offering or intake
from its slots across the intake dates, skipping HOLIDAY calendar events;
detect room and lecturer clashes (a lecturer teaching shared offerings must not
double-book); a student's weekly schedule.
SessionService: set a meeting link per session (https only, host allow-list from
config), cancel, reschedule.
AttendService.attend(studentId, sessionId): student must have selected the
offering; the offering deliveryMode must be ONLINE or HYBRID;
the session must have a link and be within [start minus 10 minutes, end];
log a SessionJoin; return { meetingUrl } using MeetingProvider.getJoinUrl.

Define a MeetingProvider interface (getJoinUrl, optional fetchPresence) and a
ManualLinkProvider that returns the stored link. NEVER include meetingUrl in
list or detail responses; only attend() returns it.
Services only.
```

### 2.14 Attendance Engine

**Mode:** Edit

```text
Create AttendanceService.

Pure function computeContinuousPresence(intervals, session, rule): clip to the
session window, merge intervals whose gaps are at most reconnectGraceSeconds,
take the LONGEST merged interval, PRESENT only if it is at least
minContinuousPercent of the session length. Separate short visits are NEVER
added together (on-and-off does not count). Unit test this function heavily.

Service features:
- importPresenceReport(sessionId, csv): parse the meeting tool's attendance report
  (email, join, leave), match students by email, list unmatched rows
- ingestPresenceEvents(sessionId, events): interface for a future provider adapter
- computeSessionAttendance(sessionId): idempotent; run by a job after the
  session ends
- Physical sessions: lecturer marks present/absent (bulk and per student)
- Lecturer override with a written reason (audit)
- Percentages: per student per offering (PRESENT / sessions HELD) and overall per
  intake, with a below-minimum flag from AttendanceRule
Service only.
```

### 2.15 Announcements, Calendar & Home Services

**Mode:** Edit

```text
Create AnnouncementsService, CalendarService and HomeService.

AnnouncementsService: create, update, publish, archive; getForUser(userId, limit)
returns published, unexpired announcements matching the user's audience
(student: all students, faculty, programme, intake, selected offerings;
lecturer: all lecturers, own offerings), pinned first then newest. Lecturers may
post only to their own offerings. Sanitize the body on the server (no scripts)
and store images via StorageService.
CalendarService with a CalendarEventProvider interface and registry:
getEvents(userId, from, to, max 62 days) merges calendar events by audience,
intake milestones, class sessions of the user's selected or taught offerings,
and events from registered providers (assignments in Phase 4, exams in Phase 5).
HomeService: getStudentHome, getLecturerHome, getRegistrarHome in ONE call each.
Student: profile summary (name, photo, programme, intake, schedule), up to 5
announcements, current-month events, selected course units each with next
session { startsAt, deliveryMode, canAttend } (no meeting URL), attendance
summary (overall, per unit, below-minimum flag). Cache per user in Redis for
60 seconds with invalidation on selection and attendance changes.
Services only.
```

### 2.16 Controllers & RBAC

**Mode:** Edit
**Context:** `#file:docs/RBAC_MATRIX.md`

```text
Create controllers and DTOs for every Phase 2 service.

Apply @Roles/@Permissions exactly per RBAC_MATRIX.md:
- Admin: staff users only (the Phase 1 endpoints); no admissions, academic or
  finance endpoints
- Admissions officer: applications and document review; admissions head: admit,
  reject, student schedule change
- Bursar: confirm application fees (void authority arrives with finance_manager
  in Phase 3)
- Registrar: structure, curriculum, offerings, lecturers, sessions,
  announcements, calendar
- Lecturer (OWN offerings only): class lists, sessions and links, attendance
  review, override, report upload, own announcements
- Student (OWN only): prompted units, select/drop, timetable, POST
  /sessions/:id/attend, attendance, announcements, calendar, GET /me/home

Use class-validator DTOs, pagination DTO and Swagger decorators.
Do not modify the services.
```

### 2.17 Tests

**Mode:** Edit

```text
Write tests for the Phase 2 services.

Cover: admit rejected without approved documents or without a confirmed fee;
admit creates user, student, enrollment, and emails credentials; email failure
does not undo admission; three
intakes per year; one offering per unit per intake; prompted units for a
Computer Science student; a Law student can select a general unit but not a
Computer Science only unit; shared offering class lists; closed selection window;
prerequisite, capacity, clash and credit rules; Attend rules (physical student
refused, outside time window refused, link never in list responses);
computeContinuousPresence (one long stay present; two short visits that add up
but are not continuous absent; reconnect within grace present); lecturer sees
only own class lists; announcement audience matching; home data.

Do not change production code; list bugs instead.
```

### 2.18 App Shell & Navigation Rails

**Mode:** Edit
**Context:** `#file:docs/DESIGN_SYSTEM.md`

```text
Create the shared app shell in apps/web (no page content yet).

- AppShell with a NavigationRail (bg brand, white icons and labels, active item
  with translucent white overlay and aria-current, collapsible to icons with
  tooltips, grouped sections) and a TopBar (current intake label, profile avatar
  menu with Profile, Settings, Sign out and a role switcher for multi-role users)
- Mobile: the rail becomes a slide-over drawer
- nav.config.ts: items per role {label, icon (lucide-react), href, permission,
  enabled}; enabled:false items are not shown. Phase 2 items:
  Student: Home, My Programme, Course Units, Timetable, Attendance, Announcements
  Lecturer: Home, My Course Units, Class Sessions, Attendance, Announcements
  Registrar: Home, Faculties & Departments, Programmes, Intakes, Course Units,
  Curriculum, Offerings & Lecturers, Class Sessions, Students, Announcements, Calendar
  Admin: Home, Users (Feature Flags arrive in Phase 3, Audit Log in Phase 7)
  Admissions officer: Home, Applications
  Admissions head: Home, Applications (with Admit), Study Mode & Student Schedule Changes
  Bursar: Application Fees (Home arrives in Phase 3)
- Update the EXISTING login flow to redirect by role to /student, /lecturer,
  /finance, /registrar, /admissions, /admin; wrong-role routes show a 403 page
- Skip-to-content link, nav landmark, keyboard support, accent focus ring
Create placeholder home pages only. Do not modify backend code.

Also apply the UI Footer: use only brand tokens from #file:docs/DESIGN_SYSTEM.md.
Comment every component and major JSX section.
```

### 2.19 Student Home Page

**Mode:** Edit
**Context:** `#file:docs/ACADEMIC_MODEL.md`

```text
Create /student inside the AppShell. Everything else is reached through the
navigation rail; the home page shows ONLY:

1. Hero (brand background): profile icon (photo or initials, links to the
   profile); time-of-day greeting "Good morning, <first name>" with programme
   and current intake underneath; announcements slider beside it: up to 5
   slides (pinned first), each with category badge, title, excerpt, optional
   image, "Read more" opening the full text in a dialog; arrows, dots, swipe,
   auto-advance every 6s, pause on hover and focus, no auto-advance when
   prefers-reduced-motion; empty state "No announcements right now".
2. Calendar: month view (shadcn Calendar) with event markers and a day agenda
   (classes, intake and academic dates; icon + label per type, not color alone).
3. My course units: selected units for the current intake (code, name,
   lecturer, next class). ONLINE students get an "Attend" button when
   canAttend is true: it calls POST /sessions/:id/attend and opens the returned
   meetingUrl in a new tab. PHYSICAL students see the room. Empty state with a
   "Select course units" button when the selection window is open.
4. Attendance percentage: one overall percentage in a teal badge; below the
   minimum it switches to the warning style with an icon and "Below minimum";
   small per-unit percentages; "No sessions yet" state.

Layout: desktop hero full width, calendar left, course units above attendance on
the right; mobile order: hero, attendance, course units, calendar.
Load from ONE request GET /me/home (TanStack Query) with skeletons and a retry
state. Do NOT add fees, GPA, exams or assignments to this page.

Also apply the UI Footer: use only brand tokens from #file:docs/DESIGN_SYSTEM.md.
Comment every component and major JSX section.
```

### 2.20 Lecturer, Registrar, Admissions & Admin Home Pages

**Mode:** Edit

```text
Create /lecturer, /registrar, /admissions and /admin home pages using the same hero (profile
icon, greeting, announcements slider) and calendar components as the student
home. Reuse components; do not copy code.

Role widgets:
- Lecturer: my course units this intake with student counts; today's sessions
  with an "Open meeting" button for the lecturer's own online sessions
- Registrar: current intake status and course unit selection progress; "needs
  attention" items in warning style (offerings without a lecturer, admitted
  students who have not selected units)
- Admissions (officer and head): applications awaiting review, awaiting fee
  confirmation, and ready to admit
- Admin: accounts needing attention (expired temporary passwords, deactivated
  users)

Load each from its GET /me/home response. Do not modify backend code.

Also apply the UI Footer: use only brand tokens from #file:docs/DESIGN_SYSTEM.md.
Comment every component and major JSX section.
```

### 2.21 Student Portal UI

**Mode:** Edit

```text
Create student pages in apps/web, all reached through the navigation rail:
/student/programme (my programme and curriculum), /student/course-units,
/student/timetable, /student/attendance, /student/announcements.

Course Units page: units for the student's programme are ALREADY LOADED for the
open intake; show them in groups: Core (pre-selected, locked), Electives
(choose within min/max, show credits used), Retakes, General units (shared across
faculties, "Shared" label). Show lecturer, seats left and sessions per unit;
clash, prerequisite and credit errors inline; total credits panel; confirm
dialog. After confirming, a "Selected" tab lists units with lecturer and sessions.
Timetable: sessions with "Attend" for open ONLINE sessions (physical students
see the room). Attendance: percentage per unit, per-session status, and a short
explanation of the continuous-time rule.

Use existing endpoints only. Do not modify backend code.

Also apply the UI Footer: use only brand tokens from #file:docs/DESIGN_SYSTEM.md.
Comment every component and major JSX section.
```

### 2.22 Lecturer UI

**Mode:** Edit

```text
Create lecturer pages in apps/web:
- /lecturer/units: my offerings per intake
- /lecturer/units/[offeringId]: class list showing each student's programme and
  schedule (shared units mix programmes)
- /lecturer/sessions: create and edit sessions, paste the meeting link
  (validate https), mark HELD or CANCELLED
- Attendance review per session: each student's longest continuous time and
  status; upload the meeting tool's attendance report; mark physical attendance
  (bulk "present" plus per-student overrides); override with a required reason
- Post an announcement to my own offerings

Use shadcn/ui data tables and TanStack Query. Guard by role.
Do not modify backend code.

Also apply the UI Footer: use only brand tokens from #file:docs/DESIGN_SYSTEM.md.
Comment every component and major JSX section.
```

### 2.23 Registrar UI

**Mode:** Edit

```text
Create registrar pages in apps/web:
- Faculties, departments, programmes
- Academic years and intakes (three per year; edit selection windows and status)
- Course units (toggle General, choose eligible faculties or "all faculties")
- Curriculum builder: set the units for a programme by study year and intake
  slot, Core or Elective, elective credit limits
- Offerings per intake: bulk-create from the curriculum, assign lecturer(s),
  capacity, selected counts
- Class sessions: generate from the timetable, edit, cancel
- Student list (search, filter, pagination) and detail incl. schedule history
- Announcements and calendar event management with audience pickers

Use shadcn/ui data tables and TanStack Query. Guard routes by role.
Do not modify backend code.

Also apply the UI Footer: use only brand tokens from #file:docs/DESIGN_SYSTEM.md.
Comment every component and major JSX section.
```

### 2.24 Admissions UI

**Mode:** Edit

```text
Create admin pages in apps/web:
- /admin/applications: list with filters (status, programme, intake, source)
  and a "New application" form for the admission office
- Application detail: applicant info; documents with approve/reject and a
  required note (viewed through signed URLs); an application fee card with a
  "Record fee" form (bank, reference, amount, date) and a clear duplicate error;
  a progress stepper: Submitted, Documents approved, Fee confirmed, Admitted
- "Admit" dialog: confirm programme and intake, choose the study mode (Online
  or Physical) and the student's schedule (Day, Evening, Weekend, or Distance),
  and show what will happen (account created, login emailed, course
  units loaded). The button is disabled until documents are approved and the fee
  is confirmed, and shows the reasons
- After admission: a success state and a "Resend login details" action
- /finance/application-fees (bursar): applications awaiting fee confirmation, with
  the same "Record fee" form
- /admin/users: create staff accounts with roles, resend credentials, deactivate
  (uses the user-management API from Phase 1 update 1.13)

Use shadcn/ui and TanStack Query. Guard by permission: officers see applications
and document review; only the admissions head sees Admit and Study Mode &
Student Schedule Changes;
only the bursar sees fee recording; only admin sees /admin/users.
Do not modify backend code.

Also apply the UI Footer: use only brand tokens from #file:docs/DESIGN_SYSTEM.md.
Comment every component and major JSX section.
```

### 2.25 Document the Phase

**Mode:** Ask

```text
Write the step documents for Phase 2 using #file:docs/phases/step-template.md.

For each completed step (2.0 to 2.24), create
docs/phases/phase-2/step-2.<n>-<name>.md covering: goal, files created or
changed (paths), key decisions and trade-offs, business rules implemented,
how to run and test (exact commands), data and permissions impact, known
limitations, and Copilot usage notes.

Then:
1. Append one entry per step to docs/DEVELOPMENT_LOG.md (newest first).
2. List decisions that deserve an ADR and draft them in docs/adr/ (intakes
   replace terms; shared offerings and general units; admissions gating; no
   public sign-up and temporary credentials; student schedule and offering
   delivery mode; continuous-time
   attendance; meeting provider choice).
3. List out-of-date sections in docs/DATABASE_SCHEMA.md and docs/RBAC_MATRIX.md.
Include the domain model, the intake calendar, the admissions flow, and a worked
attendance example (one long stay vs two short visits).

Base everything on the actual code in #codebase. Do not invent features. Do not
modify source code in this step.
```

---

# Phase 3: Finance Module

> **How payments work:** the live process is **physical**. The student pays at the bank; **Finance records the deposit and issues the receipt**. If a student tries to pay online from the system (**card, online bank, mobile money**), the system shows **"Coming soon"**. Each online method has its own flag (`payments.online.card`, `.bank`, `.mobile`), **OFF by default**. Never enable these flags during development; step 3.10 is a deferred activation runbook.

### 3.0 Feature Flag Infrastructure (Online Payment Switches)

**Mode:** Edit
**Context:** `#file:prisma/schema.prisma #file:docs/RBAC_MATRIX.md`

```text
Build a reusable feature-flag system. First flags (all default OFF):
payments.online.card, payments.online.bank, payments.online.mobile.

Backend (apps/api/src/features):
1. Prisma models: FeatureFlag (key unique, enabled default false, description,
   updatedById, updatedAt) and FeatureFlagAudit (append-only: key, fromValue,
   toValue, changedById, reason, createdAt).
2. Seed the three flags = false with upsert that NEVER overwrites an existing
   value. .env.example values only seed the first state.
3. FeatureFlagService: isEnabled(key) cached in Redis (30s TTL);
   setEnabled(key, value, userId, reason) writes flag + audit row in one
   transaction and invalidates the cache.
4. @RequireFeature('<key>') decorator + guard. When OFF respond 403 with
   { code: "FEATURE_DISABLED", comingSoon: true, feature, method, message }.
5. GET /features (authenticated, returns the flag map for the UI) and
   PATCH /admin/features/:key (admin only, reason required). Add the permission
   to docs/RBAC_MATRIX.md.

Frontend (apps/web): useFeature(key) hook (TanStack Query) and a
<FeatureGate feature="..." fallback={...}> component.

Include unit tests: default OFF, toggle audit, guard 403, cache invalidation.
Write NO payment logic in this step.
```

### 3.1 Finance Schema

**Mode:** Ask
**Context:** `#file:prisma/schema.prisma`

```text
Add Prisma models for finance.

Models: FeeStructure, FeeItem, StudentInvoice, Payment, Receipt,
OutstandingBalance, CarryForwardBalance, TransactionLog, PaymentReference.

Requirements:
- All amounts are Int minor units (no Float/Decimal drift)
- Currency field
- Payment: method enum (BANK_DEPOSIT now; CARD, ONLINE_BANK, MOBILE_MONEY
  reserved for later), bankName, bankReference, depositDate, optional slip
  scan key, recordedById, status (RECORDED, VOIDED), voidedById, voidReason,
  voidedAt
- Unique constraint on (bankName, bankReference) to stop duplicate slips
- Optional applicationId on Payment so application fees use the same flow;
  migrate Phase 2's ApplicationFeeRecord data into it
- PaymentReference: unique reference number per student, intake, invoice
- Receipt number unique and sequential; receipts can be marked VOID
- TransactionLog is append-only (no update/delete in design)
- Relations to Intake, Programme, Student
- Indexes, enums, timestamps

Do NOT generate APIs. Do not modify existing models.
```

### 3.2 Fee Structure APIs

**Mode:** Edit

```text
Create FeeStructureService, controller, and DTOs in apps/api/src/finance.

Features:
- Create and update fee structures
- Assign fees per programme and intake (and per student schedule, DAY, EVENING,
  WEEKEND, or DISTANCE, if fees differ)
- Validate academic year and intake relationships
- Prevent editing a structure once invoices exist (create a new version instead)

RBAC: finance_manager manages fee structures; bursar read-only. Add the
finance_manager role and the finance permissions to docs/RBAC_MATRIX.md and the
seed (idempotent). No frontend code.
```

### 3.3 Invoice Generation

**Mode:** Edit

```text
Create InvoiceService.

Features:
- Generate invoices for a student on registration
- Bulk generate per intake/programme
- Apply carried-forward credit or debt automatically
- Idempotent: running twice must not duplicate invoices

Use transactions. Service only; no controller yet.
```

### 3.4 Payment Logic (Bank Deposits Recorded by Finance)

**Mode:** Edit

```text
Create PaymentService for the PHYSICAL payment flow (student pays at the bank,
Finance records it). Service-based architecture.

Features:
- Generate a unique payment reference for a student/intake/invoice (to be written
  on the bank deposit slip)
- recordBankDeposit(dto, recordedById): student (or applicant for an application
  fee, which then marks the application's fee as confirmed), invoice, amount, bankName,
  bankReference, depositDate, optional slip scan; reject a duplicate
  (bankName, bankReference) with ConflictException
- Calculate balance after payment
- Carry forward excess payments to the next intake
- Calculate outstanding balance and fee-paid percentage per student per intake
- voidPayment(id, voidedById, reason): never delete; write a reversing
  TransactionLog entry; the voider must differ from the recorder
- Write a TransactionLog entry for every change

All writes in a single DB transaction. Reject negative or zero amounts.
Students can never record payments themselves.
Several finance users may record payments at the same time: every call takes the
authenticated user's id (no shared accounts) and stores it as recordedById.
Service only. No controller, no frontend, no online payment code.
```

### 3.5 Finance Tests (Run Before Receipts)

**Mode:** Edit

```text
Write unit and integration tests for the finance services.

Cases: exact payment, partial payment, overpayment carry-forward,
multiple payments, duplicate bank reference rejected, negative amount,
percentage rounding, concurrent payments (no lost updates), void then
re-record, voider equals recorder rejected, invoice generation idempotency,
payment reference uniqueness, two finance users recording concurrently get
distinct gap-free receipt numbers, same user cannot approve their own void.

Do not change production code; list any bugs found.
```

### 3.6 Payment Controller

**Mode:** Edit

```text
Create the PaymentController and DTOs for the existing PaymentService, plus an
OnlinePaymentController.

Bank-deposit endpoints (ACTIVE): generate reference (student, own only), record
deposit (any authenticated user with finance:payment:record; several finance
users allowed), list payments (filters), void payment (finance_manager only, and a different person from the
recorder; reason required), student statement (own only), daily bank-deposit report.

Online endpoints (COMING SOON): POST /payments/online/:method/initiate for
card, bank and mobile. Guard each with @RequireFeature('payments.online.<method>')
so that while OFF they return 403 { code: "FEATURE_DISABLED", comingSoon: true,
method, message }. The body must contain no gateway logic; add a PaymentGateway
interface (initiate, verify, refund) and placeholder adapters that throw
NotImplemented. Document the 403 in Swagger.

Add controller tests: unauthenticated 401, authenticated without finance
permission 403, finance user allowed, bank-deposit RBAC, and each online method returns the
coming-soon 403 while OFF. Do not modify services.
```

### 3.7 Receipt Generation

**Mode:** Edit

```text
Create ReceiptService (ACTIVE).

Features:
- Issue a receipt automatically when Finance records a bank deposit
- Gap-free sequential receipt numbering (transaction safe, correct even when
  several finance users record payments at the same moment)
- Printable PDF using PDFKit
- School logo watermark and school details from config
- Transaction reference, bank name and deposit-slip reference on the receipt
- VOID marking when a payment is voided (keep the original number)
- Store the PDF through the existing StorageService
- Re-download the same receipt without generating a new number

Add the controller endpoint to fetch it. No frontend.
```

### 3.8 Finance Dashboard UI

**Mode:** Edit

```text
Create bursar dashboard pages in apps/web/finance:
fee structures and invoices, a "Record bank deposit" form (student search,
invoice, amount, bank, deposit-slip reference, deposit date, optional slip
upload) with clear duplicate-slip error, payment records (filter, search,
pagination, "Recorded by" column and filter by finance user), receipt print and history, void dialog with required reason,
daily bank-deposit report, fee analytics (Recharts).

Use Next.js, shadcn/ui, TanStack Query. Format money from minor units.
Do not modify backend code.
Add the Finance rail items to nav.config.ts and build /finance as the Finance home page using the shared home layout (hero, calendar, today's deposits). Do not create a new layout.

Also apply the UI Footer: use only brand tokens from #file:docs/DESIGN_SYSTEM.md.
Comment every component and major JSX section.
```

### 3.9 Student Financial Statement UI

**Mode:** Edit

```text
Create student pages: /student/finance with
- balance, invoices, payment history, receipt downloads
- "Get payment reference" button (generates the reference to write on the
  bank deposit slip)
- "How to pay now" panel: bank name, account details (from config), and the
  steps: pay at the bank, bring the slip to Finance, collect your receipt
- "Pay online" section listing Card, Online bank and Mobile money, each with a
  "Coming soon" badge (<ComingSoonBadge>) and a disabled button. Wrap each in
  <FeatureGate feature="payments.online.<method>"> so it activates later with no
  code change. If the student clicks, show the message: "<Method> payments are
  coming soon. Please pay at the bank and collect your receipt from Finance."

Mobile first. Use existing endpoints only. No errors or broken layout.
Enable the student Finance item in nav.config.ts.

Also apply the UI Footer: use only brand tokens from #file:docs/DESIGN_SYSTEM.md.
Comment every component and major JSX section.
```

### 3.10 Online Payment Activation (DEFERRED: run only when a method is approved)

**Mode:** Ask, then Edit

```text
Prepare, but do NOT execute, activation of ONE online method (<card|bank|mobile>).

Create docs/runbooks/ONLINE_PAYMENT_ACTIVATION.md containing:
1. Provider selection criteria and integration checklist (hosted checkout for
   cards so card numbers never touch our servers; webhook signature
   verification; idempotency; refunds).
2. Implementation plan for the gateway adapter behind the PaymentGateway
   interface, including reconciliation with provider reports.
3. Pre-activation checklist: sandbox tests passing, security review done,
   receipts issued for online payments, exam fee rule verified, stakeholders
   approved.
4. Activation steps: enable payments.online.<method> on staging, smoke test,
   then production via PATCH /admin/features/:key with a written reason.
5. First-48-hours monitoring and rollback (toggle the flag OFF; completed
   payments stay untouched).
6. Post-activation: CHANGELOG, DEVELOPMENT_LOG, ADR.

Do NOT change any flag value, seed, or environment variable in this step.
```

### 3.11 Document the Phase

**Mode:** Ask

```text
Write the step documents for Phase 3 using #file:docs/phases/step-template.md.

For each completed step (3.0 to 3.10), create
docs/phases/phase-3/step-3.<n>-<name>.md covering: goal, files created or
changed (paths), key decisions and trade-offs, business rules implemented,
how to run and test (exact commands), data and permissions impact, known
limitations, and Copilot usage notes.

Then:
1. Append one entry per step to docs/DEVELOPMENT_LOG.md (newest first).
2. List any decision that deserves an ADR and draft it in docs/adr/
   (feature-flag design, maker-checker voids, bank-reference uniqueness).
3. List out-of-date sections in docs/DATABASE_SCHEMA.md and docs/RBAC_MATRIX.md.
Include the physical payment workflow with a worked example (payment,
partial payment, carry-forward, receipt numbering, void) and a table of which
payment methods are active vs coming soon.

Base everything on the actual code in #codebase. Do not invent features. Do not
modify source code in this step.
```

---

# Phase 4: LMS & Assignment System

### 4.1 LMS Schema

**Mode:** Ask
**Context:** `#file:prisma/schema.prisma`

```text
Add Prisma models for the LMS.

Models: Assignment, AssignmentTarget (course unit offering visibility), LearningMaterial,
Submission, SubmissionFile, Grade, Feedback, ExtensionRequest.

Include relationships, indexes, enums (AssignmentStatus: DRAFT, PENDING_APPROVAL,
PUBLISHED, CLOSED; SubmissionStatus: SUBMITTED, LATE, MISSED, GRADED), timestamps.

Do NOT generate APIs. Do not model exams (separate phase).
```

### 4.2 Assignment APIs

**Mode:** Edit

```text
Create AssignmentService, controller, and DTOs.

Features:
- Create and update assignments
- Deadline tracking
- Visibility per course unit offering (every student who selected the unit sees it, from any programme)
- Approval workflow (lecturer submits, head approves)
- Lecturers can only manage their own course unit offerings

Apply RBAC per docs/RBAC_MATRIX.md. No frontend.
Register a CalendarEventProvider so assignment deadlines appear in calendars.
```

### 4.3 Storage Service

**Mode:** Edit

```text
Create a StorageService abstraction in apps/api/src/storage.

Interface: upload, getSignedDownloadUrl, delete.
Implementation: S3-compatible client configured by env variables
(endpoint, bucket, keys, region, forcePathStyle) so MinIO, R2 and S3
all work with config only.

No business logic. Include a short README section on the env variables.
```

### 4.4 File Upload System

**Mode:** Edit

```text
Build a secure upload module using StorageService.

Allowed: PDF, DOCX, PPTX, PNG, JPG.
Validate: MIME type AND magic bytes, max size from config, sanitize filenames,
generate random storage keys. Return pre-signed download URLs only.
Reject everything else with clear errors.

No LMS business logic here.
```

### 4.5 Submission Logic

**Mode:** Edit

```text
Create SubmissionService.

Features:
- Student uploads a submission (only if enrolled and assignment visible)
- Deadline enforcement (mark LATE or reject per assignment setting)
- Missed paper tracking (scheduled job marks MISSED after deadline)
- Extension request and approval handling
- Submission status tracking and resubmission rules

Service and controller. No UI.
```

### 4.6 Teacher Grading System

**Mode:** Edit

```text
Create GradingService.

Features:
- Grade a submission with rubric score and feedback
- Draft vs published marks
- Bulk publish marks
- Grading analytics (average, distribution)
- Submission statistics per assignment

RBAC: only the owning lecturer may grade. Students see published marks only.
```

### 4.7 LMS Tests

**Mode:** Edit

```text
Write tests for LMS services: deadline enforcement, late vs missed,
extensions, upload validation (wrong type, oversize, spoofed extension),
visibility per course unit offering, grading permissions, unpublished marks hidden from students.
Do not change production code; list bugs.
```

### 4.8 LMS Frontend

**Mode:** Edit

```text
Create LMS pages in apps/web.

Student: assignments list, assignment detail and submit, reading materials.
Teacher: create/edit assignment, upload materials, submissions list, grading dashboard.

Use Next.js, shadcn/ui, TanStack Query. Show upload progress and validation
errors. Do not modify backend code.
Enable Assignments/Materials (student) and Assignments/Grading (lecturer) in nav.config.ts.

Also apply the UI Footer: use only brand tokens from #file:docs/DESIGN_SYSTEM.md.
Comment every component and major JSX section.
```

### 4.9 Document the Phase

**Mode:** Ask

```text
Write the step documents for Phase 4 using #file:docs/phases/step-template.md.

For each completed step (4.1 to 4.8), create
docs/phases/phase-4/step-4.<n>-<name>.md covering: goal, files created or
changed (paths), key decisions and trade-offs, business rules implemented,
how to run and test (exact commands), data and permissions impact, known
limitations, and Copilot usage notes.

Then:
1. Append one entry per step to docs/DEVELOPMENT_LOG.md (newest first).
2. List any decision that deserves an ADR and draft it in docs/adr/.
3. List out-of-date sections in docs/DATABASE_SCHEMA.md and docs/RBAC_MATRIX.md.
Include the upload validation rules and storage configuration.

Base everything on the actual code in #codebase. Do not invent features. Do not
modify source code in this step.
```

---

# Phase 5: Examination System

### 5.1 Exam Schema

**Mode:** Ask

```text
Add Prisma models for examinations.

Models: Exam, ExamTarget, ExamSubmission, ExamGrade, ExamResult,
ExamRestriction (rule type, threshold), ExamEligibility (cached decision + reason).

Include relationships, indexes, enums (ExamStatus, ResultStatus incl. MISSED), timestamps.
Do NOT generate APIs.
```

### 5.2 Exam Creation APIs

**Mode:** Edit

```text
Create ExamService, controller, DTOs.

Features: create exam, publish exam, course unit offering visibility, scheduling,
deadline management, unpublish before start only.
RBAC: lecturer and registrar. No frontend.
Register a CalendarEventProvider so exam dates appear in calendars.
```

### 5.3 Restriction Logic

**Mode:** Edit
**Context:** `#file:apps/api/src/finance/payment.service.ts`

```text
Create ExamEligibilityService.

Rules (configurable per exam):
- Assignment completion threshold
- Minimum fee-paid percentage (use the existing PaymentService, do not
  duplicate its logic). It reads the payments that Finance recorded from bank
  deposits, so the rule is fully active.
- Missed-assignment restrictions
- Return { eligible: boolean, reasons: string[] }
- Cache the decision in Redis with invalidation on payment or submission events

Allow registrar override with an audit log entry. Service and unit tests only.
```

### 5.4 Result Publishing

**Mode:** Edit

```text
Create ResultService.

Features: enter and moderate marks, publish results, missed paper status,
visibility rules (students see only published results), grading reports.
All state transitions logged. No frontend.
```

### 5.5 Transcript & GPA

**Mode:** Edit

```text
Create TranscriptService.

Features: grade-point mapping from config, intake GPA, cumulative GPA,
academic standing, transcript PDF with school branding (PDFKit).
Handle retakes using the configured policy (latest or best).
Include unit tests for GPA math.
```

### 5.6 Exam Tests

**Mode:** Edit

```text
Write tests for the exam module: eligibility matrix (fee percent x assignment
completion), registrar override, publish/unpublish rules, result visibility,
GPA with retakes. Do not change production code; list bugs.
```

### 5.7 Examination Frontend

**Mode:** Edit

```text
Create exam pages in apps/web: exams dashboard, eligibility status with
clear reasons (e.g. "Fees paid 40%, 60% required"), exam attempts,
lecturer grading pages, student result pages, transcript download.
Use shadcn/ui and TanStack Query. Do not modify backend code.
Enable Exams, Results and Transcript items in nav.config.ts.

Also apply the UI Footer: use only brand tokens from #file:docs/DESIGN_SYSTEM.md.
Comment every component and major JSX section.
```

### 5.8 Document the Phase

**Mode:** Ask

```text
Write the step documents for Phase 5 using #file:docs/phases/step-template.md.

For each completed step (5.1 to 5.7), create
docs/phases/phase-5/step-5.<n>-<name>.md covering: goal, files created or
changed (paths), key decisions and trade-offs, business rules implemented,
how to run and test (exact commands), data and permissions impact, known
limitations, and Copilot usage notes.

Then:
1. Append one entry per step to docs/DEVELOPMENT_LOG.md (newest first).
2. List any decision that deserves an ADR and draft it in docs/adr/.
3. List out-of-date sections in docs/DATABASE_SCHEMA.md and docs/RBAC_MATRIX.md.
Include the eligibility rule matrix and GPA policy.

Base everything on the actual code in #codebase. Do not invent features. Do not
modify source code in this step.
```

---

# Phase 6: Reporting & Analytics

### 6.1 Analytics APIs

**Mode:** Edit

```text
Create analytics endpoints in apps/api/src/analytics.

Datasets: finance, attendance, assignments, student performance, teacher workload.
Support filters: intake, programme, course unit, date range.
Use efficient Prisma/SQL aggregations (no N+1). RBAC per role.
No frontend.
```

### 6.2 Chart Data Services

**Mode:** Edit

```text
Create ChartDataService returning chart-ready series:
monthly revenue, attendance trends, assignment completion trends,
student performance summaries.

Cache heavy aggregates in Redis with sensible TTLs and event-based invalidation.
Return typed DTOs shared via packages/shared.
```

### 6.3 Dashboard UI

**Mode:** Edit

```text
Create analytics dashboards in apps/web.

Components: KPI cards, Recharts charts, data tables, filters, export buttons.
Use Next.js, shadcn/ui, TanStack Query with skeleton loading states.
Role-specific dashboards (bursar, registrar, lecturer).
Do not modify backend code.
Enable the Reports items in nav.config.ts.

Also apply the UI Footer: use only brand tokens from #file:docs/DESIGN_SYSTEM.md.
Comment every component and major JSX section.
```

### 6.4 PDF Report Exports

**Mode:** Edit

```text
Create ReportExportService for printable PDFs: academic report,
finance report, attendance report.

Include school branding, generated date, filters used, and page numbers.
Generate in a background job (BullMQ), store via StorageService, and
return a signed URL. Add the controller endpoint only.
```

### 6.5 Report Tests

**Mode:** Edit

```text
Write tests verifying aggregation correctness against a fixed seeded dataset,
cache invalidation, and that exported totals equal on-screen totals.
Do not modify production code.
```

### 6.6 Document the Phase

**Mode:** Ask

```text
Write the step documents for Phase 6 using #file:docs/phases/step-template.md.

For each completed step (6.1 to 6.5), create
docs/phases/phase-6/step-6.<n>-<name>.md covering: goal, files created or
changed (paths), key decisions and trade-offs, business rules implemented,
how to run and test (exact commands), data and permissions impact, known
limitations, and Copilot usage notes.

Then:
1. Append one entry per step to docs/DEVELOPMENT_LOG.md (newest first).
2. List any decision that deserves an ADR and draft it in docs/adr/.
3. List out-of-date sections in docs/DATABASE_SCHEMA.md and docs/RBAC_MATRIX.md.
Include the aggregation definitions and cache invalidation rules.

Base everything on the actual code in #codebase. Do not invent features. Do not
modify source code in this step.
```

---

# Phase 7: Hardening & Launch

### 7.1 Security Review

**Mode:** Ask
**Context:** `#codebase`

```text
Review the codebase for security issues. Check: missing guards on endpoints,
IDOR (accessing other students' records), unvalidated input, SQL injection
in raw queries, insecure file handling, secrets in code, overly broad CORS,
missing rate limits, verbose error leaks.

Output a table: file, issue, severity, suggested fix.
Do not change any code in this step.
```

### 7.2 Security Fixes

**Mode:** Edit

```text
Fix ONLY the issue I paste below, in the files I name. Show the minimal diff
and add a regression test.
Issue: <paste a row from the review table>
```

### 7.3 Audit Logging

**Mode:** Edit

```text
Add an AuditLog model and interceptor.

Log: who, what, when, IP, resource id for sensitive actions (grade changes,
payment records, result publishing, role changes, eligibility overrides).
Logs are append-only and viewable by admin only. Do not log secrets or passwords.
```

### 7.4 Performance

**Mode:** Ask

```text
Analyze these slow queries / endpoints: <paste>.
Suggest indexes, query rewrites, and caching. Consider results-day load
(thousands of concurrent reads). Provide the Prisma migration for new indexes.
Explain tradeoffs; do not apply changes yet.
```

### 7.5 Load Test Scripts

**Mode:** Edit

```text
Write k6 scripts for: login surge, course unit selection window opening,
results-day reads, payment recording. Include thresholds
(p95 latency, error rate) and a README on running them against staging.
```

### 7.6 Deployment Pipeline

**Mode:** Edit

```text
Extend GitHub Actions with a deploy workflow.

Flow: merge to main → build Docker images → deploy to staging automatically →
manual approval → production.
Run Prisma migrations as a separate step before the app starts.
Use GitHub environments and secrets. Include a rollback job.
```

### 7.7 Backups & Monitoring

**Mode:** Edit

```text
Add: scheduled PostgreSQL backups to object storage with retention,
a restore script and documentation, health check endpoints (/health, /ready),
and structured logging with request IDs. Do not change business logic.
```

### 7.8 Documentation

**Mode:** Edit

```text
Generate: OpenAPI docs cleanup (tags, examples), README with setup steps,
docs/RUNBOOK.md (deploy, rollback, restore, common incidents), and a
short admin guide outline. Do not modify source code.
```

### 7.9 Document the Phase

**Mode:** Ask

```text
Write the step documents for Phase 7 using #file:docs/phases/step-template.md.

For each completed step (7.1 to 7.8), create
docs/phases/phase-7/step-7.<n>-<name>.md covering: goal, files created or
changed (paths), key decisions and trade-offs, business rules implemented,
how to run and test (exact commands), data and permissions impact, known
limitations, and Copilot usage notes.

Then:
1. Append one entry per step to docs/DEVELOPMENT_LOG.md (newest first).
2. List any decision that deserves an ADR and draft it in docs/adr/.
3. List out-of-date sections in docs/DATABASE_SCHEMA.md and docs/RBAC_MATRIX.md.
Include the security findings and fixes, backup and restore procedure, and rollback steps.

Base everything on the actual code in #codebase. Do not invent features. Do not
modify source code in this step.
```

---

# Cross-Cutting Utility Prompts

### Document the Step (use after EVERY micro-phase)

**Mode:** Ask

```text
Document the step I just completed: <phase.step and name>.
Use #file:docs/phases/step-template.md and my staged changes (#changes).
Create docs/phases/phase-<N>/step-<N.M>-<name>.md and append a dated entry to
docs/DEVELOPMENT_LOG.md. Cover: goal, files changed, key decisions, business
rules, exact commands to run and test, data/permissions impact, known
limitations. Do not change source code.
```

### Add Comments to Existing Code

**Mode:** Edit

```text
Add comments to #file:<path> WITHOUT changing any logic or formatting of code.
Add: a file header comment, TSDoc on every exported class/function/method,
and a short "why" comment above every logical block. Name the business rule
or security concern where relevant. Keep existing comments. If a comment would
only repeat the code, skip it.
```

### Comment Review (before committing)

**Mode:** Ask

```text
Review #changes for comment and documentation gaps. List every file, function,
or block that lacks a header, TSDoc, or a why-comment, and every comment that
no longer matches the code. Output a table: file, line, gap. Do not modify code.
```

### Brand Token Audit

**Mode:** Ask

```text
Scan apps/web for raw hex colors, non-token Tailwind colors (e.g. bg-blue-500),
misuse of the teal badge color outside GPA/attendance, statuses shown by color
alone (no icon or text), and online payment options (card, bank, mobile) not wrapped in <FeatureGate> with a "Coming soon" badge. Compare with
#file:docs/DESIGN_SYSTEM.md. Output a table: file, line, issue, correct token.
Do not modify code.
```

### Fix a Failing Test

**Mode:** Edit

```text
This test fails: <paste test + error>. The implementation is in <file>.
Find the root cause and make the smallest change possible. Do not refactor
and do not touch unrelated files. Explain the cause in two sentences.
```

### Explain Before Changing

**Mode:** Ask

```text
Explain how <feature> currently works across #file:<a> and #file:<b>.
List the data flow and any risks. Do not propose or make changes.
```

### Safe Refactor

**Mode:** Edit

```text
Refactor <file> to <goal>. Keep the public API and behavior identical.
Existing tests must still pass; do not edit tests. Make no changes outside
this file.
```

### Update Context Docs After a Phase

**Mode:** Ask

```text
Compare prisma/schema.prisma with docs/DATABASE_SCHEMA.md and list what is
out of date. Then produce the updated sections of the document only.
```

### Pull Request Description

**Mode:** Ask

```text
Write a PR description for my staged changes: summary, what changed,
how to test, risks, and screenshots needed. Keep it under 200 words.
```

### GitHub Issue for the Copilot Coding Agent

**Use as the issue body**

```text
Title: <Module> unit tests for <Service>

Goal: Add unit tests for <Service> in apps/api/src/<module>.
Scope: tests only; do NOT modify production code.
Cases: <list 5-8 cases>
Acceptance criteria:
- All new tests pass in CI
- Coverage for <Service> at least 85%
- No changes outside *.spec.ts files
Context: see docs/ARCHITECTURE.md and .github/copilot-instructions.md
```

---

## Quick Reference: Which Mode Where

| Work                                                         | Recommended Mode                       |
| ------------------------------------------------------------ | -------------------------------------- |
| Schema design, architecture, reviews                         | Ask                                    |
| Services, controllers, DTOs in named files                   | Edit                                   |
| UI pages for existing endpoints                              | Edit                                   |
| Isolated test-writing or docs issues                         | Coding agent (issue → PR)              |
| Multi-file, well-specified task after conventions are stable | Agent                                  |
| First review of every PR                                     | Copilot code review, plus human review |
| Step documentation, comment gaps, brand token audits         | Ask                                    |

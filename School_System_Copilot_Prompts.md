# School Management System: Copilot Prompt Library

Ready-to-paste prompts for every micro-phase of the roadmap. Each prompt is kept under ~250 words, states its scope, and tells Copilot what **not** to do.

> **Standing rules for every prompt:** (1) **always comment code** (file header, TSDoc on every function/class, block comments explaining why); (2) **document every step** using the step-documentation prompt that closes each phase; (3) **all UI uses the brand tokens** (`brand #312E81`, `accent #4F46E5`, `badge #0D9488`, `surface #F9FAFB`, `card #FFFFFF`, `ink #111827`, `line #E5E7EB`) and the status tokens (`success #15803D`, `warning #B45309`, `error #B91C1C`, `info #4F46E5`, `field #6B7280`, each with a soft tint) via `docs/DESIGN_SYSTEM.md`, never raw hex values; (4) **payments**: the live process is physical (the student pays at the bank, Finance records the deposit and issues the receipt); online card, bank and mobile payments show **"Coming soon"** behind per-method feature flags (default OFF).

---

## How to Use This Library

1. **Open a new chat for every prompt.** This keeps context clean.
2. **Attach context first.** Use the `#file` references shown in each prompt (or drag the files into chat).
3. **Pick the mode listed.** *Ask* = plan or generate for review, *Edit* = apply changes to selected files, *Agent* = only for well-scoped tasks once conventions are stable.
4. **Review the diff and confirm the code is commented**, run build and tests, **run the step-documentation prompt**, then commit before moving on.
5. **Replace placeholders** such as `<module>` and `<path>` with your real names.
6. To make a prompt reusable, save it as `.github/prompts/<phase>-<step>.prompt.md` with this header:

```markdown
---
mode: 'edit'
description: 'Phase X, Step Y: short title'
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

| Placeholder | Meaning |
|---|---|
| `apps/api` | NestJS backend |
| `apps/web` | Next.js frontend |
| `prisma/schema.prisma` | Prisma schema |
| `docs/*.md` | Context documents |

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

Roles: student, lecturer, bursar, registrar, admin.
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

---

# Phase 2: Core Academic & Student Information System

### 2.1 Academic Schema
**Mode:** Ask
**Context:** `#file:prisma/schema.prisma #file:docs/DATABASE_SCHEMA.md`

```text
Add Prisma models for academic structure and SIS.

Models: AcademicYear, Term, Program, Course, CourseOffering (class),
Student, Lecturer, Enrollment, CourseRegistration, Timetable slot,
AttendanceRecord, AdmissionRecord.

Requirements:
- Link Student and Lecturer to User (one-to-one)
- Enrollment history preserved (no destructive updates)
- Unique constraints (e.g. one registration per student per offering)
- Indexes, enums (e.g. EnrollmentStatus), timestamps

Do NOT generate APIs. Do not modify auth models.
```

### 2.2 Seed Data
**Mode:** Edit

```text
Extend prisma/seed.ts with sample academic data: 1 academic year, 2 terms,
3 programs, 12 courses, 20 students, 5 lecturers, offerings for the current term.
Keep it idempotent and clearly marked as development-only
(skip when NODE_ENV=production). Do not alter existing seed sections.
```

### 2.3 SIS Services
**Mode:** Edit

```text
Create apps/api/src/sis with StudentsService and EnrollmentsService.

Features:
- CRUD for students (soft delete)
- Search and pagination
- Admission record handling
- Enrollment history queries

Services and repositories only. No controllers or guards yet.
Use Prisma, with transactions where multiple writes occur.
```

### 2.4 SIS Controllers & RBAC
**Mode:** Edit
**Context:** `#file:docs/RBAC_MATRIX.md`

```text
Create controllers and DTOs for the existing SIS services.

Apply @Roles/@Permissions exactly per RBAC_MATRIX.md.
Students may only read their OWN record.
Use class-validator DTOs, pagination query DTO, and Swagger decorators.
Do not modify the services.
```

### 2.5 Course Registration Logic
**Mode:** Edit

```text
Create CourseRegistrationService in apps/api/src/academic.

Rules:
- Registration only within the term's registration window
- Prerequisite check
- Offering capacity check
- Retake handling (flag as retake, allowed once per term)
- Timetable clash detection against already registered offerings
- Return clear, typed error reasons

Wrap writes in a transaction. Service only: no controller, no UI.
```

### 2.6 Timetable & Attendance
**Mode:** Edit

```text
Create TimetableService and AttendanceService.

Timetable: create slots, detect room and lecturer clashes, get a student's
weekly schedule.
Attendance: lecturer records attendance for a session, student attendance
history, attendance percentage per course.

Services only. Do not generate controllers or UI.
```

### 2.7 Academic Controllers
**Mode:** Edit

```text
Add controllers and DTOs for CourseRegistrationService, TimetableService,
and AttendanceService. Apply RBAC per docs/RBAC_MATRIX.md.
Students: register, view own timetable and attendance.
Lecturers: record attendance for their own offerings.
Do not modify services.
```

### 2.8 Academic Tests
**Mode:** Edit

```text
Write unit tests for CourseRegistrationService, TimetableService, and
AttendanceService. Cover: closed registration window, missing prerequisite,
full class, clash detection, retake rules, attendance percentage math.
Do not change production code; list bugs instead.
```

### 2.9 Student Portal UI
**Mode:** Edit

```text
Create student portal pages in apps/web (navigation rail in brand color; GPA and attendance shown as teal badge components): /student/profile,
/student/registration, /student/timetable, /student/attendance.

Use shadcn/ui, TanStack Query, mobile-first layout.
Registration page: list offerings, show clash/prereq errors inline,
confirm dialog. Backend already exists; do not change it.

Also apply the UI Footer: use only brand tokens from #file:docs/DESIGN_SYSTEM.md.
Comment every component and major JSX section.
```

### 2.10 Registrar UI
**Mode:** Edit

```text
Create registrar pages in apps/web: student list (search, filter, pagination),
student detail, course and offering management.

Use shadcn/ui data tables and TanStack Query. Guard routes by role.
Do not modify backend code.

Also apply the UI Footer: use only brand tokens from #file:docs/DESIGN_SYSTEM.md.
Comment every component and major JSX section.
```

### 2.11 Document the Phase
**Mode:** Ask

```text
Write the step documents for Phase 2 using #file:docs/phases/step-template.md.

For each completed step (2.1 to 2.10), create
docs/phases/phase-2/step-2.<n>-<name>.md covering: goal, files created or
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
- PaymentReference: unique reference number per student, term, invoice
- Receipt number unique and sequential; receipts can be marked VOID
- TransactionLog is append-only (no update/delete in design)
- Relations to Term, Program/Offering, Student
- Indexes, enums, timestamps

Do NOT generate APIs. Do not modify existing models.
```

### 3.2 Fee Structure APIs
**Mode:** Edit

```text
Create FeeStructureService, controller, and DTOs in apps/api/src/finance.

Features:
- Create and update fee structures
- Assign fees per program/class and term
- Validate academic year and term relationships
- Prevent editing a structure once invoices exist (create a new version instead)

RBAC: bursar and admin only. No frontend code.
```

### 3.3 Invoice Generation
**Mode:** Edit

```text
Create InvoiceService.

Features:
- Generate invoices for a student on registration
- Bulk generate per term/class
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
- Generate a unique payment reference for a student/term/invoice (to be written
  on the bank deposit slip)
- recordBankDeposit(dto, recordedById): student, invoice, amount, bankName,
  bankReference, depositDate, optional slip scan; reject a duplicate
  (bankName, bankReference) with ConflictException
- Calculate balance after payment
- Carry forward excess payments to the next term
- Calculate outstanding balance and fee-paid percentage per student per term
- voidPayment(id, voidedById, reason): never delete; write a reversing
  TransactionLog entry; the voider must differ from the recorder
- Write a TransactionLog entry for every change

All writes in a single DB transaction. Reject negative or zero amounts.
Students can never record payments themselves.
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
payment reference uniqueness.

Do not change production code; list any bugs found.
```

### 3.6 Payment Controller
**Mode:** Edit

```text
Create the PaymentController and DTOs for the existing PaymentService, plus an
OnlinePaymentController.

Bank-deposit endpoints (ACTIVE): generate reference (student, own only), record
deposit (bursar), list payments (filters), void payment (admin or second bursar,
reason required), student statement (own only), daily bank-deposit report.

Online endpoints (COMING SOON): POST /payments/online/:method/initiate for
card, bank and mobile. Guard each with @RequireFeature('payments.online.<method>')
so that while OFF they return 403 { code: "FEATURE_DISABLED", comingSoon: true,
method, message }. The body must contain no gateway logic; add a PaymentGateway
interface (initiate, verify, refund) and placeholder adapters that throw
NotImplemented. Document the 403 in Swagger.

Add controller tests: bank-deposit RBAC, and each online method returns the
coming-soon 403 while OFF. Do not modify services.
```

### 3.7 Receipt Generation
**Mode:** Edit

```text
Create ReceiptService (ACTIVE).

Features:
- Issue a receipt automatically when Finance records a bank deposit
- Gap-free sequential receipt numbering (transaction safe)
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
pagination), receipt print and history, void dialog with required reason,
daily bank-deposit report, fee analytics (Recharts).

Use Next.js, shadcn/ui, TanStack Query. Format money from minor units.
Do not modify backend code.

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

Models: Assignment, AssignmentTarget (class visibility), LearningMaterial,
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
- Visibility per class/offering
- Approval workflow (lecturer submits, head approves)
- Lecturers can only manage their own offerings

Apply RBAC per docs/RBAC_MATRIX.md. No frontend.
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
visibility per class, grading permissions, unpublished marks hidden from students.
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

Features: create exam, publish exam, class visibility, scheduling,
deadline management, unpublish before start only.
RBAC: lecturer and registrar. No frontend.
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

Features: grade-point mapping from config, semester GPA, cumulative GPA,
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
Support filters: term, program, class, date range.
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
Write k6 scripts for: login surge, course registration window opening,
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

| Work | Recommended Mode |
|---|---|
| Schema design, architecture, reviews | Ask |
| Services, controllers, DTOs in named files | Edit |
| UI pages for existing endpoints | Edit |
| Isolated test-writing or docs issues | Coding agent (issue → PR) |
| Multi-file, well-specified task after conventions are stable | Agent |
| First review of every PR | Copilot code review, plus human review |
| Step documentation, comment gaps, brand token audits | Ask |

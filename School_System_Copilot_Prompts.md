# School Management System: Copilot Prompt Library

Ready-to-paste prompts for every micro-phase of the roadmap. Each prompt is kept under ~250 words, states its scope, and tells Copilot what **not** to do.

---

## How to Use This Library

1. **Open a new chat for every prompt.** This keeps context clean.
2. **Attach context first.** Use the `#file` references shown in each prompt (or drag the files into chat).
3. **Pick the mode listed.** *Ask* = plan or generate for review, *Edit* = apply changes to selected files, *Agent* = only for well-scoped tasks once conventions are stable.
4. **Review the diff, run build and tests, then commit** before moving on.
5. **Replace placeholders** such as `<module>` and `<path>` with your real names.
6. To make a prompt reusable, save it as `.github/prompts/<phase>-<step>.prompt.md` with this header:

```markdown
---
mode: 'edit'
description: 'Phase X, Step Y: short title'
---
```

### Standard Footer (append to any prompt)

```text
Rules: follow .github/copilot-instructions.md. Do not modify or regenerate existing
files unless I name them. Do not add features I did not list. If anything is unclear,
ask me before generating.
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
Create student portal pages in apps/web: /student/profile,
/student/registration, /student/timetable, /student/attendance.

Use shadcn/ui, TanStack Query, mobile-first layout.
Registration page: list offerings, show clash/prereq errors inline,
confirm dialog. Backend already exists; do not change it.
```

### 2.10 Registrar UI
**Mode:** Edit

```text
Create registrar pages in apps/web: student list (search, filter, pagination),
student detail, course and offering management.

Use shadcn/ui data tables and TanStack Query. Guard routes by role.
Do not modify backend code.
```

---

# Phase 3: Finance Module

### 3.1 Finance Schema
**Mode:** Ask
**Context:** `#file:prisma/schema.prisma`

```text
Add Prisma models for finance.

Models: FeeStructure, FeeItem, StudentInvoice, Payment, Receipt,
OutstandingBalance, CarryForwardBalance, TransactionLog.

Requirements:
- All amounts are Int minor units (no Float/Decimal drift)
- Currency field
- Receipt number unique and sequential
- TransactionLog is append-only (no update/delete in design)
- Relations to Term, Program/Offering, Student
- Indexes, enums (PaymentMethod, PaymentStatus), timestamps

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

### 3.4 Payment Logic
**Mode:** Edit

```text
Create PaymentService using a service-based architecture.

Features:
- Record payment (idempotency key required)
- Calculate balance after payment
- Carry forward excess payments to the next term
- Calculate outstanding balance
- Calculate fee-paid percentage per student per term
- Write a TransactionLog entry for every change

All writes in a single DB transaction. Reject negative or zero amounts.
Service only. No controller, no frontend.
```

### 3.5 Finance Tests (Run Before Receipts)
**Mode:** Edit

```text
Write unit and integration tests for the finance services.

Cases: exact payment, partial payment, overpayment carry-forward,
multiple payments, duplicate idempotency key, negative amount,
percentage rounding, concurrent payments (no lost updates),
invoice generation idempotency.

Do not change production code; list any bugs found.
```

### 3.6 Payment Controller
**Mode:** Edit

```text
Create the PaymentController and DTOs for the existing PaymentService.

Endpoints: record payment, list payments (filters), get student statement.
RBAC: bursar records; students read OWN statement only.
Add Swagger docs. Do not modify services.
```

### 3.7 Receipt Generation
**Mode:** Edit

```text
Create ReceiptService.

Features:
- Gap-free sequential receipt numbering (transaction safe)
- Printable PDF using PDFKit
- School logo watermark and school details from config
- Transaction reference on the receipt
- Store the PDF through the existing StorageService
- Re-download the same receipt without regenerating a new number

Add the controller endpoint to fetch it. No frontend.
```

### 3.8 Finance Dashboard UI
**Mode:** Edit

```text
Create bursar dashboard pages in apps/web/finance:
payment records (filter, search, pagination), outstanding balances,
receipt history with download, fee analytics (Recharts).

Use Next.js, shadcn/ui, TanStack Query. Format money from minor units.
Do not modify backend code.
```

### 3.9 Student Financial Statement UI
**Mode:** Edit

```text
Create student pages: /student/finance (balance, invoices, payments,
receipts download, payment reference number generator).
Mobile first. Read-only. Use existing endpoints only.
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
  duplicate its logic)
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

---

# Cross-Cutting Utility Prompts

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

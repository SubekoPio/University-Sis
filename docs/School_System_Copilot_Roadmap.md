# Advanced School Management System: GitHub Copilot Development Roadmap

A phased, milestone-driven roadmap for building a university/school management system with **GitHub Copilot**. Heavy modules are split into small micro-phases so Copilot gets tight context, produces fewer hallucinations, stays within premium-request limits, and every step ends in a testable, committable, **documented** result.

> **Two standing rules apply to every step in this roadmap:**
>
> 1. **Document every step** of development (what was built, why, how to run and test it).
> 2. **Always comment code**: every block, function, class, and non-obvious line (see [Section 6](#6-documentation--code-commenting-standards)).
>
> **All UI follows one brand palette** (including status and warning colors) defined in [Section 5](#5-design-system--brand-tokens).
>
> **Payments:** the live payment process is **physical**: the student pays at the bank and **Finance records the payment and issues the receipt**. Paying **online from the system (card, bank, mobile money) shows "Coming soon"** until each method is activated later behind its own feature flag (see [Phase 3](#phase-3--finance-module)).

---

## Table of Contents

1. [Vision & Scope](#1-vision--scope)
2. [Tech Stack](#2-tech-stack)
3. [Environment Strategy](#3-environment-strategy)
4. [Copilot Operating Model](#4-copilot-operating-model)
5. [Design System & Brand Tokens](#5-design-system--brand-tokens)
6. [Documentation & Code Commenting Standards](#6-documentation--code-commenting-standards)
7. [Roadmap Overview](#7-roadmap-overview)
8. [Phase 0: Foundation & Copilot Setup](#phase-0--foundation--copilot-setup)
9. [Phase 1: Authentication & RBAC](#phase-1--authentication--rbac)
10. [Phase 2: Core Academic & SIS](#phase-2--core-academic--student-information-system)
11. [Phase 3: Finance Module](#phase-3--finance-module)
12. [Phase 4: LMS & Assignments](#phase-4--lms--assignment-system)
13. [Phase 5: Examination System](#phase-5--examination-system)
14. [Phase 6: Reporting & Analytics](#phase-6--reporting--analytics)
15. [Phase 7: Hardening & Launch](#phase-7--hardening--launch)
16. [Definition of Done](#definition-of-done-per-micro-phase)
17. [Risk Register](#risk-register)

---

## 1. Vision & Scope

### Core University Management Features

| Module                               | Responsibilities                                                                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Academic Management**              | Faculties, departments, programmes, intakes, course units, curriculum, course unit selection, lecturer assignment, timetabling                                                                                          |
| **Student Information System (SIS)** | Centralized student records, admissions data, enrollment history                                                                                                                                                        |
| **Examinations & Grading**           | Exam seating, digital assessment, invigilation, GPA/transcript generation                                                                                                                                               |
| **Finance & Billing**                | Tuition fees, automated invoices, ledgers, payment records                                                                                                                                                              |
| **LMS Integration**                  | Course unit materials, assignments, and lesson plans shared by every student who selected the unit                                                                                                                      |
| **Admissions**                       | Applications (from the university website or the admission office), document review, application fee confirmation, admission to a programme, default login details sent by email. **Students never sign themselves up** |
| **Online Learning & Attendance**     | Class sessions with an embedded meeting link, an **Attend** button, online or physical study mode, and attendance measured by continuous time in the lecture                                                            |

### Student Portal Features

- **Course Units:** after admission, the course units set for your programme are **loaded automatically**. Each intake you go to the Course Units page and select the ones you are prompted to take (core units, electives, retakes, and general units shared across faculties).
- **Online learning:** open an online lecture with one click on **Attend** (the meeting link opens), or attend physically, depending on your study mode.
- **Academic Results:** results and GPA per intake, academic standing, transcripts.
- **Financial Statements:** balances, paid invoices, payment reference numbers.
- **Timetables & Attendance:** personal timetable for the selected course units and attendance records (for online lectures, based on continuous time spent in the lecture).
- **Home page:** greeting, announcement slider, calendar, selected course units, and attendance percentage. Everything else is reached through the **navigation rail** ([Section 5.5](#55-application-shell-navigation-rails--home-pages)).

---

### 1.1 Academic Domain Model (Intakes, Programmes, Course Units)

> **Terminology rule:** this system uses **intake** (never "term" or "semester"), **programme** (the degree or diploma), and **course unit** (a subject taught under programmes). Every doc, prompt, table, column, and UI label follows this.

**Structure**

```text
Application  >  Admission  >  Student
Faculty            e.g. Science & Technology, Health Sciences, Law, Business
└── Department     e.g. Computer Science
    └── Programme  e.g. BSc Computer Science
        └── Curriculum (ProgrammeCourseUnit): the course units set for the programme,
            │          by study year and intake slot, as CORE or ELECTIVE
            └── Course Unit   e.g. CSC101 Introduction to Programming
                └── Course Unit Offering: that unit delivered in ONE intake, with its lecturer(s)
                    ├── Unit selection: a student's selection of the offering
                    └── Class sessions: dated lectures (physical room and/or online meeting link)
                        └── Attendance: per student per session
```

**Key concepts**

| Concept                     | Meaning                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Intake**                  | One of **three study periods per academic year**: **Intake 1 (beginning of the year)**, **Intake 2 (mid-year)**, **Intake 3 (end of the year)**. Each has a name, start and end dates, and a selection window. Default labels are January, May, and September, but names and dates are **configuration, never hard-coded**. Selection, fees, attendance, results, and GPA all happen per intake |
| **Programme**               | The award a student is admitted to (for example BSc Computer Science). Belongs to a department                                                                                                                                                                                                                                                                                                  |
| **Course unit**             | A subject with a code, name, credit units, and level (for example CSC101). Owned by a department                                                                                                                                                                                                                                                                                                |
| **Curriculum**              | The course units **set for each programme**, by **study year** and **intake slot (1, 2, or 3)**, marked **CORE** (compulsory) or **ELECTIVE**. A programme can also set minimum and maximum elective credits                                                                                                                                                                                    |
| **General (shared) unit**   | A course unit flagged as general, open to students from **several faculties** (for example Communication Skills or Entrepreneurship for Health Sciences, Law, and Business students). It lists its eligible faculties, or is open to all                                                                                                                                                        |
| **Course unit offering**    | A course unit delivered in one intake. There is **one offering per unit per intake**, with an assigned **primary lecturer** (and optional assistants). **Every eligible student, from any programme, selects the same offering**, so they share one class, timetable, lecturer, assignments, and exam                                                                                           |
| **Application / Admission** | An applicant's request for a programme and intake, and the admin decision that turns an applicant into a student                                                                                                                                                                                                                                                                                |
| **Study mode**              | **ONLINE** or **PHYSICAL**, chosen at admission and stored on the student's programme enrollment                                                                                                                                                                                                                                                                                                |
| **Class session**           | One dated lecture of an offering: time, **physical room and/or online meeting link**                                                                                                                                                                                                                                                                                                            |
| **Attendance rule**         | Configuration that decides whether a student counts as present in a session (see below)                                                                                                                                                                                                                                                                                                         |

**Admissions: students never sign themselves up**

1. An applicant applies through the **university website** (a separate site) or at the **admission office**. Website applications reach this system through a secured integration; office applications are entered by admin staff.
2. Admin staff **review the application documents**, approving or rejecting each with a note.
3. The applicant pays the **application fee**; staff confirm it with the bank reference.
4. When the documents are approved **and** the fee is confirmed, an admin **admits** the applicant to the desired programme and intake and records the **study mode (online or physical)**.
5. The system creates the student account and **emails the default login details**. The password is temporary, and the student must change it at first login.
6. The programme's course units for the student's first study year and intake slot are **loaded automatically**.
7. There is **no public sign-up**. Staff accounts are also created by admins.

**How a student selects course units**

1. After admission the course units are already loaded for the student's programme.
2. Each intake, the student opens the **Course Units** page. The units for their current study year and intake slot are listed and they are **prompted** to select:
   - **Core units**: pre-selected and compulsory.
   - **Elective units**: choose within the programme's minimum and maximum.
   - **Retake units**: previously failed or missed units, prompted automatically.
   - **General units**: the shared pool open to the student's faculty, when the programme requires or allows them.
3. The student confirms. The system checks: selection window open, programme or faculty eligibility, prerequisites, offering capacity, timetable clashes, credit-load limits, and duplicates.
4. The student joins each offering's class list and sees the assigned lecturer and sessions.

**Online and physical learning**

| Topic                       | Rule                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Study mode**              | Set at admission. Changing it later needs an admin and a written reason (audited)                            |
| **Class sessions**          | Each session is physical (room), online (meeting link), or both                                              |
| **Online students**         | See an **Attend** button when a session is open. Clicking it records the join and **opens the meeting link** |
| **Physical students**       | See the venue; the lecturer records attendance in class                                                      |
| **Choosing to go physical** | A student can still attend a session physically; the lecturer then marks them present                        |
| **Link privacy**            | The meeting link is shown only to students selected for that offering, and only around the session time      |

**Online attendance: the continuous-time rule**

- Attendance is measured by **how long the student stays in the lecture after joining the link**.
- **On-and-off attendance does not count.** A student is **PRESENT** only if their longest **continuous** stay, merging short reconnects of up to a grace period (default 3 minutes), is at least a minimum share of the session length (default **75%**). Separate short visits are never added together.
- Both numbers are configuration (`AttendanceRule`).
- A student's attendance percentage for a course unit is sessions marked PRESENT divided by sessions held.
- Lecturers can override a result with a written reason (audited).

**Lecturers**

- The registrar (or a head of department, if you add that role) **assigns lecturer(s) to each offering, per intake**.
- A lecturer belongs to a department but can teach units in other departments, such as general units.
- A lecturer sees one class list per offering, and for a shared unit that list mixes students from different programmes and faculties.

### 1.2 Roles & Administrative Structure

A university system needs a **team of specialised administrators**, not one all-powerful "admin". The design principles:

- **One role per job function.** A user can hold several roles (permissions are the **union**). A head of department is a lecturer **plus** the HOD role, so they are not an extra person.
- **Check permissions, never role names**, in code. Roles are just bundles of permissions.
- **Separation of duties.** No single person can both create and approve a money or admissions decision.
- **The system administrator runs the platform, not the business.** `admin` manages accounts, settings, and feature flags, and has **no access to grades, money, or admissions decisions**.
- **Least privilege, deny by default.** Some roles are limited to their own records (student, lecturer), own department (HOD), or own faculty (dean).

**Role catalogue (14 roles)**

| #   | Role (key)                 | Job function                                                                                                                   | First needed                             |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| 1   | `student`                  | Own programme, course units, timetable, attendance, results, statements                                                        | Phase 1 (built)                          |
| 2   | `lecturer`                 | Own offerings, class lists, sessions and meeting links, attendance, marks                                                      | Phase 1 (built)                          |
| 3   | `admin`                    | **System administrator**: staff accounts and roles, system settings, feature flags, audit log                                  | Phase 1 (built)                          |
| 4   | `admissions_officer`       | Enters applications at the admission office, reviews documents                                                                 | Phase 2                                  |
| 5   | `admissions_head`          | **Admits** applicants (with study mode), rejects, approves study mode changes                                                  | Phase 2                                  |
| 6   | `registrar`                | Programmes, intakes, course units, curriculum, offerings, lecturer assignment, student records, progression, publishes results | Phase 1 (built), grows in Phases 2 and 5 |
| 7   | `bursar` (Finance Officer) | Records bank deposits, issues receipts, confirms application fees                                                              | Phase 1 (built), used from Phase 2       |
| 8   | `finance_manager`          | Fee structures, **voids payments**, reconciliation, finance reports                                                            | Phase 3                                  |
| 9   | `hod` (Head of Department) | Own department: assigns lecturers, moderates marks, department reports                                                         | Phase 2 (optional) to Phase 5            |
| 10  | `dean` (Faculty Dean)      | Own faculty: faculty reports, approves curriculum changes and results moderation                                               | Phase 5 to 6                             |
| 11  | `exams_officer`            | Exam scheduling, eligibility overrides (with registrar), results checks                                                        | Phase 5                                  |
| 12  | `communications_officer`   | Campus-wide announcements and calendar                                                                                         | Phase 2 (optional)                       |
| 13  | `support_desk`             | Resend login details, unlock accounts, view account status; **no academic or finance data**                                    | Phase 2 to 7                             |
| 14  | `auditor`                  | **Read-only** on finance, admissions, and the audit log                                                                        | Phase 7                                  |

**Start with 8, grow to 14.** Roles 1 to 8 cover everything built through Phase 3 (the first five already exist from Phase 1). Add the other six as their phases arrive.

**How many people? (planning estimates)**

These are rules of thumb, not measured data. Small is about 2,000 students or fewer with 1 to 2 faculties; medium is 2,000 to 10,000 with 4 to 6 faculties; large is over 10,000. Adjust to your numbers.

| Role                                             | Small                             | Medium             | Large               |
| ------------------------------------------------ | --------------------------------- | ------------------ | ------------------- |
| `admin` (system administrators)                  | 2                                 | 2 to 3             | 3 to 5              |
| `admissions_officer`                             | 1 to 2                            | 3 to 5             | 8 to 15             |
| `admissions_head`                                | 1                                 | 1 to 2             | 2 to 3              |
| `registrar` team                                 | 1 to 2                            | 3 to 5             | 6 to 10             |
| `bursar` (finance officers)                      | 2 to 3                            | 4 to 8             | 10 to 20            |
| `finance_manager`                                | 1                                 | 1 to 2             | 2 to 4              |
| `dean` (one per faculty)                         | 1 to 2                            | 4 to 6             | 8 to 12             |
| `hod` (one per department)                       | 3 to 6                            | 12 to 25           | 30 to 40            |
| `exams_officer`                                  | 1                                 | 2 to 4             | 5 to 10             |
| `communications_officer`                         | 0 to 1                            | 1 to 2             | 2 to 4              |
| `support_desk`                                   | 1                                 | 2 to 3             | 5 to 10             |
| `auditor`                                        | 0 to 1 (can be external)          | 1 to 2             | 2 to 4              |
| **Total staff accounts with an admin-type role** | **about 14 to 23**                | **about 35 to 65** | **about 80 to 140** |
| `lecturer` / `student`                           | all academic staff / all students |                    |                     |

Only **2 to 3 of these are system administrators** (always at least two, so there is a backup). Most of the total is deans and heads of department, who are usually lecturers with an extra role.

**Separation of duties (rules the system enforces)**

| Rule                                                                                                                               | Why                                       |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| The person who **records** a payment cannot **void** it; voids need `finance_manager` and a different person                       | Stops a cashier hiding a mistake or theft |
| The person who **reviews** application documents cannot be the one who **admits**                                                  | Prevents fake admissions                  |
| `admin` has **no** grades, money, or admissions permissions                                                                        | IT staff cannot change business data      |
| Granting or removing the `admin` role needs a **second admin**                                                                     | Prevents a silent takeover                |
| Lecturers enter marks, the HOD or exams officer moderates, the registrar publishes (Phase 5)                                       | Protects the integrity of results         |
| `auditor` is read-only                                                                                                             | Independence                              |
| Online payment flags are switched on only by `admin`, with a written approval reason                                               | Controlled go-live                        |
| Privileged roles (`admin`, `finance_manager`, `bursar`, `registrar`, `admissions_head`) require **multi-factor sign-in** (Phase 7) | Protects the highest-risk accounts        |

**Good practice:** one individual account per person (no shared logins), an **access review every intake** (who holds which role, confirmed by their manager), and immediate deactivation when staff leave. The matrix itself lives in `docs/RBAC_MATRIX.md` and `docs/ROLES.md` (Phase 0 update 0.10).

---

## 2. Tech Stack

| Layer                 | Top Choice                                               | Why It Works Best                                                                                          |
| --------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Frontend (Portal)** | **Next.js (React)** + **Tailwind CSS**                   | Fast loads, mobile-responsive for students on smartphones, SSR for dashboards                              |
| **Backend (API)**     | **NestJS (Node.js)** or **Django (Python)**              | NestJS enforces clean architecture for complex modules; Django offers a built-in admin and strong security |
| **Database**          | **PostgreSQL**                                           | ACID compliance keeps grades and fee balances consistent                                                   |
| **ORM**               | **Prisma** (NestJS path)                                 | Typed schema, migrations, great Copilot context                                                            |
| **Caching & Queues**  | **Redis**                                                | Absorbs spikes on registration and results days                                                            |
| **Authentication**    | **Keycloak** or **Auth0**                                | RBAC separating students, lecturers, bursars, registrars                                                   |
| **Cloud & Storage**   | **AWS / DigitalOcean** + **S3**                          | Scalable hosting and secure object storage for IDs, transcripts, PDFs                                      |
| **Email**             | **Resend**                                               | Verification and recovery emails                                                                           |
| **UI Kit**            | **shadcn/ui**, React Hook Form, TanStack Query, Recharts | Consistent, composable frontend                                                                            |
| **CI/CD**             | **GitHub Actions**                                       | Native fit with Copilot and the GitHub workflow                                                            |

---

## 3. Environment Strategy

| Stage              | Storage                                    | Purpose                                                           |
| ------------------ | ------------------------------------------ | ----------------------------------------------------------------- |
| **Local Dev**      | **MinIO** (Docker)                         | Same API as S3, zero cost; upload photos and PDFs locally         |
| **Staging / Demo** | **Cloudflare R2** (10 GB free) or Supabase | Show the portal online to stakeholders                            |
| **Production**     | Paid **Cloudflare R2** or **AWS S3**       | Swap environment variables only, with no application code changes |

> Keep storage behind an interface (`StorageService`) so switching providers is purely configuration.

---

## 4. Copilot Operating Model

### 4.1 Pick the Right Copilot Mode

| Mode                                  | Use It For                                                                                        | Avoid It For                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Inline completions**                | Boilerplate, DTOs, small functions, repetitive tests                                              | Architecture decisions                                                   |
| **Ask (Chat)**                        | Explaining code, design questions, reviewing a plan                                               | Generating many files                                                    |
| **Edit mode**                         | Targeted multi-file changes in files you explicitly select                                        | Open-ended refactors                                                     |
| **Agent mode**                        | Well-scoped tasks with clear acceptance criteria, **after** the schema and conventions are stable | Early exploration; schema design; anything touching many modules at once |
| **Copilot coding agent** (issue → PR) | Isolated, well-specified issues (tests, CRUD endpoints, docs)                                     | Ambiguous or security-critical work                                      |
| **Copilot code review**               | A first-pass review on every pull request                                                         | Replacing human review of finance and auth logic                         |

### 4.2 Prompting Rules

1. **Never generate frontend and backend together.**
2. **Separate Prisma schema generation from APIs.**
3. **Generate services separately from controllers.**
4. **Generate RBAC and validation separately.**
5. **Generate tests separately.**
6. **Avoid Agent mode during early development;** use Ask and Edit until conventions are locked.
7. **Keep prompts under ~250 words.**
8. **Attach context explicitly** using `#file`, `#selection`, or `@workspace`, and always include `RBAC_MATRIX.md` and `DATABASE_SCHEMA.md`.
9. **Say what NOT to do:** "Do not modify existing files. Do not generate APIs yet."
10. **Commit after every successful micro-phase.**
11. **Start a fresh chat per micro-phase** to keep context clean and avoid drift.
12. **Review diffs before accepting.** Never accept large generated files blindly.
13. **Always require code comments.** Every prompt must result in commented code (file header, doc-comments on every function/class, block comments on logic). The rule lives in `copilot-instructions.md` and is repeated in each prompt footer.
14. **Document every step.** After each micro-phase, run the step-documentation prompt and commit the result with the code.
15. **Frontend prompts must reference `#file:docs/DESIGN_SYSTEM.md`** and use only the semantic color tokens, never raw hex values.

### 4.3 Repository Instruction Files

Give Copilot persistent project knowledge so you do not repeat yourself in every prompt.

```text
.github/
├── copilot-instructions.md          # Repo-wide conventions (always applied)
├── instructions/
│   ├── backend.instructions.md      # applyTo: "apps/api/**"
│   ├── frontend.instructions.md     # applyTo: "apps/web/**"
│   ├── prisma.instructions.md       # applyTo: "**/*.prisma"
│   └── tests.instructions.md        # applyTo: "**/*.spec.ts"
├── prompts/                         # Reusable prompt files, one per micro-phase
│   ├── 01-prisma-auth.prompt.md
│   ├── 02-auth-services.prompt.md
│   └── ...
└── workflows/                       # GitHub Actions (CI)
docs/
├── RBAC_MATRIX.md
├── DATABASE_SCHEMA.md
├── ARCHITECTURE.md
├── API_CONVENTIONS.md
├── DESIGN_SYSTEM.md                 # Brand tokens and UI rules (Section 5)
├── DEVELOPMENT_LOG.md               # Chronological log: one entry per step
├── CHANGELOG.md                     # Release-level changes
├── adr/                             # Architecture Decision Records (0001-*.md ...)
└── phases/
    ├── phase-0/                     # One folder per phase
    └── phase-1/
        ├── step-1.1-prisma-schema.md   # One doc per micro-phase step
        └── step-1.2-migration-seed.md
```

**Example `.github/copilot-instructions.md`:**

```markdown
# Project Conventions

- Monorepo: apps/api (NestJS), apps/web (Next.js), packages/shared.
- TypeScript strict mode. No `any`.
- Backend layering: Controller → Service → Repository (Prisma). Controllers hold no business logic.
- All DTOs validated with class-validator. All endpoints guarded by RBAC decorators.
- Money is stored as integer minor units (never floats).
- Terminology: use "intake" (never "term" or "semester"), "programme", and
  "course unit". Three intakes per academic year. See docs/ACADEMIC_MODEL.md.
- Never regenerate or overwrite existing files unless explicitly asked.
- Every service ships with a matching *.spec.ts in a separate step.
- Read docs/RBAC_MATRIX.md and docs/DATABASE_SCHEMA.md before generating code.

# Commenting (mandatory, no exceptions)

- Every file starts with a header comment: purpose, module, and who/what uses it.
- Every exported class, function, DTO, and React component has a TSDoc block
  (summary, @param, @returns, @throws).
- Add a short comment above every logical block explaining WHY, not just WHAT.
- Reference the business rule being enforced (e.g. "Rule: min 60% fees paid").
- Prisma models and fields use /// doc comments.
- Tests use Arrange / Act / Assert comments.
- Do not delete existing comments; update them when behavior changes.

# Documentation (mandatory)

- After each micro-phase, produce docs/phases/phase-N/step-N.M-<name>.md
  and append an entry to docs/DEVELOPMENT_LOG.md.

# UI / Brand

- Use only the semantic color tokens in docs/DESIGN_SYSTEM.md
  (brand, accent, badge, surface, card, ink, line, field, success, warning, error, info
  and their -soft tints). Never hardcode hex values.

# Payments

- ACTIVE: physical payments. The student pays at the bank; Finance records the
  deposit (bank, deposit-slip reference, amount, date) and the system issues a receipt.
- COMING SOON: online card, bank, and mobile-money payments. Each is behind its own
  feature flag (payments.online.card / .bank / .mobile), default OFF. While OFF the API
  returns 403 FEATURE_DISABLED with comingSoon: true and the UI shows a "Coming soon"
  badge. Never enable these flags in code or seed data.
```

### 4.4 Reusable Prompt File Template

Store each micro-phase prompt as `.github/prompts/<name>.prompt.md` so it is versioned, reviewable, and reusable.

```markdown
---
mode: "ask"
description: "Phase 1, Step 1: Prisma schema for auth and RBAC"
---

Context: #file:docs/DATABASE_SCHEMA.md #file:docs/RBAC_MATRIX.md

Create Prisma models for authentication and RBAC:

- users, roles, permissions, sessions
- password_reset_tokens, email_verification_tokens

Include relationships, indexes, enums, timestamps.
Constraints: do NOT generate APIs. Do NOT modify existing models.
```

### 4.5 Quota Management

- Use the lighter included model for boilerplate and completions; reserve premium models for architecture, complex finance logic, and debugging.
- Prefer Edit mode with narrow file selection over Agent mode, which can consume far more requests.
- Batch related questions into one prompt instead of many small ones.
- Check your Copilot usage dashboard weekly and adjust.

---

## 5. Design System & Brand Tokens

All frontends (Phases 1 to 6) follow a single palette. These tokens are the **single source of truth**: they live in `docs/DESIGN_SYSTEM.md`, are implemented once in the Tailwind theme and global CSS, and are referenced in components by **semantic name**, never by raw hex value.

### 5.1 Color Tokens

| Token     | Hex       | Name              | Role                                                                            |
| --------- | --------- | ----------------- | ------------------------------------------------------------------------------- |
| `brand`   | `#312E81` | Deep Indigo       | Primary brand color: the **navigation rail**, page titles, active-state accents |
| `accent`  | `#4F46E5` | Electric Indigo   | Interactive accent: **primary CTAs** (buttons), links, focus rings              |
| `badge`   | `#0D9488` | Teal              | **GPA and attendance badges** and other positive academic indicators            |
| `surface` | `#F9FAFB` | Soft Neutral Gray | Page background                                                                 |
| `card`    | `#FFFFFF` | White             | Cards, tables, modals, form panels                                              |
| `ink`     | `#111827` | Charcoal          | Body text and headings on light surfaces                                        |
| `line`    | `#E5E7EB` | Border Gray       | Borders, dividers, table rules                                                  |

### 5.1b Status & Warning Tokens

Added to cover success, caution, error, and informational states (payment failures, exam blocking, deadline warnings, "coming soon" notices, form validation). Each status has a **strong** color (text, icons, borders) and a **soft** tint (banner and badge backgrounds).

| Token          | Hex       | Name                               | Role                                                               |
| -------------- | --------- | ---------------------------------- | ------------------------------------------------------------------ |
| `success`      | `#15803D` | Green                              | Positive status: paid, approved, published, saved                  |
| `success-soft` | `#DCFCE7` | Green Tint                         | Background for success banners and chips                           |
| `warning`      | `#B45309` | Amber                              | Caution: approaching deadline, low attendance, eligibility at risk |
| `warning-soft` | `#FEF3C7` | Amber Tint                         | Background for warning banners and chips                           |
| `error`        | `#B91C1C` | Red                                | Errors, failed actions, blocked exams, destructive buttons         |
| `error-soft`   | `#FEE2E2` | Red Tint                           | Background for error banners and field errors                      |
| `info`         | `#4F46E5` | Electric Indigo (same as `accent`) | Neutral notices, including **"Coming soon"** badges and banners    |
| `info-soft`    | `#EEF2FF` | Indigo Tint                        | Background for info banners                                        |
| `field`        | `#6B7280` | Field Gray                         | Input and form-control borders (meets 3:1 non-text contrast)       |

### 5.2 Usage Rules

| Element                  | Rule                                                                                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Navigation rail**      | Background `brand`; white icons and labels; the active item uses a translucent white overlay (no new colors)                                                                                                                                                |
| **Primary CTA**          | Background `accent`, white text; limit to **one primary CTA per view**; hover and pressed states use brightness changes, not new hues                                                                                                                       |
| **Badges**               | `badge` (teal) is **reserved** for GPA and attendance indicators. Do not use it for generic buttons or alerts                                                                                                                                               |
| **Page and cards**       | Page background `surface`; content sits on `card` with a 1px `line` border                                                                                                                                                                                  |
| **Text**                 | `ink` for primary text; secondary text uses `ink` at reduced opacity (for example `text-ink/70`) instead of introducing a new gray                                                                                                                          |
| **Charts (Recharts)**    | Primary series `accent`, secondary series `badge`; any additional series colors must be added to `DESIGN_SYSTEM.md` before use                                                                                                                              |
| **Focus**                | Visible focus ring in `accent` on every interactive element                                                                                                                                                                                                 |
| **Status messages**      | Pair the strong color with its soft tint, an **icon**, and a **text label** (never color alone). Example: `error` text and icon on an `error-soft` banner                                                                                                   |
| **Teal vs green**        | `badge` (teal) stays reserved for GPA and attendance. Use `success` (green) for paid, approved, and published states. Low attendance uses `warning`, not teal                                                                                               |
| **Destructive actions**  | Delete, revoke, and reject buttons use `error`; a screen still has only one primary CTA (`accent`)                                                                                                                                                          |
| **Coming-soon features** | Show a "Coming soon" badge (`info` text on `info-soft`) and a disabled control using `line` background with `ink` at reduced opacity, plus a short message pointing to the available alternative; never hide the option, break the layout, or show an error |
| **Form fields**          | Border `field`; error state uses `error` border plus message; focus uses `accent` ring                                                                                                                                                                      |

### 5.3 Accessibility Notes

Approximate contrast ratios against white or the stated background:

| Pairing                                     | Ratio               | Verdict                                                                                                                                       |
| ------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| White on `brand`                            | about 11:1          | Passes AA and AAA                                                                                                                             |
| White on `accent`                           | about 6.3:1         | Passes AA                                                                                                                                     |
| `ink` on `surface`                          | about 17:1          | Passes AAA                                                                                                                                    |
| White on `badge` (teal)                     | about 3.7:1         | **Below 4.5:1 for small text.** Use only for large or bold text (14pt bold or larger), or always pair the badge with an icon and a text label |
| `line` as a form-field border               | about 1.2:1         | Fine for decorative dividers only; **input borders use `field` instead**                                                                      |
| `field` border on white                     | about 4.8:1         | Passes the 3:1 non-text requirement                                                                                                           |
| `success` text on white / on `success-soft` | about 5.0:1 / 4.6:1 | Passes AA                                                                                                                                     |
| `warning` text on white / on `warning-soft` | about 5.0:1 / 4.5:1 | Passes AA (narrow margin on the tint; do not go lighter)                                                                                      |
| `error` text on white / on `error-soft`     | about 6.5:1 / 5.3:1 | Passes AA                                                                                                                                     |
| `accent` (info) text on `info-soft`         | about 5.6:1         | Passes AA                                                                                                                                     |

> **Note:** status colors are never the only signal. Every status also carries an icon and a text label so it is readable by users with color-vision differences.

### 5.4 Implementation (Tailwind + CSS Variables)

**`apps/web/tailwind.config.ts`**

```ts
// apps/web/tailwind.config.ts
// Single source of truth for brand colors.
// Components MUST use these semantic names (bg-brand, text-ink, ...)
// and never raw hex values, so a rebrand is a one-file change.
import type { Config } from "tailwindcss";

const config: Config = {
  // Tell Tailwind where to look for class names
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#312E81", // Deep Indigo: navigation rail
        accent: "#4F46E5", // Electric Indigo: primary CTAs, links, focus rings
        badge: "#0D9488", // Teal: GPA / attendance badges only
        surface: "#F9FAFB", // Soft Neutral Gray: page background
        card: "#FFFFFF", // Cards, tables, modals
        ink: "#111827", // Charcoal: text
        line: "#E5E7EB", // Borders and dividers
        field: "#6B7280", // Input / form-control borders (3:1+ contrast)

        // ---- Status & warning colors (strong = text/icons, soft = backgrounds) ----
        success: { DEFAULT: "#15803D", soft: "#DCFCE7" }, // paid, approved, published
        warning: { DEFAULT: "#B45309", soft: "#FEF3C7" }, // caution, at-risk, near deadline
        error: { DEFAULT: "#B91C1C", soft: "#FEE2E2" }, // failures, blocked, destructive
        info: { DEFAULT: "#4F46E5", soft: "#EEF2FF" }, // notices, "coming soon"
      },
    },
  },
  plugins: [],
};

export default config;
```

**`apps/web/src/app/globals.css`** (maps the tokens onto shadcn/ui's semantic variables)

```css
/* apps/web/src/app/globals.css
   Map brand tokens onto the CSS variables shadcn/ui components read.
   NOTE: the exact variable format (HSL triplet vs full color value) depends on
   your shadcn/ui version. Keep the generated format and convert the hex values. */
:root {
  --background: #f9fafb; /* surface: page background */
  --foreground: #111827; /* ink: default text */
  --card: #ffffff; /* card: panels, tables, modals */
  --card-foreground: #111827; /* ink on cards */
  --primary: #4f46e5; /* accent: primary buttons */
  --primary-foreground: #ffffff; /* text on primary buttons */
  --border: #e5e7eb; /* line: borders and dividers */
  --ring: #4f46e5; /* accent: focus ring */
  --sidebar: #312e81; /* brand: navigation rail */
  --sidebar-foreground: #ffffff; /* text and icons on the rail */
  --badge: #0d9488; /* GPA / attendance badges */

  /* Status colors (strong for text/icons, soft for backgrounds) */
  --input: #6b7280; /* field: input borders */
  --success: #15803d;
  --success-soft: #dcfce7;
  --warning: #b45309;
  --warning-soft: #fef3c7;
  --destructive: #b91c1c; /* shadcn's name for the error color */
  --destructive-soft: #fee2e2;
  --info: #4f46e5;
  --info-soft: #eef2ff;
}
```

> Tailwind v4 projects declare the same tokens with an `@theme` block in CSS instead of `tailwind.config.ts`. Use whichever matches your installed version.

### 5.5 Application Shell, Navigation Rails & Home Pages

Every screen lives inside one shared **app shell**, so no phase invents its own layout. The shell is built once, in Phase 2 (steps 2.18 to 2.20), and later phases only **add navigation items and calendar events** to it.

**App shell**

| Part                   | Behavior                                                                                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Navigation rail**    | Left side, background `brand` (`#312E81`), white icons and labels. The active item uses a translucent white overlay and `aria-current="page"`. It collapses to an icon-only rail with tooltips. Items are grouped under small section labels |
| **Mobile**             | The rail becomes a slide-over drawer opened from a menu button in the top bar (students are mostly on phones)                                                                                                                                |
| **Top bar**            | Current intake label on the left; **profile icon** (photo, or initials on an `accent` circle) on the right, opening a menu: Profile, Settings, Sign out, and a role switcher for users with more than one role                               |
| **Content area**       | Background `surface`; content on `card` panels with `line` borders                                                                                                                                                                           |
| **Role routing**       | After login, users land on their own home: `/student`, `/lecturer`, `/finance`, `/registrar`, `/admissions`, `/admin`. Visiting another role's route shows a `403` page                                                                      |
| **Config-driven menu** | One `nav.config.ts` lists each role's items (label, icon, route, required permission, `enabled`). An item for a module that is not built yet has `enabled: false` and is not shown; each phase switches on its own items                     |
| **Accessibility**      | Skip-to-content link, `nav` landmark, full keyboard support, visible `accent` focus ring                                                                                                                                                     |

**Navigation rail items by role** (an item appears when its phase ships)

| Role                             | Phase 2 items                                                                                                                                          | Added later                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| **Student**                      | Home, My Programme, **Course Units** (select and view), Timetable, Attendance, Announcements                                                           | Finance (Phase 3), Assignments & Materials (Phase 4), Exams & Results, Transcript (Phase 5)                     |
| **Lecturer**                     | Home, My Course Units, Class Sessions (meeting links), Attendance, Announcements                                                                       | Assignments and Grading (Phase 4), Exams & Marks (Phase 5)                                                      |
| **Registrar**                    | Home, Faculties & Departments, Programmes, Intakes, Course Units, Curriculum, Offerings & Lecturers, Class Sessions, Students, Announcements, Calendar | Results & Transcripts (Phase 5), Reports (Phase 6)                                                              |
| **Admin** (system administrator) | Home, Users (staff accounts and roles)                                                                                                                 | Feature Flags (Phase 3), Audit Log (Phase 7)                                                                    |
| **Admissions officer**           | Home, Applications                                                                                                                                     |                                                                                                                 |
| **Admissions head**              | Home, Applications (with Admit), Study Mode Changes                                                                                                    |                                                                                                                 |
| **Finance (bursar)**             | Application Fees (Home arrives in Phase 3)                                                                                                             | Fee Structures, Invoices, Record Payment, Payments, Receipts, Daily Deposit Report (Phase 3), Reports (Phase 6) |

**Student home page** (`/student`)

The home page shows **only** the items below. Fees, results, GPA, assignments, and everything else are reached through the navigation rail.

```text
┌──────┬────────────────────────────────────────────────────────────────┐
│      │ Top bar:  Intake 1, 2026                           (profile)   │
│  N   ├────────────────────────────────────────────────────────────────┤
│  A   │ HERO (brand background)                                        │
│  V   │  (profile icon)  Good morning, Grace    ┌────────────────────┐ │
│      │  BSc Computer Science, Intake 1         │ Announcement slide │ │
│  R   │                                         │   <   * o o o   >  │ │
│  A   │                                         └────────────────────┘ │
│  I   ├───────────────────────────────────┬────────────────────────────┤
│  L   │ CALENDAR                          │ MY COURSE UNITS            │
│      │ month view + day agenda           │ CSC101  Intro to Prog...   │
│      │                                   │ ATTENDANCE   86%  (teal)   │
└──────┴───────────────────────────────────┴────────────────────────────┘
```

| Section                   | Content                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hero**                  | Background `brand`. **Profile icon** (links to profile), **time-of-day greeting** with the student's first name, and the programme and current intake underneath. Beside it, the **announcements slider** (below)                                                                                                                                                                                       |
| **Announcements slider**  | Up to 5 slides, pinned first, then newest. Each slide has a category badge, title, short excerpt, an optional image, and **Read more** (opens the full announcement). Arrows, dots, swipe on mobile, auto-advance every 6 seconds, paused on hover and keyboard focus, and **no auto-advance when the user prefers reduced motion**. Empty state: "No announcements right now"                          |
| **Calendar**              | Month view with event markers and a **day agenda** listing that day's classes (from the student's selected course units, with **Attend** for open online sessions), intake and registration dates, and academic calendar events. Event types are told apart by **icon and label**, not color alone. Assignment deadlines (Phase 4) and exam dates (Phase 5) appear automatically when those phases ship |
| **My course units**       | The units the student selected for the current intake: code, name, lecturer, next class. For an **online student**, the next class shows an **Attend** button when the session is open (it opens the meeting link); a physical student sees the venue. If no units are selected and the selection window is open, a **Select course units** button is shown                                             |
| **Attendance percentage** | One overall percentage (sessions present divided by sessions held, using the continuous-time rule for online lectures) in a **teal badge**. If it falls below the configured minimum (default 75%, configurable), the badge switches to the **warning** style with an icon and the text "Below minimum". Small per-unit percentages underneath. Before any session: "No sessions yet"                   |

**Layout:** on desktop the hero spans the full width, with the calendar on the left and, on the right, My course units above Attendance. On mobile the order is hero, attendance, course units, calendar. The page loads from a **single aggregated request** (`GET /me/home`) with skeleton loading and a retry state.

**Other role home pages** (same hero and calendar pattern; confirm the widgets)

| Role                              | Role-specific widgets beside the hero and calendar                                                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lecturer**                      | My course units this intake (with student counts) and today's classes                                                                                                            |
| **Registrar**                     | Current intake status and course unit selection progress; "needs attention" items in warning style (offerings without a lecturer, admitted students who have not selected units) |
| **Admissions (officer and head)** | Applications awaiting review, awaiting fee confirmation, and ready to admit                                                                                                      |
| **Admin**                         | Accounts needing attention (expired temporary passwords, deactivated users)                                                                                                      |
| **Finance**                       | Today's recorded deposits, applications awaiting fee confirmation, and a link to the daily bank-deposit report (built in Phase 3)                                                |

**Announcements and calendar (backend, Phase 2)**

| Feature             | Design                                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Announcements**   | Title, body, optional image, category (General, Academic, Finance, Exam, Event), pinned flag, publish and expiry dates, draft/published/archived status                            |
| **Audience**        | All students, all lecturers, a role, a faculty, a programme, an intake, or a **course unit offering**. A student sees an announcement if any audience rule matches them            |
| **Who can post**    | Registrar and admin: any audience. Lecturer: only their own course unit offerings. Finance: Finance-category notices                                                               |
| **Safety**          | The body is sanitized on the server so scripts cannot be injected; images go through `StorageService`                                                                              |
| **Calendar events** | Academic calendar entries (holidays, academic events, registration dates, general events) with audience rules. **Intake dates and timetable sessions are derived**, not duplicated |
| **Extensible**      | Each later module registers a `CalendarEventProvider` (assignment deadlines in Phase 4, exam dates in Phase 5), so the calendar grows without changing the home page               |

---

## 6. Documentation & Code Commenting Standards

> **Rule 1: Document every step of development.**
> **Rule 2: Always comment code, in every block and wherever clarity is needed.**

Both rules are enforced by the Copilot instruction files, the PR template, linting, and the Definition of Done.

### 6.1 What Gets Documented

| Artifact                         | Location                                                  | When                                                                |
| -------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------- |
| **Step document**                | `docs/phases/phase-N/step-N.M-<name>.md`                  | At the end of **every** micro-phase                                 |
| **Development log entry**        | `docs/DEVELOPMENT_LOG.md`                                 | Every step (newest first)                                           |
| **Architecture Decision Record** | `docs/adr/NNNN-<decision>.md`                             | Whenever a significant choice is made (library, pattern, trade-off) |
| **Schema and RBAC docs**         | `docs/DATABASE_SCHEMA.md`, `docs/RBAC_MATRIX.md`          | Whenever models or permissions change                               |
| **API docs**                     | OpenAPI/Swagger decorators plus `docs/API_CONVENTIONS.md` | Alongside each endpoint                                             |
| **Design tokens**                | `docs/DESIGN_SYSTEM.md`                                   | Whenever UI tokens or patterns change                               |
| **Changelog**                    | `docs/CHANGELOG.md`                                       | At each release or phase completion                                 |
| **Runbooks**                     | `docs/RUNBOOK.md`                                         | Deployment, backup, rollback, incidents                             |

### 6.2 Step Document Template

Every micro-phase ends with a document in this shape (Copilot drafts it; a human reviews it):

```markdown
# Step 3.4: Payment Logic

- **Phase / Step:** Phase 3, Step 4
- **Date / Author:** YYYY-MM-DD, <name>
- **Branch / PR:** feature/finance-payment-logic, #42

## Goal

One or two sentences on what this step delivers and why it exists.

## What Was Built

- Files created or changed (with paths)
- Public functions/endpoints added

## Key Decisions & Trade-offs

- Decision, alternatives considered, reason chosen (link ADR if one exists)

## Business Rules Implemented

- e.g. "Overpayments carry forward to the next intake"

## How to Run & Test

- Exact commands (migrate, seed, test) and expected output

## Data / Permissions Impact

- Tables or columns touched; roles affected (RBAC_MATRIX.md updated: yes/no)

## Known Limitations & Follow-ups

- Anything deferred, with a TODO reference

## Copilot Usage

- Prompt file used, mode, and what needed manual correction
```

### 6.3 Code Commenting Rules

| Where                                                    | Required comment                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Every file**                                           | Header comment: purpose, module, and what depends on it                                                 |
| **Every exported class, function, DTO, hook, component** | TSDoc block with summary, `@param`, `@returns`, `@throws` (and prop descriptions for components)        |
| **Every logical block**                                  | A short comment above it explaining **why** it exists, not a restatement of the code                    |
| **Business rules**                                       | Name the rule in the comment (for example "Rule: students need at least 60% of fees paid to sit exams") |
| **Prisma models and fields**                             | `///` doc comments (they also flow into generated docs and types)                                       |
| **Complex queries, regexes, math**                       | Step-by-step comment with an example input and output                                                   |
| **Security-sensitive code**                              | Comment the threat being prevented (for example "prevents IDOR: user may only read OWN record")         |
| **Workarounds and TODOs**                                | `// TODO(name, #issue): what and why`; never leave a bare TODO                                          |
| **Tests**                                                | Arrange / Act / Assert comments and a sentence describing the scenario                                  |
| **Config, env vars, Docker, CI**                         | Comment every non-obvious setting and unit                                                              |

**Do not** comment the trivially obvious (`i++ // add one`), leave stale comments after behavior changes, or delete existing comments without replacing them.

### 6.4 Example: The Expected Commenting Style

```ts
// apps/api/src/finance/payment.service.ts
// Purpose: records bank-deposit payments entered by Finance and keeps balances consistent.
// Used by: PaymentController, ExamEligibilityService (fee-percentage check).
// NOTE: online methods (card, bank, mobile) are COMING SOON; see OnlinePaymentController.

import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RecordBankDepositDto } from "./dto/record-bank-deposit.dto";

/**
 * Handles payments that Finance records after a student pays at the bank.
 * All amounts are integers in minor units (e.g. cents) to avoid float drift.
 */
@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a bank-deposit payment so a receipt can be issued.
   *
   * @param dto - Student, invoice, amount, bank name, deposit-slip reference, deposit date.
   * @param recordedById - The finance officer entering the payment (audit trail).
   * @returns The stored payment.
   * @throws BadRequestException if the amount is not a positive integer.
   * @throws ConflictException if this deposit slip was already recorded.
   */
  async recordBankDeposit(dto: RecordBankDepositDto, recordedById: string) {
    // Rule: payments must be positive whole minor units.
    if (!Number.isInteger(dto.amountMinor) || dto.amountMinor <= 0) {
      throw new BadRequestException("Amount must be a positive integer.");
    }

    // Run every write in ONE transaction so a failure can never leave a
    // payment saved without its balance update and audit log entry.
    return this.prisma.$transaction(async (tx) => {
      // 1. Duplicate protection: one bank deposit slip may be recorded only once.
      const duplicate = await tx.payment.findFirst({
        where: { bankName: dto.bankName, bankReference: dto.bankReference },
      });
      if (duplicate) {
        throw new ConflictException("This deposit slip has already been recorded.");
      }

      // 2. Persist the payment; the method is fixed because this is the physical flow.
      const payment = await tx.payment.create({
        data: { ...dto, method: "BANK_DEPOSIT", recordedById },
      });

      // 3. Append to the immutable transaction log (audit trail).
      await tx.transactionLog.create({
        data: { paymentId: payment.id, action: "PAYMENT_RECORDED", actorId: recordedById },
      });

      return payment;
    });
  }
}
```

```ts
// apps/api/src/finance/online-payment.controller.ts
// Purpose: entry points for online payments. Card, bank and mobile are COMING SOON.

@Controller("payments/online")
export class OnlinePaymentController {
  constructor(private readonly onlinePayments: OnlinePaymentService) {}

  /**
   * Starts an online payment for the chosen method.
   * While the method's flag (payments.online.<method>) is OFF, the guard answers
   * 403 { code: "FEATURE_DISABLED", comingSoon: true } and this body never runs.
   */
  @Post(":method/initiate")
  @UseGuards(JwtAuthGuard, OnlineMethodFlagGuard)
  initiate(@Param("method") method: OnlineMethod, @CurrentUser() user: AuthUser) {
    // Reached only after this method has been activated and its gateway integrated.
    return this.onlinePayments.initiate(method, user.id);
  }
}
```

### 6.5 Enforcement

| Mechanism                | How                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **Copilot instructions** | The commenting, documentation, and brand rules in `.github/copilot-instructions.md` apply to every chat automatically |
| **Prompt footers**       | Every prompt in the prompt library ends with the mandatory comment and documentation rule                             |
| **Linting**              | `eslint-plugin-jsdoc` (require doc blocks on exported members) plus a lint rule against raw hex colors in components  |
| **PR template**          | Checklist: step doc added, log updated, code commented, schema and RBAC docs updated                                  |
| **CI check**             | Optional job that fails a PR when `src/` changes without a matching change under `docs/`                              |
| **Copilot code review**  | Configure review instructions to flag uncommented or undocumented code                                                |

---

## 7. Roadmap Overview

### Progress Tracker

| Phase                                    | Status                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 0 Foundation & Copilot Setup             | **Complete** (original build). **Updates 0.10 to 0.15 to run first** (they define the role model) |
| 1 Authentication & RBAC                  | **Complete** (original build). **Updates 1.10 to 1.16 to run before Phase 2**                     |
| 2 Academic structure, course units & SIS | **NEXT: not started**                                                                             |
| 3 to 7                                   | Not started                                                                                       |

```mermaid
gantt
    title Development Roadmap (indicative)
    dateFormat  YYYY-MM-DD
    section Foundation
    Phase 0 Foundation & Copilot Setup :p0, 2026-01-01, 10d
    section Core
    Phase 1 Auth & RBAC                :p1, after p0, 21d
    Phase 2 Academic Structure & SIS     :p2, after p1, 35d
    section Business Modules
    Phase 3 Finance                    :p3, after p2, 28d
    Phase 4 LMS & Assignments          :p4, after p3, 28d
    Phase 5 Examinations               :p5, after p4, 21d
    section Insight & Launch
    Phase 6 Reporting & Analytics      :p6, after p5, 21d
    Phase 7 Hardening & Launch         :p7, after p6, 21d
```

| Phase | Theme                                  | Depends On | Key Deliverable                                                                                                                            |
| ----- | -------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | Foundation & Copilot setup             | none       | Repo, CI, conventions, instruction files                                                                                                   |
| 1     | Auth & RBAC                            | 0          | Secure login, roles, permissions                                                                                                           |
| 2     | Academic structure, course units & SIS | 1          | Faculties, programmes, intakes, course units, curriculum, lecturer assignment, student registration, timetable                             |
| 3     | Finance                                | 2          | Fees, invoices, **bank-deposit payments recorded by Finance**, receipts, statements; online card/bank/mobile payments show **Coming soon** |
| 4     | LMS & Assignments                      | 2          | Assignments, uploads, submissions, grading                                                                                                 |
| 5     | Examinations                           | 3, 4       | Exams with fee and assignment eligibility rules                                                                                            |
| 6     | Reporting & Analytics                  | 3, 4, 5    | Dashboards and PDF exports                                                                                                                 |
| 7     | Hardening & Launch                     | all        | Security, performance, deployment                                                                                                          |

> **Every micro-phase in every phase ends with a documentation step** (Section 6): step document, development-log entry, and commented code.

> Phases 3 and 4 can run in parallel if you have two developers, since both depend only on Phase 2.

---

## Phase 0: Foundation & Copilot Setup

**Status: COMPLETE** (original build, prompts 0.1 to 0.8). **Follow-up updates 0.10 to 0.15 are listed after the exit criteria. Run them first: Phase 0 updates, then Phase 1 updates (1.10 to 1.16), then Phase 2.**

**Goal:** a clean repo where Copilot has everything it needs to produce consistent code.

| #   | Task                                                                                                                 | Tool / Mode               | Output                                  |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------- |
| 0.1 | Create monorepo (`apps/api`, `apps/web`, `packages/shared`)                                                          | Manual                    | Repo skeleton                           |
| 0.2 | Docker Compose: PostgreSQL, Redis, MinIO                                                                             | Ask → Edit                | `docker-compose.yml`                    |
| 0.3 | Write `copilot-instructions.md` and scoped `*.instructions.md`                                                       | Manual                    | Conventions locked                      |
| 0.4 | Write `RBAC_MATRIX.md`, `DATABASE_SCHEMA.md`, `ARCHITECTURE.md`                                                      | Ask (draft), human review | Context docs                            |
| 0.5 | GitHub Actions: lint, type-check, test, build                                                                        | Edit                      | `.github/workflows/ci.yml`              |
| 0.6 | Branch protection, PR template, issue templates, Copilot code review enabled                                         | Manual                    | Governance                              |
| 0.7 | ESLint, Prettier, Husky, Conventional Commits, `eslint-plugin-jsdoc`                                                 | Edit                      | Quality gates incl. comment enforcement |
| 0.8 | Brand tokens: Tailwind theme, global CSS variables, `docs/DESIGN_SYSTEM.md` (Section 5)                              | Edit                      | Single source of truth for UI colors    |
| 0.9 | Documentation scaffold: `docs/phases/`, `DEVELOPMENT_LOG.md`, `CHANGELOG.md`, `adr/`, PR template with doc checklist | Edit                      | Documentation workflow ready            |

**Exit criteria:** `docker compose up` works; CI is green on an empty app; Copilot responds in line with the instruction files; brand tokens and documentation scaffold are in place.

### Phase 0 Updates (added after the initial build)

Phase 0 was built and run with the original steps above, which are **unchanged**. These follow-ups define the **role model** ([Section 1.2](#12-roles--administrative-structure)) and bring the foundation docs, configuration, and design tokens in line with later decisions. They are **appended, not rewritten**, and are numbered from 0.10 so they do not clash with the table above.

| Step | Update                                | Focus                                                                                                                                                                            |
| ---- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.10 | **Role Model & RBAC Matrix Update**   | Redraft `docs/RBAC_MATRIX.md`, create `docs/ROLES.md`: the 14 roles, permission naming, separation-of-duties rules, expected account counts                                      |
| 0.11 | **Copilot Instructions Update**       | Terminology (intake, programme, course unit), no public sign-up, permission checks, payments, attendance rule, no meeting URLs in lists                                          |
| 0.12 | **Design Tokens Update**              | Status colors (success, warning, error, info) and `field`, `StatusBanner`, `ComingSoonBadge`, extended hex lint                                                                  |
| 0.13 | **Environment & Config Update**       | New variables (email, temporary password lifetime, website integration secret, meeting hosts, attendance defaults, application fee, feature flag seeds) with validated config    |
| 0.14 | **Governance & Docs Scaffold Update** | `CODEOWNERS` for auth, RBAC, finance, admissions and migrations; PR checklist; runbooks; access review template; CI check that permissions used in code exist in the RBAC matrix |
| 0.15 | **Update Phase 0 Docs**               | New step documents, log entries, ADR for the role model                                                                                                                          |

**Exit criteria:** `docs/RBAC_MATRIX.md` lists all 14 roles and the separation-of-duties rules; the instruction files, design tokens, and configuration match the later decisions; CODEOWNERS and the PR template are active; CI is green. Every step is documented and all code is commented.

---

## Phase 1: Authentication & RBAC

**Status: COMPLETE** (original build, prompts 1.1 to 1.9). **Follow-up updates 1.10 to 1.16 are listed after the exit criteria and must be run before Phase 2.**

**Goal:** secure identity and fine-grained authorization before any business data exists.

| Step | Micro-Phase           | Mode       | Prompt Focus                                                                                                                               | Constraint                   |
| ---- | --------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| 1.1  | **Prisma Schema**     | Ask / Edit | users, roles, permissions, sessions, password_reset_tokens, email_verification_tokens; relations, indexes, enums, timestamps               | No APIs yet                  |
| 1.2  | **Migration**         | Manual     | `prisma migrate dev`, seed roles and permissions                                                                                           | Run before generating APIs   |
| 1.3  | **Auth Services**     | Edit       | login, register, refresh token, logout, password hashing, JWT generation                                                                   | No frontend code             |
| 1.4  | **RBAC Guards**       | Edit       | role guards, permission guards, decorators, authorization middleware                                                                       | Prevent unauthorized access  |
| 1.5  | **Password Recovery** | Edit       | forgot/reset password, email verification, token expiry, resend verification via Resend                                                    | Separate from 1.3            |
| 1.6  | **Auth Tests**        | Edit       | unit and e2e tests for login, refresh, guards, expiry                                                                                      | Tests only                   |
| 1.7  | **Frontend Auth UI**  | Edit       | login, forgot password, reset password, email verification pages (shadcn/ui, React Hook Form, TanStack Query, brand tokens from Section 5) | Backend must be tested first |

**Security checklist:** Argon2/bcrypt hashing; short-lived access tokens with rotating refresh tokens; rate limiting on auth endpoints; no secrets in the repo.

**Exit criteria:** all roles (student, lecturer, bursar, registrar, admin) can log in; protected routes reject unauthorized roles; auth test suite passes in CI. Every step is documented and all code is commented.

### Phase 1 Updates (added after the initial build)

Phase 1 was built and run with the original steps above, which are **unchanged**. The admissions model means **students never sign themselves up**: admins create every account and the system emails default login details. These follow-up updates adjust the finished auth module. They are **appended, not rewritten**, and are numbered to match the prompt library. Run them in order, **before Phase 2**.

| Step | Update                             | Focus                                                                                                                                                                       |
| ---- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.10 | **Auth Schema Changes**            | `User` gains `mustChangePassword`, `temporaryPasswordExpiresAt`, `createdById`, and deactivation fields; `DEACTIVATED` status                                               |
| 1.11 | **Admin User Services**            | Create users with a random temporary password emailed once; resend credentials; change roles; deactivate and reactivate; new `admin:user:manage` permission                 |
| 1.12 | **Login Gating & Change Password** | **Disable the public `register` endpoint**; a temporary-password session may only change its password; expiry; changing the password clears the flag and verifies the email |
| 1.13 | **Admin User Controllers**         | `/admin/users` endpoints guarded by `admin:user:manage`                                                                                                                     |
| 1.14 | **Update Auth Tests**              | Register returns 404, forced change, expiry, deactivation, permissions                                                                                                      |
| 1.15 | **Frontend Auth Updates**          | Remove any sign-up page, add the change-password page, handle `MUST_CHANGE_PASSWORD`                                                                                        |
| 1.16 | **Update Phase 1 Docs**            | New step documents, log entries, ADR                                                                                                                                        |

**Notes**

- The admin screens for creating users arrive in Phase 2 (step 2.24, Admissions & Users UI), built on the API from step 1.13.
- The email verification flow from the original build stays, but admin-created accounts are marked verified at their first successful password change.
- The role-based redirect after login is added in Phase 2 (step 2.18), with the app shell.
- **Exit criteria:** `POST /auth/register` returns 404; an admin can create a user and the user receives a temporary password; the first login forces a password change; deactivated users are locked out immediately; the updated auth tests pass in CI. Every step is documented and all code is commented.

---

## Phase 2: Core Academic & Student Information System

**Status: NEXT (Phase 1 is complete; Phase 2 has not been started).**

**Goal:** model the university's academic structure, build the **admissions workflow** (admins admit applicants and send default logins), let students **select their pre-loaded course units** each intake, run **online and physical classes with attendance tracking**, and build the **app shell, navigation rails, and home pages** that every later phase plugs into. Build on the existing Phase 1 models and its updates (1.10 to 1.16, which add admin-created accounts); Phase 2 changes only one Phase 1 file, the login flow, which gains a role-based redirect in step 2.18. Read [Section 1.1](#11-academic-domain-model-intakes-programmes-course-units) and [Section 5.5](#55-application-shell-navigation-rails--home-pages) first.

| Step | Micro-Phase                                            | Focus                                                                                                                                                                                |
| ---- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2.0  | **Domain Docs & Instructions**                         | Intake / programme / course unit terminology, admissions flow, online attendance rule in `copilot-instructions.md`, `docs/ACADEMIC_MODEL.md`, `docs/DATABASE_SCHEMA.md`              |
| 2.1  | **Academic Structure Schema**                          | Faculty, Department, Programme, AcademicYear, Intake (three per year, with selection windows)                                                                                        |
| 2.2  | **Course Unit & Curriculum Schema**                    | CourseUnit (with `isGeneral`), CourseUnitFacultyEligibility, ProgrammeCourseUnit, ProgrammeElectiveRule, CourseUnitPrerequisite, CourseUnitOffering                                  |
| 2.3  | **Student, Lecturer & Enrollment Schema**              | Student, Lecturer, OfferingLecturer, ProgrammeEnrollment (with **study mode**), IntakeRegistration, UnitRegistration                                                                 |
| 2.4  | **Admissions Schema**                                  | Application, ApplicationDocument, ApplicationFeeRecord, AdmissionRecord                                                                                                              |
| 2.5  | **Sessions & Attendance Schema**                       | TimetableSlot, ClassSession (physical room and/or meeting link), SessionJoin, PresenceInterval, AttendanceRecord, AttendanceRule                                                     |
| 2.6  | **Announcements & Calendar Schema**                    | Announcement, AnnouncementAudience, CalendarEvent, CalendarEventAudience                                                                                                             |
| 2.7  | **Migration, RBAC & Seed**                             | Migrate, Phase 2 permissions in `RBAC_MATRIX.md` and the seed, sample data                                                                                                           |
| 2.8  | **Academic Structure Services**                        | Faculties, departments, programmes, academic years; **exactly three intakes per year**, windows, status transitions                                                                  |
| 2.9  | **Course Unit & Curriculum Services**                  | Course units, general-unit eligibility, curriculum, elective rules, prerequisites, offerings, **lecturer assignment**                                                                |
| 2.10 | **Admissions Services**                                | Applications, document review, application fee confirmation, **admit** (creates the student account, loads units, emails login details), secured website intake endpoint             |
| 2.11 | **SIS Services**                                       | Students, enrollment history, study mode changes (audited), progression, lecturer profiles                                                                                           |
| 2.12 | **Course Unit Selection Logic**                        | **Prompted units** (core, electives, retakes, general units) and selection with full validation                                                                                      |
| 2.13 | **Class Sessions & Online Meeting Services**           | Generate sessions from the timetable, meeting links, clash detection, the **Attend** action (study-mode aware), `MeetingProvider` interface                                          |
| 2.14 | **Attendance Engine**                                  | Presence ingestion (report import now, provider adapter later), the **continuous-time rule**, physical attendance, lecturer overrides, percentages                                   |
| 2.15 | **Announcements, Calendar & Home Services**            | Audience-filtered announcements, aggregated calendar with `CalendarEventProvider`, `GET /me/home` for each role                                                                      |
| 2.16 | **Controllers & RBAC**                                 | Controllers and DTOs for every Phase 2 service, per `RBAC_MATRIX.md`                                                                                                                 |
| 2.17 | **Tests**                                              | Admission gating, selection rules, shared units, clashes, **continuous-time attendance**, audiences, home data                                                                       |
| 2.18 | **App Shell & Navigation Rails**                       | Layout, `brand` navigation rail, top bar with profile icon, role menus from `nav.config.ts`, role-based redirect after login                                                         |
| 2.19 | **Student Home Page**                                  | Hero (profile icon, greeting, announcements slider), calendar, selected course units with **Attend**, attendance percentage                                                          |
| 2.20 | **Lecturer, Registrar, Admissions & Admin Home Pages** | Same pattern with role-specific widgets                                                                                                                                              |
| 2.21 | **Student Portal UI**                                  | My Programme, **Course Units** (select and view), Timetable, Attendance, Announcements                                                                                               |
| 2.22 | **Lecturer UI**                                        | My course units, class sessions and meeting links, class lists (mixed programmes), attendance review and overrides                                                                   |
| 2.23 | **Registrar UI**                                       | Faculties, programmes, intakes, course units, curriculum, offerings and lecturers, students, announcements and calendar                                                              |
| 2.24 | **Admissions & Users UI**                              | Applications list and detail, document review, application fee confirmation (bursar's Application Fees list), **Admit** with study mode, resend login details, staff user management |
| 2.25 | **Phase Documentation**                                | Step documents, development log, ADRs                                                                                                                                                |

**Who can do what (summary)** (roles are defined in [Section 1.2](#12-roles--administrative-structure))

| Role                             | Phase 2 access                                                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin** (system administrator) | Staff accounts and roles, resend credentials, system settings. **No** admissions, academic, or finance decisions                                                |
| **Admissions officer**           | Enter applications, review and approve or reject documents                                                                                                      |
| **Admissions head**              | **Admit** applicants with a study mode (a different person from the document reviewer), reject, approve study mode changes                                      |
| **Bursar** (Finance Officer)     | Confirm application fees with the bank reference                                                                                                                |
| **Registrar**                    | Faculties, departments, programmes, intakes, course units, curriculum, offerings, lecturer assignment, class sessions, student records, announcements, calendar |
| **Lecturer**                     | Own offerings, class lists, own class sessions and meeting links, attendance review for own offerings, announcements to own offerings                           |
| **Student**                      | Own programme, select own course units in the window, own timetable, **Attend** for own sessions, own attendance, announcements, calendar                       |

**Online attendance: what the system can and cannot know (decision needed)**

The rule (continuous time in the lecture; on-and-off does not count) is built into the system. But when a lecture runs on an **external meeting tool**, the system only knows when a student was connected if that tool shares **join and leave times**. A pasted meeting link alone cannot tell us that. It also measures **presence in the meeting**, not whether the student is paying attention.

| Option                                                               | How join and leave times arrive                                                                | Notes                                                                               |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **A. Zoom**                                                          | Webhooks or reports, with a unique join link per student                                       | Verify that your Zoom plan includes participant reports or webhooks                 |
| **B. Microsoft Teams**                                               | Attendance reports through Microsoft Graph                                                     | Fits if the university uses Microsoft 365                                           |
| **C. Google Meet**                                                   | Meet attendance data (Workspace editions)                                                      | Fits if the university uses Google Workspace; availability depends on the edition   |
| **D. Self-hosted meeting tool** (for example Jitsi or BigBlueButton) | The system receives join and leave events directly and can also track activity inside the page | Most accurate and the only way to measure real engagement; needs hosting and upkeep |

Whichever tool is chosen, each student needs a **unique join link or a sign-in identity**, otherwise their time cannot be matched to them.

**What Phase 2 builds:** the `MeetingProvider` interface, the **Attend** button and click log, class sessions with links, the attendance engine and rules, lecturer overrides, and a **report import** (the lecturer uploads the tool's attendance report) so attendance works end to end from day one. **Automatic ingestion** from the chosen tool is added as a small follow-up step once you pick the tool.

**Assumptions to confirm before building**

1. The curriculum places each unit by **study year and intake slot (1, 2, or 3)**, and students progress through their programme's slots in order. If students do not attend all three intakes each year, the progression rule changes.
2. **Electives** use a configurable minimum and maximum per programme, study year, and intake slot.
3. Course unit selection is **auto-approved** if the rules pass (no advisor approval).
4. The **registrar** assigns lecturers; the `hod` role (own department) can take this over later.
5. Intake **names and dates are configuration** (default January, May, September).
6. **Attendance rule defaults:** 75% continuous time of the session, 3-minute reconnect grace, 75% minimum attendance for the home-page warning. All configurable.
7. **Study mode:** online students attend through the meeting link, physical students in the room, and a student can choose to go physical for a session (the lecturer marks them present). Physical students are not shown meeting links.
8. **Application fee:** in Phase 2 it is confirmed by staff with the bank reference (`ApplicationFeeRecord`). In Phase 3 it moves onto the Finance payment and receipt flow.
9. **Default login details** are a system-generated temporary password with forced change at first login. A one-time activation link is safer than a password in an email, so choose which you prefer.
10. **Phase 1 must be updated first (prompts 1.10 to 1.16):** the public `register` endpoint built in Phase 1 conflicts with "students never sign themselves up", so it is disabled and replaced by admin-created users with temporary credentials.
11. Admissions work is split between `admissions_officer` (enter and review) and `admissions_head` (admit), and the application fee is confirmed by `bursar`, so the admin role has no admissions authority. The reviewer and the admitting user must be different people.
12. The lecturer, registrar, admin, and finance home pages follow the student pattern; confirm their widgets.
13. The **university website** is a separate site. This system exposes a secured endpoint it can call; the website itself is out of scope.

**Exit criteria:** an admin can take an applicant through document review and fee confirmation, admit them with a study mode, and the student receives default login details, is forced to change the password at first login, and finds their programme's course units already loaded; public sign-up no longer exists; the student selects units on the Course Units page and joins each offering's class list; a Law or Health Sciences student can select an eligible general unit and shares the same class and lecturer as Computer Science students; an online student's **Attend** button opens the meeting link, and attendance follows the continuous-time rule (on-and-off visits do not count); physical attendance is recorded by the lecturer; users land on the correct home page and see only their own navigation rail; the student home page shows the hero with the announcements slider, the calendar, selected course units, and the attendance percentage. Every step is documented and all code is commented.

---

## Phase 3: Finance Module

**Goal:** accurate, auditable money handling. This is the highest-risk module, so use the strictest review.

> **How payments work in this system**
>
> - **Active now (physical payment):** the student pays at the bank. **Finance records the deposit and issues the receipt.** Students cannot record their own payments.
> - **Coming soon (online payment):** if a student tries to pay from the system by **card, online bank, or mobile money**, the system shows **"Coming soon"** and points them to the bank-deposit steps. Each online method sits behind its own feature flag, **OFF by default**.

### Payment Channels

| Channel                                          | Status          | Feature Flag                   | What the user sees                                   |
| ------------------------------------------------ | --------------- | ------------------------------ | ---------------------------------------------------- |
| **Bank deposit, recorded by Finance** (physical) | **ACTIVE**      | none (core feature)            | Reference number, bank details, receipt from Finance |
| **Card** (online)                                | **COMING SOON** | `payments.online.card` (OFF)   | "Coming soon" badge, disabled button                 |
| **Online bank payment**                          | **COMING SOON** | `payments.online.bank` (OFF)   | "Coming soon" badge, disabled button                 |
| **Mobile money**                                 | **COMING SOON** | `payments.online.mobile` (OFF) | "Coming soon" badge, disabled button                 |

### The Physical Payment Workflow (Active)

1. **Reference number:** the student generates a unique **payment reference** in the portal (tied to student, intake, and invoice) and writes it on the bank deposit slip.
2. **Bank deposit:** the student pays into the school's bank account. The portal shows the bank name, account details, and instructions (loaded from configuration).
3. **Finance verification:** the student brings the deposit slip to Finance (or Finance matches the reference on the bank statement).
4. **Finance records the payment:** student, invoice or intake, amount, bank name, **deposit-slip/bank reference**, deposit date, and an optional scan of the slip. The system **rejects a duplicate bank reference**.
5. **Receipt issued:** the system updates the balance, carry-forward, and fee-paid percentage, then generates a **sequentially numbered PDF receipt** (school logo watermark) that Finance prints and hands to the student. The student can also download it from the portal.
6. **Corrections:** payments are **never deleted**. A mistake is fixed by **voiding with a written reason**, which creates a reversing log entry and marks the receipt `VOID`; a corrected payment then gets a new receipt. Voiding needs a different approver from the person who recorded the payment (maker-checker).
7. **Reconciliation:** Finance can run a **daily bank-deposit report** to reconcile recorded payments against the bank statement.

### Finance Staff Access (Multiple Users)

Any number of Finance staff can work in the system at the same time, **provided each one is authenticated and authorised**.

| Requirement                  | How it is met                                                                                                                                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authenticated**            | Every finance user signs in with their **own individual account** (JWT session from Phase 1). **No shared logins.** Unauthenticated requests get `401`                                                                                                                 |
| **Authorised**               | Access is checked **per user** by RBAC permission, not by who is logged in at the desk: `finance:payment:record` (bursar), `finance:payment:void` (finance_manager), `finance:receipt:read`, `finance:report:read`. A signed-in user without the permission gets `403` |
| **Several users, same role** | The `bursar` (Finance Officer) role can be given to as many users as needed; the `finance_manager` role adds fee-structure and void authority. Only the system administrator adds or removes role holders                                                              |
| **Accountability**           | Every payment, void, and receipt stores the acting user (`recordedById`, `voidedById`) and appears in the append-only transaction log                                                                                                                                  |
| **Maker-checker for voids**  | A void needs the `finance_manager` role **and** a different person from the one who recorded the payment; a user holding both roles cannot void their own entry                                                                                                        |
| **Concurrency**              | Two finance users recording at the same moment must still get **unique, gap-free receipt numbers** and correct balances (database transactions and locking)                                                                                                            |
| **Offboarding**              | Deactivating a finance user revokes their sessions immediately; their past records stay attributed to them                                                                                                                                                             |
| **Students**                 | Students never receive finance permissions and cannot record or void payments                                                                                                                                                                                          |

### Online Payments: "Coming Soon" Behavior

| Layer                | Behavior while a method is OFF                                                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Student UI**       | A **Pay online** section lists Card, Online bank, and Mobile money, each with a **"Coming soon"** badge (`info` colors) and a disabled button. Beside it, a **"How to pay now"** panel explains the bank-deposit steps. Nothing looks broken and no error appears                                 |
| **API**              | Online endpoints exist and are guarded by `@RequireFeature('payments.online.<method>')`. They return `403` with `{ "code": "FEATURE_DISABLED", "comingSoon": true, "method": "card", "message": "Card payments are coming soon. Please pay at the bank and collect your receipt from Finance." }` |
| **Defense in depth** | The online payment service checks the flag too, so no background job or other module can start an online payment                                                                                                                                                                                  |
| **Who can toggle**   | Admin only, per method, with a written reason; every change is saved to the append-only `FeatureFlagAudit` table                                                                                                                                                                                  |
| **Source of truth**  | The database flag value (activation needs no redeploy); `.env` values only seed the initial OFF state; cached in Redis (about 30 seconds)                                                                                                                                                         |

**Built now:** the three flags, the guard, the online endpoints, the "Coming soon" UI, a `PaymentGateway` interface (initiate, verify, refund), and placeholder adapters for card, bank, and mobile money that deliberately do nothing.

**Deferred until each method is approved:** choosing a payment provider, real gateway integration, webhooks and signature checks, reconciliation with provider reports, and sandbox testing. For cards, use the provider's **hosted checkout** so card numbers never touch your servers.

### Phase 3 Steps

| Step | Micro-Phase                                                             | Focus                                                                                                                                                                                                                                                     | Notes                                                                                                                                 |
| ---- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 3.0  | **Feature Flag Infrastructure**                                         | `FeatureFlag` and `FeatureFlagAudit` models, `FeatureFlagService`, `@RequireFeature` guard, `GET /features`, admin toggle, frontend `FeatureGate`; flags `payments.online.card`, `.bank`, `.mobile` seeded OFF                                            | Reusable for future modules                                                                                                           |
| 3.1  | **Finance Schema + Migration**                                          | fee_structures, invoices, payments (bank name, bank reference, deposit date, recorded-by, void fields), receipts, outstanding and carry-forward balances, transaction_logs                                                                                | Integer minor units; `PaymentMethod` enum: `BANK_DEPOSIT` plus `CARD`, `ONLINE_BANK`, `MOBILE_MONEY` for later; unique bank reference |
| 3.2  | **Fee Structure APIs**                                                  | Create/update fee structure, assign fees per programme and intake (and per study mode, online or physical, if fees differ), validate academic year relationships                                                                                          | **Active**; no frontend                                                                                                               |
| 3.3  | **Invoice Generation**                                                  | Generate and bulk-generate invoices, apply carried-forward amounts, idempotent                                                                                                                                                                            | **Active**                                                                                                                            |
| 3.4  | **Payment Logic (Bank Deposits)**                                       | Payment reference generator, record bank-deposit payments, duplicate-slip protection, balances, carry forward excess, outstanding balances, fee-paid percentages, void with reason                                                                        | **Active**; service layer only                                                                                                        |
| 3.5  | **Finance Tests** (early)                                               | Carry-forward, outstanding balances, percentages, duplicate slip, void and re-record, concurrent payments, invalid amounts                                                                                                                                | Write before receipts                                                                                                                 |
| 3.6  | **Payment Controller**                                                  | Bank-deposit endpoints (record, list, void, statement); online endpoints guarded by the flags                                                                                                                                                             | Any authenticated, authorised finance user records; students read own statement only                                                  |
| 3.7  | **Receipt Generation**                                                  | Printable PDF receipts, school logo watermark, gap-free numbering, transaction references, `VOID` marking                                                                                                                                                 | **Active**; Puppeteer or PDFKit                                                                                                       |
| 3.8  | **Finance Dashboard UI & Finance Home**                                 | Finance home page (shared home layout: hero, calendar, today's deposits), add Finance items to the navigation rail, fee structures, invoices, **record bank deposit form**, payment list, receipt print/history, daily bank-deposit report, fee analytics | Next.js, shadcn/ui, brand and status tokens                                                                                           |
| 3.9  | **Student Financial Statement UI** (adds the student Finance rail item) | Invoices and balance, receipts, **reference number generator, "How to pay now" bank instructions**, **Pay online section with "Coming soon" badges**                                                                                                      | Student portal; mobile first                                                                                                          |
| 3.10 | **Online Payment Activation** (DEFERRED)                                | Per-method activation runbook, provider integration checklist, sandbox smoke tests, rollback plan                                                                                                                                                         | Document now; **execute only when a method is approved**                                                                              |
| 3.11 | **Phase Documentation**                                                 | Step documents, development log, ADRs (flag design, maker-checker voids)                                                                                                                                                                                  | Required for every phase                                                                                                              |

**Application fees:** the application fee confirmed by staff in Phase 2 (`ApplicationFeeRecord`) moves onto this payment and receipt flow, so applicants get the same numbered receipts and duplicate-slip protection.

**Cross-module rule:** the exam fee-percentage restriction (Phase 5) is **fully active**, because it reads the payments Finance records from bank deposits.

**Testing rule:** bank-deposit logic gets full unit and integration tests. Access tests prove that unauthenticated requests get `401`, users without finance permissions get `403`, two finance users recording concurrently receive distinct gap-free receipt numbers, a user cannot approve their own void, and a deactivated finance user is locked out. Separate tests prove that for **each** online method, with its flag OFF, the endpoint returns `403 FEATURE_DISABLED` with `comingSoon: true`, no payment row is created, no receipt number is consumed, and the UI shows the "Coming soon" badge with a disabled button.

**Safeguards:** database transactions for every payment write; immutable `transaction_logs`; unique bank reference to stop duplicate slips; `recordedById` stored on every payment (individual accounts only, no shared finance logins); **no deletes, only void with reason**; maker-checker for voids; **human review mandatory** on all balance calculations.

**Activating an online method later (step 3.10):** pick a provider, build the gateway adapter, test in the provider sandbox, reconcile against provider reports, review security (hosted checkout, webhook signatures), confirm stakeholder approval, enable the method's flag on staging, smoke test, enable on production, then monitor for 48 hours. **Rollback** is switching that method's flag OFF; completed payments remain untouched.

**Exit criteria:** Finance can record a bank deposit and the system issues a correctly numbered receipt; duplicate deposit slips are rejected; balances reconcile against a hand-calculated test ledger; trying to pay online by card, bank, or mobile shows "Coming soon" and creates nothing; the finance test suite passes. Every step is documented and all code is commented.

---

## Phase 4: LMS & Assignment System

**Goal:** assignments, materials, submissions, and grading workflows.

| Step | Micro-Phase            | Focus                                                                                                                                                                                                                                             |
| ---- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1  | **LMS Schema**         | assignments, learning_materials, submissions, grading, extension_requests (exams modeled in Phase 5)                                                                                                                                              |
| 4.2  | **Migration**          | Apply and verify                                                                                                                                                                                                                                  |
| 4.3  | **Assignment APIs**    | Create/update, deadline tracking, visibility per course unit offering (every student who selected the unit sees it, whatever their programme), approval workflow; registers a `CalendarEventProvider` so assignment deadlines appear in calendars |
| 4.4  | **File Upload System** | PDF, DOCX, PPTX, image uploads; upload validation; storage via `StorageService` (MinIO → R2/S3)                                                                                                                                                   |
| 4.5  | **Submission Logic**   | Upload submissions, deadline enforcement, missed-paper tracking, extensions, status tracking                                                                                                                                                      |
| 4.6  | **Grading System**     | Grade submissions, publish marks, feedback, grading analytics, submission statistics                                                                                                                                                              |
| 4.7  | **LMS Tests**          | Deadline enforcement, extensions, upload validation, grading rules                                                                                                                                                                                |
| 4.8  | **LMS Frontend**       | Adds Assignments, Materials, and Grading items to the navigation rails; assignments, submissions, reading materials, grading dashboard, teacher upload pages                                                                                      |

**Safeguards:** validate MIME type and size server-side; virus-scan uploads if feasible; pre-signed URLs for downloads; never trust client-supplied file names.

**Exit criteria:** teacher publishes an assignment; student submits before the deadline; late and missed states are tracked; marks are published and visible to the student. Every step is documented and all code is commented.

---

## Phase 5: Examination System

**Goal:** exams gated by business rules from Finance and LMS.

| Step | Micro-Phase                   | Focus                                                                                                                                                             |
| ---- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1  | **Exam Schema**               | exams, exam_submissions, grading, exam_results, exam_restrictions                                                                                                 |
| 5.2  | **Migration**                 | Apply and verify                                                                                                                                                  |
| 5.3  | **Exam Creation APIs**        | Create and publish exams, course unit offering visibility, scheduling, deadline management; registers a `CalendarEventProvider` so exam dates appear in calendars |
| 5.4  | **Restriction Logic**         | Assignment completion checks, fee percentage checks (based on payments recorded by Finance), missed-assignment restrictions, exam blocking                        |
| 5.5  | **Result Publishing**         | Publish results, missed-paper status, result visibility, grading reports                                                                                          |
| 5.6  | **Transcript & GPA Services** | GPA calculation, academic standing, transcript generation                                                                                                         |
| 5.7  | **Exam Tests**                | Eligibility matrix (fee % × assignment completion), result visibility                                                                                             |
| 5.8  | **Examination Frontend**      | Adds Exams, Results, and Transcript items to the navigation rails; exams dashboard, exam attempts, grading pages, result pages                                    |

**Exit criteria:** a student under the fee threshold or with missed assignments is correctly blocked; results appear only after publishing; transcripts match expected GPAs. Every step is documented and all code is commented.

---

## Phase 6: Reporting & Analytics

**Goal:** turn module data into decisions.

| Step | Micro-Phase             | Focus                                                                                                                              |
| ---- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 6.1  | **Analytics APIs**      | Finance (payments, outstanding balances, daily bank-deposit totals), attendance, assignment, student performance, teacher workload |
| 6.2  | **Chart Data Services** | Monthly revenue, attendance trends, assignment completion trends, performance summaries                                            |
| 6.3  | **Caching Layer**       | Redis caching for heavy aggregates; background jobs for precomputation                                                             |
| 6.4  | **Dashboard UI**        | Charts, cards, tables, filters, export buttons (Recharts, shadcn/ui, Next.js)                                                      |
| 6.5  | **PDF Report Exports**  | Printable academic, finance, and attendance reports with school branding                                                           |
| 6.6  | **Tests**               | Aggregation correctness, export output                                                                                             |

**Exit criteria:** dashboards load fast on realistic data volumes; exports are correctly branded and match on-screen figures. Every step is documented and all code is commented.

---

## Phase 7: Hardening & Launch

| Area              | Tasks                                                                                                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Security**      | Dependency audit, secret scanning, CodeQL, OWASP Top 10 review, penetration test, audit logging, **multi-factor sign-in for privileged roles**, `auditor` and `support_desk` roles, first **access review**   |
| **Performance**   | Load test registration and results-day scenarios; database indexing review; Redis tuning                                                                                                                      |
| **Reliability**   | Automated backups, restore drill, health checks, error monitoring                                                                                                                                             |
| **Compliance**    | Data protection and privacy policy, retention rules, role-based data access audit                                                                                                                             |
| **DevOps**        | Staging → production pipeline, environment-variable-only storage swap (R2/S3), rollback plan                                                                                                                  |
| **Documentation** | API docs (OpenAPI), admin and user guides, runbooks                                                                                                                                                           |
| **Payments**      | Bank-deposit payments and receipts are **live at launch**; online card, bank, and mobile payments stay **"Coming soon"** (flags OFF); activating any method needs explicit approval and the step 3.10 runbook |
| **UAT**           | Pilot with a small group of lecturers, bursars, and students; collect feedback; fix                                                                                                                           |

**Launch checklist:** CI green; migrations rehearsed on staging; backups verified; monitoring and alerts live; support plan in place.

---

## Recommended Copilot Workflow (Per Micro-Phase)

```text
1. Open a NEW chat; attach context (#file docs/RBAC_MATRIX.md, docs/DATABASE_SCHEMA.md)
2. Run the matching prompt file from .github/prompts/
3. Review the diff, rejecting scope creep
4. Run migrations / build / tests locally
5. Fix with targeted Edit-mode prompts
6. Run the step-documentation prompt → docs/phases/phase-N/step-N.M-<name>.md
   and append an entry to docs/DEVELOPMENT_LOG.md
7. Run the comment-review prompt: confirm every block and function is commented
8. Commit (Conventional Commits) and push a feature branch
9. Open a PR → Copilot code review + human review (docs and comments checked)
10. Merge when CI is green
11. Update docs/DATABASE_SCHEMA.md, RBAC_MATRIX.md, DESIGN_SYSTEM.md if anything changed
```

**Ordering rules**

- Schemas first → migrations → services → controllers → tests → frontend.
- Test APIs before generating UI.
- Never let Copilot regenerate large files unnecessarily.

---

## Definition of Done (Per Micro-Phase)

- [ ] Code compiles with strict TypeScript and no lint errors
- [ ] Migrations applied cleanly (where relevant)
- [ ] Unit tests added and passing (generated in a separate step)
- [ ] RBAC enforced and listed in `RBAC_MATRIX.md`
- [ ] Input validation in place
- [ ] Reviewed by a human; finance and auth changes reviewed twice
- [ ] **Step document written** (`docs/phases/...`) and `DEVELOPMENT_LOG.md` updated
- [ ] **All code commented**: file header, TSDoc on exports, block comments explaining why
- [ ] UI uses only the brand and status tokens (no raw hex values in components); statuses use icon + text, not color alone
- [ ] Online payment methods stay behind their `payments.online.*` flags (default OFF) and show "Coming soon"; the bank-deposit flow is tested end to end
- [ ] New screens live inside the shared app shell and register their navigation items in `nav.config.ts` (no custom layouts)
- [ ] Schema, RBAC, and design docs updated where affected
- [ ] Committed on a branch and PR merged with a green CI

---

## Risk Register

| Risk                                                                                    | Impact                              | Mitigation                                                                                                                                                                               |
| --------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Copilot hallucinates APIs or schema fields                                              | Broken code                         | Attach schema docs; short prompts; compile and test every step                                                                                                                           |
| Premium request quota exhausted                                                         | Slowed development                  | Use Edit mode, lighter models for boilerplate, weekly usage checks                                                                                                                       |
| Large generated files overwrite work                                                    | Lost work                           | "Do not modify existing files" rule; small branches; frequent commits                                                                                                                    |
| Financial calculation errors                                                            | Incorrect student balances          | Integer money, DB transactions, thorough tests, double review                                                                                                                            |
| Insecure auth or RBAC gaps                                                              | Data breach                         | Dedicated Phase 1, security tests, CodeQL, pen test                                                                                                                                      |
| Context drift in long chats                                                             | Inconsistent code                   | New chat per micro-phase; instruction files                                                                                                                                              |
| Storage vendor lock-in                                                                  | Migration pain                      | `StorageService` abstraction; env-only switching                                                                                                                                         |
| Undocumented decisions or uncommented generated code                                    | Hard to maintain, onboard, or audit | Mandatory step docs, ADRs, comment rules in instructions, lint and PR checks                                                                                                             |
| Shared finance accounts or unauthorised access to payment screens                       | No accountability; fraud risk       | One account per finance user, per-permission RBAC, session revocation on offboarding, `recordedById` on every action, access tests                                                       |
| Errors or fraud in manual payment recording (wrong amount, duplicate slip, later edits) | Wrong balances, lost revenue        | Unique bank reference, `recordedById` on every payment, void-with-reason instead of delete, maker-checker for voids, daily bank reconciliation report, mandatory review of balance logic |
| Online payment method enabled before its provider integration is complete               | Failed or lost money transfers      | Per-method flags default OFF, admin-only toggle with audit trail, sandbox testing and security review before activation (step 3.10)                                                      |
| Inconsistent UI colors                                                                  | Brand drift, accessibility issues   | Semantic tokens only, `DESIGN_SYSTEM.md`, lint rule against raw hex, contrast review                                                                                                     |
| Traffic spikes on results day                                                           | Outages                             | Redis caching, queues, load testing                                                                                                                                                      |

---

_This roadmap is designed for large-scale, GitHub Copilot-assisted development: small scoped prompts, persistent repository instructions, strict ordering, and review gates keep quality high and request usage low._

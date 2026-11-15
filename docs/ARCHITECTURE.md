# System Architecture

**Status:** Draft for human review
**Scope:** Target architecture for the University SIS monorepo, based on the project roadmap.

## Architectural shape

The system is a modular monolith in a pnpm/Turborepo monorepo: a Next.js web client calls a NestJS API, which owns business rules and persistence through Prisma repositories. PostgreSQL is the source of truth for relational data. Redis and object storage are supporting infrastructure, not alternate sources of truth for core records.

```text
Browser
  -> Next.js client (apps/web)
  -> NestJS API (apps/api): authentication, RBAC, DTO validation, controllers
  -> module services: business rules and cross-module coordination
  -> repositories (Prisma)
  -> PostgreSQL
     Redis: cache, feature-flag cache, queues/background work
     StorageService -> MinIO locally / S3-compatible storage in hosted environments
```

`packages/shared` contains appropriate shared types, schemas, and constants. It must not contain server-only business rules, secrets, or database access.

## Modules and dependencies

| Module                    | Owns / provides                                                                                                                | Depends on                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Auth and RBAC**         | Identity lifecycle, sessions, credential recovery, roles, permissions, authorization metadata and guards.                      | PostgreSQL; optional identity/email integrations as configured. Foundational to protected API modules.                        |
| **SIS**                   | Student records, admissions data, and enrollment history.                                                                      | Auth/RBAC for identity and access context.                                                                                    |
| **Academic**              | Academic years and terms, programs, courses, classes, enrollments, timetables, attendance, and academic grading workflows.     | Auth/RBAC and SIS.                                                                                                            |
| **Finance**               | Fee structures, invoices, payment references, bank-deposit records, receipts, balances, reversals, and finance reporting data. | Auth/RBAC, SIS, and academic term/enrollment context.                                                                         |
| **LMS**                   | Learning materials, assignments, submissions, extensions, feedback, and assignment grading.                                    | Auth/RBAC, SIS, and Academic for class membership; StorageService for uploaded files.                                         |
| **Exams**                 | Exam scheduling and attempts, eligibility restrictions, exam grading/results, GPA, and transcripts.                            | Auth/RBAC, SIS, Academic, Finance fee status, and LMS completion status.                                                      |
| **Reports and analytics** | Read-only cross-module aggregates and export-ready report data.                                                                | Domain services or approved read models from SIS, Academic, Finance, LMS, and Exams; Redis for selected expensive aggregates. |

### Dependency rules

- Keep module ownership explicit. A module changes its own records; other modules request behavior through services or stable internal interfaces rather than writing another module's tables directly.
- Keep Auth/RBAC foundational and avoid dependencies from Auth back into business modules.
- Keep Reports read-only. It may compose domain-owned data for analytics but must not become the owner of source records.
- Exams may evaluate finance and LMS eligibility but must not create or alter payments, assignments, or submissions.
- Avoid synchronous module dependency cycles. If workflows need asynchronous processing, use a queue/job boundary and persist enough state to retry safely.

## Request flow

1. The browser sends an HTTPS request to the Next.js application or the API. The client presents the user's authentication context; it is not trusted to enforce authorization.
2. The NestJS API authenticates the request. Authentication and public-route metadata are explicit; unauthenticated login and recovery routes are rate-limited and do not expose protected records.
3. API guards apply the permission from `docs/RBAC_MATRIX.md`. For `OWN` and assigned-resource access, the server also scopes queries to the authenticated user or lecturer's assignments.
4. The validation pipeline checks request DTOs before the controller acts on them.
5. A controller handles HTTP mapping only and delegates to a service. Controllers contain no business logic or direct database access.
6. The service applies business rules and coordinates other modules through their service interfaces. For consistency-sensitive writes, it uses an appropriate database transaction.
7. A repository uses Prisma to read or write module-owned relational records in PostgreSQL. Responses are mapped to API DTOs; internal persistence models are not returned blindly.
8. Redis may serve short-lived cache entries, feature-flag cache values, queue coordination, or precomputed aggregates. PostgreSQL remains the source of truth for core and feature-flag state; cache invalidation/expiry must not turn stale data into authorization.
9. Binary files are handled through `StorageService`, which abstracts the configured provider. Metadata and access relationships remain in PostgreSQL; downloads must be authorized and use controlled access such as short-lived signed URLs where appropriate.
10. The API returns a documented success or error response. Sensitive actions and state changes are logged with enough actor/context information for audit without logging credentials or secrets.

## Data and infrastructure boundaries

| Concern                   | Boundary and rule                                                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Relational data           | PostgreSQL via Prisma repositories. Use transactions for multi-record invariants. Monetary values are integer minor units, never floating point.                                                                      |
| Cache and background work | Redis is an optimization/coordination layer, not the durable source of truth for balances, grades, permissions, or payments.                                                                                          |
| Files                     | Store file objects through `StorageService`; use MinIO for local development and an S3-compatible provider such as R2/S3 for hosted environments. Validate uploads server-side and enforce authorization on download. |
| Payments                  | The active flow is a physical bank deposit recorded by Finance, followed by receipt issuance. Online card, bank, and mobile payment methods remain OFF behind separate flags until approved and integrated.           |
| Identity integrations     | Keycloak/Auth0 and email delivery are roadmap options, not assumed implementations. Keep provider choice behind configuration or an interface if adopted.                                                             |
| Reporting                 | Prefer read-only aggregation and bounded caching; invalidate or expire cache after relevant writes and never use a report cache to make authorization decisions.                                                      |

## Repository mapping

- `apps/web` — Next.js App Router UI and API client.
- `apps/api` — NestJS HTTP/API application and domain modules.
- `packages/shared` — shared client-safe types, validation schemas, and constants.
- PostgreSQL, Redis, and MinIO are available for local infrastructure through the repository's Docker Compose setup.

This document describes the target module boundaries; it does not assert that every module or integration is already implemented. Record material architecture changes in an ADR and update this document when the approved boundaries change.

<!-- Purpose: Record Phase 2.15 communications, calendar, storage, and home services. -->

# Phase 2 / Step 2.15: Communications, Calendar, and Home Services

## Goal

Add service-layer announcement lifecycle, audience-aware calendar aggregation,
private image storage, and one-call role-specific home responses without adding
controllers or changing the Prisma schema.

## What Was Built

- Added `AnnouncementsService` for draft creation, updates, publication,
  archival, and audience-filtered feeds. Server-side sanitization removes
  scripts and unsupported markup; lecturer writes are limited to assigned
  course-unit offerings.
- Added a provider-neutral `StorageService` and an S3-compatible MinIO adapter
  for validated JPEG, PNG, and WebP announcement images. Stored objects remain
  private and are exposed through short-lived signed URLs.
- Added `CalendarService` and `CalendarEventProviderRegistry` to merge
  audience-visible authored events, intake milestones, selected or taught
  offering sessions, and registered feature providers. Calendar requests are
  limited to 62 days and never include meeting URLs. Authored events without
  audience selectors are institution-wide, as confirmed for this step.
- Added `HomeService` for student, lecturer, and registrar summaries, each
  assembled in one service call and cached per user in Redis for 60 seconds.
  Student views include selected units, next-session attendance eligibility,
  and attendance summaries without meeting URLs.
- Invalidated affected student home caches after unit-selection and attendance
  mutations, and added validated MinIO endpoint, region, credentials, and
  bucket configuration.

## Key Decisions

- Services remain internal and are registered through the academic module;
  no HTTP routes, schema migrations, or permissions were added.
- The calendar provider registry allows future assignment and exam modules to
  register adapters without coupling those modules to `CalendarService`.
- Home methods require the caller to be the requested user and to hold the
  corresponding permission from the canonical RBAC matrix.
- The lecturer and registrar home widgets follow the user's confirmed choices:
  assigned units and today's classes for lecturers; current-intake selection
  progress and bounded attention lists for registrars.
- Images are stored using the repository's S3-compatible MinIO deployment.
  `MINIO_ENDPOINT` must be reachable by the API and browsers that open signed
  image URLs.
- Behavioral tests are recorded in the separate Phase 2.15 test step.

## How to Run & Test

- `corepack pnpm@12.21.0 --filter @school/api build` — passed.
- Focused behavioral test results are recorded in the separate Phase 2.15 test
  step.

## Data/Permissions Impact

No Prisma models or permission grants changed. Existing announcement,
calendar-event, audience, session, and registration models back the service
workflows. Existing RBAC permissions restrict management, own-offering writes,
and home views.

## Known Limitations

No external calendar providers are registered yet. A student without an
approved admission photo receives a `null` photo URL. Student attendance
summary is `null` when the selected intake is not in an attendance-active
window.

## Copilot Usage

The canonical RBAC matrix, database schema, Phase 2.15 prompt and roadmap,
backend instructions, and storage/runtime configuration were reviewed before
implementation.

# Phase 2 / Step 2.19: Student Home Page

## Goal

Build the student home dashboard inside the shared app shell with one
TanStack Query load and no unrelated finance, GPA, exam, or assignment content.

## What Was Built

- Added the responsive student hero with profile avatar/initials, time-of-day
  greeting, programme, current intake, and pinned-first announcement slider.
- Added announcement dots, arrows, swipe, reduced-motion handling,
  hover/focus pause, and a full-text native dialog.
- Added a react-day-picker month calendar with event markers and a typed agenda.
- Added selected course-unit cards, lecturer and next-class details, online
  Attend behavior, physical-room display, and selection-window empty state.
- Added the overall attendance badge, below-minimum warning style, and
  per-course-unit percentages.
- Added responsive skeleton and retry states and the mobile/desktop grid order.

## Known Contract Gaps

- The existing backend student home endpoint is `GET /student/me/home`, not
  `GET /me/home`; no backend code was changed.
- `StudentHomeView.nextSession` does not include `sessionId`, and the home view
  does not include `studentId`. Therefore the frontend defensively disables
  Attend and explains the missing identifiers instead of sending a false
  request. The existing backend Attend action requires both IDs.
- The existing course-unit home item does not include a physical room field.
  The UI supports room data if `room` is supplied by a future home response.

## How to Run & Test

- `pnpm typecheck` in `apps/web`
- `pnpm build` in `apps/web`

Both passed. UI tests are separate from implementation.

## Data/Permissions Impact

No backend or API changes. Uses the existing `GET /student/me/home` service
response and the existing `POST /sessions/:id/attend` contract.

## Copilot Usage

Copilot inspected the existing home response types and design system, then
implemented the dashboard and documented the two observable response gaps.

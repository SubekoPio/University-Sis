<!-- Purpose: Record the validated Phase 0 API environment configuration. -->

# Phase 0 / Step 0.13: Environment Configuration

## Goal

Validate the new SIS application settings before NestJS startup while
preserving all unrelated existing environment variables and values.

## What Was Built

- Added commented examples for the requested settings in `.env.example`;
  previously existing `EMAIL_FROM` and `RESEND_API_KEY` values were preserved.
- Added a typed Zod schema in
  `apps/api/src/config/environment.config.ts` and wired it into
  `ConfigModule.forRoot` in `apps/api/src/app.module.ts`.
- Added five focused tests in
  `apps/api/src/config/environment.config.spec.ts`.
- Documented the settings in the root `README.md` and added Zod as a direct API
  dependency.

## Key Decisions

- Settings without a specified default are required. `RESEND_API_KEY` is
  required only when the configured provider is Resend; the existing Mailpit
  development path permits it to be blank.
- Parse `MEETING_ALLOWED_HOSTS` as a normalized, comma-separated hostname
  list. Preserve unknown settings with Zod passthrough.
- Reject online-payment flags set to `true`; they default to `false`.

## Business Rules

- `APP_URL` must be an HTTP(S) URL; the website integration secret must have at
  least 32 UTF-8 bytes.
- Temporary-password TTL defaults to 7 days. Attendance defaults are 75%,
  180 seconds, and 75%.
- Application fees are non-negative integer minor units with an uppercase
  three-letter currency code.
- Never commit real secrets or enable an online payment flag.

## How to Run & Test

- `corepack pnpm@12.21.0 --filter @school/api typecheck` — passed.
- `corepack pnpm@12.21.0 --filter @school/api lint` — passed.
- `corepack pnpm@12.21.0 --filter @school/api exec vitest run src/config/environment.config.spec.ts` — 5 tests passed.
- `corepack pnpm@12.21.0 exec prettier --check README.md apps/api/src/app.module.ts apps/api/src/config/environment.config.ts apps/api/src/config/environment.config.spec.ts apps/api/package.json` — passed.
- `git diff --check` — passed.

## Data/Permissions Impact

No Prisma model, migration, seed, endpoint, or permission grant changed. The
new values are validated at startup and existing unrelated environment
variables pass through unchanged.

## Known Limitations

- Meeting-host, school-branding, temporary-password, attendance, and
  application-fee settings are validated but their owning feature modules are
  not implemented.
- The current Prisma schema has no `FeatureFlag` model and `prisma/seed.ts`
  does not consume these environment flags. The flags therefore remain
  validated configuration, not persisted feature-flag state.
- Online-payment methods remain unavailable.

## Copilot Usage

Copilot drafted the schema, example settings, README text, and tests. The API
type and runtime checks were run; no real credentials were added.

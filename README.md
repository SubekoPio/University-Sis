# University SIS

University student information system monorepo managed with pnpm workspaces and Turborepo.

## Workspaces

- `apps/api` — strict TypeScript NestJS API
- `apps/web` — Next.js App Router, Tailwind CSS, and shadcn/ui
- `packages/shared` — shared TypeScript, Zod, and constants package

## Development

Use Corepack to run the pnpm version pinned in `package.json`, then install dependencies and run a workspace script:

```powershell
corepack pnpm@12.21.0 install
corepack pnpm@12.21.0 dev
```

Other root scripts are `corepack pnpm@12.21.0 build`, `corepack pnpm@12.21.0 lint`, and `corepack pnpm@12.21.0 typecheck`.

## Local infrastructure

Copy `.env.example` to `.env`, set the blank database and MinIO credentials and the required application values in the configuration section, then start the services:

```powershell
Copy-Item .env.example .env
docker compose up -d
```

PostgreSQL, Redis, and MinIO are exposed on localhost. MinIO's console is available on the configured console port, and the one-shot initializer creates the configured bucket (default: `school-files`).

## Application configuration

Set every variable without a documented default before starting the API; Zod
validation fails fast when required values are missing. `.env.example` contains
example values and blank placeholders only; never commit real secrets.

| Variable                             | Purpose                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `APP_URL`                            | Public application URL used to build login links in emails.                               |
| `EMAIL_FROM`                         | Sender name and address for system emails.                                                |
| `RESEND_API_KEY`                     | Required when `EMAIL_PROVIDER=resend`; leave blank for local Mailpit.                     |
| `TEMP_PASSWORD_TTL_DAYS`             | Initial temporary-password lifetime in days (default: `7`).                               |
| `WEBSITE_INTEGRATION_SECRET`         | Random secret of at least 32 bytes for signing university-website requests to admissions. |
| `MEETING_ALLOWED_HOSTS`              | Comma-separated hostnames permitted in meeting links.                                     |
| `ATTENDANCE_MIN_CONTINUOUS_PERCENT`  | Continuous session share required for attendance (default: `75`).                         |
| `ATTENDANCE_RECONNECT_GRACE_SECONDS` | Reconnect grace period in seconds (default: `180`).                                       |
| `ATTENDANCE_WARNING_PERCENT`         | Attendance warning threshold (default: `75`).                                             |
| `APPLICATION_FEE_AMOUNT_MINOR`       | Application fee in integer minor currency units.                                          |
| `CURRENCY`                           | Three-letter uppercase currency code for the application fee.                             |
| `SCHOOL_NAME`                        | Institution name used in branding and communications.                                     |
| `SCHOOL_LOGO_KEY`                    | Object-storage key for the institution logo.                                              |
| `FEATURE_ONLINE_CARD_ENABLED`        | Seed-only online card flag; must remain `false` (the API rejects `true`).                 |
| `FEATURE_ONLINE_BANK_ENABLED`        | Seed-only online bank flag; must remain `false` (the API rejects `true`).                 |
| `FEATURE_ONLINE_MOBILE_ENABLED`      | Seed-only online mobile flag; must remain `false` (the API rejects `true`).               |

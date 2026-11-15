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

Copy `.env.example` to `.env`, set the blank database and MinIO credentials, then start the services:

```powershell
Copy-Item .env.example .env
docker compose up -d
```

PostgreSQL, Redis, and MinIO are exposed on localhost. MinIO's console is available on the configured console port, and the one-shot initializer creates the configured bucket (default: `school-files`).

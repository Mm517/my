# My — Quran Tracker

Monorepo for the Quran tracker application, including the React client, API server, Supabase migrations, generated API clients, and shared libraries.

## Requirements

- Node.js 24+
- pnpm 10+
- A configured Supabase project

## Run locally

```bash
pnpm install
pnpm --filter @workspace/ay-chat dev
```

In a second terminal, configure the API variables from `artifacts/api-server/.env.example` and run:

```bash
pnpm --filter @workspace/api-server dev
```

For the frontend, copy `artifacts/ay-chat/.env.example` to `artifacts/ay-chat/.env` and fill in the public Supabase values. Never commit service-role or private VAPID keys.

## Build and typecheck

```bash
pnpm typecheck
pnpm build
```

## Supabase

Apply the migration in `supabase/migrations/001_initial_schema.sql` to the target Supabase project, then follow the Arabic setup guides in the repository.

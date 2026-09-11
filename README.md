# Loan Manager

Next.js 16 admin app for borrowers, loans, payments, interest/penalty accrual, and PDF reports. Data lives in **Supabase Postgres** (Vercel-linked). Auth is **Supabase Auth** (single admin).

## Prerequisites

- **Node** matching `.nvmrc` — `nvm use`
- **pnpm 10+**
- Supabase / Vercel Postgres credentials in `.env.development.local` (see `.env.example`)

## Setup

1. Copy `.env.example` → `.env.development.local` and fill in values from your Vercel/Supabase project.
2. Apply schema + migrate local SQLite (one-time, if you still have `db.sqlite`):

```bash
node --env-file=.env.development.local scripts/migrate-sqlite-to-supabase.mjs
```

3. Create the placeholder admin:

```bash
node --env-file=.env.development.local scripts/create-admin-user.mjs
```

4. In Supabase Dashboard → **Authentication → Providers → Email**: disable new signups.
5. In **Authentication → Users**, reset the password for `admin@example.com`.

```bash
nvm use && pnpm install && pnpm dev
```

Open http://localhost:3000 — you’ll be redirected to `/auth/login`.

## Vercel deploy

1. Push this repo and import the project in Vercel (or link an existing one).
2. Set the same env vars as `.env.example` in the Vercel project settings (Production + Preview). Prefer the pooler `POSTGRES_URL` for the app runtime.
3. Deploy. After first deploy, confirm admin login works and reset the admin password if you haven’t.

Do **not** commit `.env*.local`, `db.sqlite`, or service-role keys.

## Commands

| Command | What |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build & serve |
| `pnpm test` | Vitest |
| `pnpm lint` | ESLint |

## Layout

```
app/                 routes + API handlers
middleware.ts        Supabase session gate
lib/db.ts            Postgres client (postgres.js)
lib/loan-service.ts  interest / penalties / payment waterfall
lib/supabase/        browser + server + middleware clients
lib/loan-report/     PDF report data + rendering
scripts/supabase/    Postgres schema
```

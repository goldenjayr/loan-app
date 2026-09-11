# Supabase Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the loan app from SQLite to Supabase Postgres with preserved IDs, deployable on Vercel, with single-admin Supabase Auth.

**Architecture:** Next.js API routes keep business logic; `postgres` talks to Supabase Postgres; `@supabase/ssr` handles auth cookies/middleware. One-shot SQLite→Postgres migration preserves integer PKs.

**Tech Stack:** Next.js 16, `postgres`, `@supabase/supabase-js`, `@supabase/ssr`, Vitest, Supabase Auth + Postgres.

## Global Constraints

- Preserve integer IDs from SQLite exactly.
- Never commit secrets (`.env*.local`).
- Single admin `admin@example.com`; no public signup.
- Remove `better-sqlite3` from production dependencies.
- Mirror live SQLite schema (not outdated UUID scripts).
- Work on branch `feat/supabase-migration`.

---

### Task 1: Env + dependencies

**Files:**
- Modify: `.env.development.local`
- Create: `.env.example`
- Modify: `package.json`

- [ ] Write env values provided by user into `.env.development.local`
- [ ] Create `.env.example` with empty placeholders
- [ ] `pnpm remove better-sqlite3 @types/better-sqlite3`
- [ ] `pnpm add postgres @supabase/supabase-js @supabase/ssr`

### Task 2: Schema + data migration

**Files:**
- Create: `scripts/supabase/001_schema.sql`
- Create: `scripts/migrate-sqlite-to-supabase.mjs`

- [ ] Apply schema (SERIAL PKs, NUMERIC money, RLS policies, profiles)
- [ ] Export SQLite → insert preserving IDs → reset sequences
- [ ] Verify counts match

### Task 3: Postgres db layer + async loan-service

**Files:**
- Rewrite: `lib/db.ts`
- Modify: `lib/loan-service.ts` (async + extract pure `computeLoanReplay` for tests)
- Modify: all `app/api/**/route.ts`, `lib/loan-report/data.ts`
- Modify: `lib/loan-service.test.ts`

### Task 4: Auth

**Files:**
- Rewrite: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`, `lib/supabase/middleware.ts`
- Create: `middleware.ts`
- Rewrite: `app/auth/login/page.tsx`
- Modify: signup → redirect/remove; header logout
- Protect API routes with session check
- Create admin user via service role

### Task 5: Docs + verify

- Update README with Vercel env + password reset steps
- `pnpm test`, `pnpm build`
- Spot-check migrated loan balances

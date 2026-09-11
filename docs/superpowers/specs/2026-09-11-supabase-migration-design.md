# Supabase Migration + Admin Auth Design

**Date:** 2026-09-11  
**Status:** Approved

## Goal

Move the loan app from local SQLite to Supabase Postgres (Vercel-linked), migrate all existing data with preserved integer IDs, make the app git/Vercel deployable, and add a real single-admin login.

## Decisions

| Topic | Choice |
| --- | --- |
| Auth model | Single admin only; public signup disabled/removed |
| Admin account | Placeholder `admin@example.com`; password reset in Supabase Dashboard |
| Data access | Keep Next.js API routes; rewrite `lib/loan-service` to Postgres |
| Primary keys | Integer IDs; preserve SQLite IDs exactly |
| Secrets | `.env.development.local` + Vercel env; never commit secrets |

## Architecture

```
Browser → Next.js (Vercel)
  ├─ Middleware: Supabase session; unauthenticated → /auth/login
  ├─ Pages: existing admin UI
  └─ API routes → loan-service → Postgres (Supabase)
Supabase Auth: one admin user
```

- Browser: `NEXT_PUBLIC_SUPABASE_URL` + anon/publishable key (Auth only)
- Server: Postgres URL(s) + service role for admin user bootstrap only
- Remove `better-sqlite3` and the dummy Supabase client

## Schema & migration

- Mirror **live** SQLite schema (including `loan_amount`, `balance`, `payment_frequency`, `penalty_per_day`, `interest_balance`, `penalty_balance`, `grace_period_days`, `loan_ledger.notes`)
- Money columns as `NUMERIC`
- No `payment_allocations` table
- Optional `profiles` row linked to `auth.users` for the admin
- One-shot migration: schema → insert in FK order preserving IDs → `setval` sequences → verify row counts and sample totals
- Keep local `db.sqlite` as offline backup (gitignored); app stops reading it

## Auth & security

- `/auth/login` with email/password
- Remove signup UX / auto-bypass
- Middleware protects app routes; API routes require session
- RLS enabled on public tables; authenticated policies for single-admin model
- Server DB credentials never exposed to the client

## Deploy

- `.env.example` with names only
- Document Vercel env vars and post-deploy admin password reset
- `pnpm build` must succeed without native SQLite

## Out of scope

Multi-user roles, invites, borrower portal, realtime.

## Verification

- Migration counts match SQLite
- Login required for pages and APIs
- Loan/payment flows work against Supabase
- Tests updated; `pnpm test` and `pnpm build` pass

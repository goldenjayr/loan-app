# Loan Share Link Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Admin creates a revocable public token link so a borrower can view one loan read-only (full statement + PDF) without login.

**Architecture:** `loan_share_links` table stores opaque tokens. Middleware allows `/share/*` without auth. Share page + report route resolve token → loan and reuse `loadLoanDetail` / PDF pipeline with a share-safe DTO.

**Tech Stack:** Next.js App Router, Supabase Postgres (`postgres` package), existing `lib/loan-service` + `lib/loan-report`.

## Global Constraints

- One active (non-revoked) link per loan; regenerate replaces it.
- Public URL uses token only — never loan id.
- Share PII: name, email, phone only (no address/ID).
- No admin chrome on share page.

---

### Task 1: Schema + share link helpers

- [ ] Add `scripts/supabase/002_loan_share_links.sql`
- [ ] Add `lib/share-links.ts` (create/getActive/revoke/resolveByToken)
- [ ] Apply migration to production DB
- [ ] Unit test token create/revoke resolve

### Task 2: Public routes + middleware

- [ ] Allow `/share` in middleware
- [ ] `app/share/[token]/page.tsx` (RSC) + client read-only UI
- [ ] `app/share/[token]/report/route.ts` PDF download

### Task 3: Admin API + loan detail Share UI

- [ ] `app/api/loans/[id]/share/route.ts` GET/POST/DELETE
- [ ] Share panel on loan detail client (create/copy/revoke)

### Task 4: Verify + deploy

- [ ] `pnpm test` + `pnpm build`
- [ ] Commit, push, `vercel --prod`
- [ ] Smoke-check share URL without login

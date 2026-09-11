# Loan Share Link (Read-Only) — Design

Date: 2026-09-11  
Status: Approved direction (awaiting user review of this spec)

## Goal

Let the admin share one loan with a borrower (or other person) via a link they can open immediately — no login — and see important loan information in read-only form, including PDF download.

## Non-goals

- Borrower accounts / magic-link auth
- Password on the share page
- Editing, recording payments, or viewing other loans
- Public listing of all loans

## Access model

**Tokenized share link** (approach #1).

- Public URL: `/share/[token]`
- Opaque, unguessable token (e.g. 32+ bytes, URL-safe)
- Valid until the admin **revokes** it
- After revoke, the old URL returns a simple “link no longer available” page
- Admin may **regenerate** (revoke old + create new) or create a fresh link

Middleware allows unauthenticated access only for:

- `/share/[token]` (page)
- Share PDF download route tied to that token (e.g. `/share/[token]/report` or `/api/share/[token]/report`)

All other routes remain admin-authenticated.

## What the recipient sees

### Borrower (contact)

- First name, last name
- Email
- Phone  
  (No address, ID type/number, or other PII)

### Loan essentials

- Status
- Outstanding balance
- Accrued interest / penalties (as already computed)
- Amount due to stay current
- Payoff today / total due
- Next due date (when available)
- Suggested / minimum installment guidance (same plain-language framing as admin detail, read-only)
- Key terms: principal/loan amount, monthly rate (and annual if shown elsewhere), interest type, term, disbursement / maturity when available

### Full statement (option C)

- Interest statement timeline (charges + payments)
- “Where payments went” breakdown
- No edit/delete payment actions

### PDF

- **Download PDF** button using the existing loan report builder, scoped to this loan via the share token (not the admin loan id alone)

## Admin UX

On the **loan detail** page:

- **Share loan** control
- States:
  - No link yet → **Create & copy link**
  - Active link → show truncated URL, **Copy**, **Revoke**
  - Optional: **Regenerate** (revoke + new token + copy)

Toast / feedback on copy and revoke.

## Data model

Table `loan_share_links`:

| Column | Type | Notes |
|--------|------|--------|
| `id` | serial / identity PK | |
| `loan_id` | int FK → loans | cascade or restrict on loan delete |
| `token` | text unique not null | indexed |
| `created_at` | timestamptz | default now |
| `revoked_at` | timestamptz nullable | null = active |
| `created_by` | text nullable | optional admin email/id for audit |

Rules:

- Prefer **at most one active** (non-revoked) link per loan for simplicity; creating again regenerates.
- Lookups always filter `revoked_at IS NULL`.

SQL migration under `scripts/supabase/`.

## Server behavior

1. Resolve token → loan_id (or 404 / revoked page).
2. Accrue / load summary the same way as admin detail (`loadLoanDetail` / `getLoanSummary`), but expose only the share-safe DTO (strip internal ids where unnecessary; never expose other borrowers’ loans).
3. PDF: same report pipeline, authorized by valid token only.

## UI notes

- Share page: clean, mobile-friendly, no admin chrome (no dashboard nav / sign out).
- Optional light branding (“Loan statement” + borrower name).
- Respect existing dark/light theme if root ThemeProvider applies; keep readable contrast.

## Security notes

- Tokens must be high-entropy; never use sequential loan ids in the public URL.
- Rate-limit consideration: rely on Vercel defaults initially; document if abuse appears.
- Revoke is immediate (DB update); no CDN cache of personalized HTML beyond short/private.
- PDF and HTML both require a currently valid token.

## Success criteria

- Admin can create, copy, and revoke a share link from loan detail.
- Recipient opens link without login and sees option C content + PDF download.
- Revoked link is unusable.
- Unauthenticated users cannot access `/loans/[id]` or admin APIs.

## Out of scope for v1

- Expiry dates
- Multiple concurrent active links per loan
- SMS/email send from the app (admin copies and sends manually)
- Watermarking / “viewed at” analytics

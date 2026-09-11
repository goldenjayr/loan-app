-- Loan share links: opaque public tokens for read-only borrower views

CREATE TABLE IF NOT EXISTS public.loan_share_links (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS loan_share_links_one_active_per_loan
  ON public.loan_share_links (loan_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS loan_share_links_token_active_idx
  ON public.loan_share_links (token)
  WHERE revoked_at IS NULL;

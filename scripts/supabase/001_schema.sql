-- Loan app schema for Supabase Postgres (mirrors live SQLite; integer PKs)

CREATE TABLE IF NOT EXISTS public.borrowers (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  zip_code TEXT,
  id_number TEXT,
  id_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loans (
  id SERIAL PRIMARY KEY,
  borrower_id INTEGER NOT NULL REFERENCES public.borrowers(id) ON DELETE RESTRICT,
  principal_amount NUMERIC(14, 2) NOT NULL,
  loan_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  interest_rate NUMERIC(8, 4) NOT NULL,
  interest_type TEXT NOT NULL DEFAULT 'simple',
  loan_term_months INTEGER NOT NULL,
  disbursement_date DATE NOT NULL,
  maturity_date DATE NOT NULL,
  payment_frequency TEXT NOT NULL DEFAULT 'monthly',
  penalty_per_day NUMERIC(8, 4) NOT NULL DEFAULT 0,
  grace_period_days INTEGER NOT NULL DEFAULT 7,
  interest_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  penalty_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.interest_accruals (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  accrual_date DATE NOT NULL,
  principal_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  accrued_interest NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (loan_id, accrual_date)
);

CREATE TABLE IF NOT EXISTS public.penalties (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  penalty_date DATE NOT NULL,
  penalty_type TEXT NOT NULL DEFAULT 'late',
  penalty_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  reason TEXT,
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loan_ledger (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  entry_type TEXT NOT NULL,
  principal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  interest NUMERIC(14, 2) NOT NULL DEFAULT 0,
  penalties NUMERIC(14, 2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0,
  principal_balance NUMERIC(14, 2),
  interest_balance NUMERIC(14, 2),
  penalty_balance NUMERIC(14, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.adjustments (
  id SERIAL PRIMARY KEY,
  loan_id INTEGER NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  adjustment_date DATE NOT NULL,
  adjustment_type TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  reason TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON public.loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_payments_loan_id ON public.payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_interest_accruals_loan_id ON public.interest_accruals(loan_id);
CREATE INDEX IF NOT EXISTS idx_interest_accruals_accrual_date ON public.interest_accruals(accrual_date);
CREATE INDEX IF NOT EXISTS idx_penalties_loan_id ON public.penalties(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_ledger_loan_id ON public.loan_ledger(loan_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_loan_id ON public.adjustments(loan_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON public.audit_logs(table_name, record_id);

ALTER TABLE public.borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_accruals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Single-admin model: any authenticated user can manage app data.
DO $$ BEGIN
  CREATE POLICY authenticated_all_borrowers ON public.borrowers FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY authenticated_all_loans ON public.loans FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY authenticated_all_payments ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY authenticated_all_accruals ON public.interest_accruals FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY authenticated_all_penalties ON public.penalties FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY authenticated_all_ledger ON public.loan_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY authenticated_all_adjustments ON public.adjustments FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY authenticated_all_audit ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY authenticated_select_own_profile ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY authenticated_update_own_profile ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

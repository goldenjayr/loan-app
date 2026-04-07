-- Borrowers table
CREATE TABLE IF NOT EXISTS public.borrowers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Loans table
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borrower_id UUID NOT NULL REFERENCES public.borrowers(id) ON DELETE RESTRICT,
  principal_amount DECIMAL(12, 2) NOT NULL,
  interest_rate DECIMAL(5, 2) NOT NULL,
  interest_type TEXT DEFAULT 'simple', -- simple or compound
  loan_term_months INTEGER NOT NULL,
  disbursement_date DATE NOT NULL,
  maturity_date DATE NOT NULL,
  status TEXT DEFAULT 'active', -- active, closed, defaulted
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Interest accruals table (tracks daily interest calculations)
CREATE TABLE IF NOT EXISTS public.interest_accruals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  accrual_date DATE NOT NULL,
  principal_balance DECIMAL(12, 2) NOT NULL,
  daily_interest DECIMAL(10, 2) NOT NULL,
  accrued_interest DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(loan_id, accrual_date)
);

-- Penalties table
CREATE TABLE IF NOT EXISTS public.penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  penalty_date DATE NOT NULL,
  penalty_type TEXT NOT NULL, -- late_payment, default, etc.
  penalty_amount DECIMAL(10, 2) NOT NULL,
  reason TEXT,
  applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_method TEXT DEFAULT 'cash', -- cash, check, transfer, etc.
  reference_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payment allocations table (tracks how each payment is applied)
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  allocation_type TEXT NOT NULL, -- penalties, interest, principal
  amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Adjustments table (manual adjustments to loan balances)
CREATE TABLE IF NOT EXISTS public.adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  adjustment_date DATE NOT NULL,
  adjustment_type TEXT NOT NULL, -- interest_waiver, penalty_waiver, principal_adjustment, etc.
  amount DECIMAL(12, 2) NOT NULL,
  reason TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Loan ledger view (denormalized for performance)
CREATE TABLE IF NOT EXISTS public.loan_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  entry_type TEXT NOT NULL, -- disbursement, interest_accrual, payment, penalty, adjustment
  principal DECIMAL(12, 2) DEFAULT 0,
  interest DECIMAL(12, 2) DEFAULT 0,
  penalties DECIMAL(12, 2) DEFAULT 0,
  amount_paid DECIMAL(12, 2) DEFAULT 0,
  principal_balance DECIMAL(12, 2),
  interest_balance DECIMAL(12, 2),
  penalty_balance DECIMAL(12, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table for auth
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'staff', -- admin, staff
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON public.loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_payments_loan_id ON public.payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_interest_accruals_loan_id ON public.interest_accruals(loan_id);
CREATE INDEX IF NOT EXISTS idx_interest_accruals_accrual_date ON public.interest_accruals(accrual_date);
CREATE INDEX IF NOT EXISTS idx_penalties_loan_id ON public.penalties(loan_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_loan_id ON public.adjustments(loan_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);

-- Enable RLS on all tables
ALTER TABLE public.borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_accruals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users to access data
-- Simplified to avoid infinite recursion in policy checks

-- Borrowers RLS
CREATE POLICY "authenticated_can_view_borrowers" ON public.borrowers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_insert_borrowers" ON public.borrowers
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_update_borrowers" ON public.borrowers
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Loans RLS
CREATE POLICY "authenticated_can_view_loans" ON public.loans
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_insert_loans" ON public.loans
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_update_loans" ON public.loans
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Payments RLS
CREATE POLICY "authenticated_can_view_payments" ON public.payments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_insert_payments" ON public.payments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_update_payments" ON public.payments
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Interest accruals RLS
CREATE POLICY "authenticated_can_view_accruals" ON public.interest_accruals
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_manage_accruals" ON public.interest_accruals
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Penalties RLS
CREATE POLICY "authenticated_can_view_penalties" ON public.penalties
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_manage_penalties" ON public.penalties
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Payment allocations RLS
CREATE POLICY "authenticated_can_view_allocations" ON public.payment_allocations
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_manage_allocations" ON public.payment_allocations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Adjustments RLS
CREATE POLICY "authenticated_can_view_adjustments" ON public.adjustments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_manage_adjustments" ON public.adjustments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Loan ledger RLS
CREATE POLICY "authenticated_can_view_ledger" ON public.loan_ledger
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_manage_ledger" ON public.loan_ledger
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Users RLS
CREATE POLICY "authenticated_can_view_users" ON public.users
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_manage_own_user" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Audit logs RLS
CREATE POLICY "authenticated_can_view_audit_logs" ON public.audit_logs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_insert_audit_logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

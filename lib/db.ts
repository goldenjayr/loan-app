import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(process.cwd(), 'db.sqlite')

// Ensure the SQLite file exists and has the schema
function initializeDb(db: Database.Database) {
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS borrowers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      borrower_id INTEGER NOT NULL REFERENCES borrowers(id) ON DELETE RESTRICT,
      principal_amount REAL NOT NULL,
      loan_amount REAL NOT NULL DEFAULT 0,
      balance REAL NOT NULL DEFAULT 0,
      interest_rate REAL NOT NULL,
      interest_type TEXT DEFAULT 'simple',
      loan_term_months INTEGER NOT NULL,
      disbursement_date DATE NOT NULL,
      maturity_date DATE NOT NULL,
      payment_frequency TEXT DEFAULT 'monthly',
      penalty_per_day REAL DEFAULT 0,
      interest_balance REAL NOT NULL DEFAULT 0,
      penalty_balance REAL NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
      payment_date DATE NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      reference_number TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS interest_accruals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
      accrual_date DATE NOT NULL,
      principal_balance REAL NOT NULL DEFAULT 0,
      daily_interest REAL NOT NULL DEFAULT 0,
      accrued_interest REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(loan_id, accrual_date)
    );

    CREATE TABLE IF NOT EXISTS penalties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
      penalty_date DATE NOT NULL,
      penalty_type TEXT NOT NULL DEFAULT 'late',
      penalty_amount REAL NOT NULL DEFAULT 0,
      reason TEXT,
      applied INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loan_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
      entry_date DATE NOT NULL,
      entry_type TEXT NOT NULL,
      principal REAL DEFAULT 0,
      interest REAL DEFAULT 0,
      penalties REAL DEFAULT 0,
      principal_balance REAL DEFAULT 0,
      interest_balance REAL DEFAULT 0,
      penalty_balance REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_loans_borrower_id ON loans(borrower_id);
    CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
    CREATE INDEX IF NOT EXISTS idx_payments_loan_id ON payments(loan_id);
    CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
    CREATE INDEX IF NOT EXISTS idx_interest_accruals_loan_id ON interest_accruals(loan_id);
    CREATE INDEX IF NOT EXISTS idx_penalties_loan_id ON penalties(loan_id);
    CREATE INDEX IF NOT EXISTS idx_loan_ledger_loan_id ON loan_ledger(loan_id);
  `)

  // Add missing columns to existing databases (safe migration)
  const existingLoansColumns = db.prepare("PRAGMA table_info(loans)").all() as any[]
  const loanColumnNames = existingLoansColumns.map((c: any) => c.name)

  if (!loanColumnNames.includes('loan_amount')) {
    db.exec(`ALTER TABLE loans ADD COLUMN loan_amount REAL NOT NULL DEFAULT 0;
             UPDATE loans SET loan_amount = principal_amount WHERE loan_amount = 0;`)
  }
  if (!loanColumnNames.includes('balance')) {
    db.exec(`ALTER TABLE loans ADD COLUMN balance REAL NOT NULL DEFAULT 0;
             UPDATE loans SET balance = principal_amount WHERE balance = 0;`)
  }
  if (!loanColumnNames.includes('payment_frequency')) {
    db.exec(`ALTER TABLE loans ADD COLUMN payment_frequency TEXT DEFAULT 'monthly';`)
  }
  if (!loanColumnNames.includes('penalty_per_day')) {
    db.exec(`ALTER TABLE loans ADD COLUMN penalty_per_day REAL DEFAULT 0;`)
  }
  if (!loanColumnNames.includes('interest_balance')) {
    db.exec(`ALTER TABLE loans ADD COLUMN interest_balance REAL NOT NULL DEFAULT 0;`)
  }
  if (!loanColumnNames.includes('penalty_balance')) {
    db.exec(`ALTER TABLE loans ADD COLUMN penalty_balance REAL NOT NULL DEFAULT 0;`)
  }

  // Sync existing totals to the new columns for data integrity
  db.exec(`
    UPDATE loans SET 
      interest_balance = COALESCE((SELECT SUM(accrued_interest) FROM interest_accruals WHERE loan_id = loans.id), 0),
      penalty_balance = COALESCE((SELECT SUM(penalty_amount) FROM penalties WHERE loan_id = loans.id), 0)
    WHERE interest_balance = 0 AND penalty_balance = 0;
  `)

  // Ensure loan_ledger has notes column
  const existingLedgerColumns = db.prepare("PRAGMA table_info(loan_ledger)").all() as any[]
  const ledgerColumnNames = existingLedgerColumns.map((c: any) => c.name)
  if (ledgerColumnNames.length > 0 && !ledgerColumnNames.includes('notes')) {
    db.exec(`ALTER TABLE loan_ledger ADD COLUMN notes TEXT;`)
  }
}

let _db: Database.Database | null = null

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    initializeDb(_db)
  }
  return _db
}

export default getDb
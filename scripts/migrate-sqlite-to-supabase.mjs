#!/usr/bin/env node
/**
 * One-shot SQLite → Supabase Postgres migration.
 * Preserves integer primary keys and resets sequences.
 *
 * Usage: node --env-file=.env.development.local scripts/migrate-sqlite-to-supabase.mjs
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import postgres from 'postgres'

const ROOT = process.cwd()
const SQLITE = path.join(ROOT, 'db.sqlite')
const SCHEMA = path.join(ROOT, 'scripts/supabase/001_schema.sql')

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
if (!url) {
  console.error('Missing POSTGRES_URL_NON_POOLING')
  process.exit(1)
}
if (!fs.existsSync(SQLITE)) {
  console.error('Missing db.sqlite')
  process.exit(1)
}

function sqliteJson(sql) {
  const out = execFileSync('sqlite3', ['-json', SQLITE, sql], { encoding: 'utf8' }).trim()
  if (!out) return []
  return JSON.parse(out)
}

function sqliteCount(table) {
  const row = sqliteJson(`SELECT COUNT(*) AS c FROM ${table}`)[0]
  return Number(row.c)
}

function num(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function bool(v) {
  return v === 1 || v === true || v === '1'
}

const TABLES = [
  'borrowers',
  'loans',
  'payments',
  'interest_accruals',
  'penalties',
  'loan_ledger',
  'adjustments',
  'audit_logs',
]

const sql = postgres(url, { max: 1, ssl: 'require' })

try {
  console.log('Applying schema…')
  const schemaSql = fs.readFileSync(SCHEMA, 'utf8')
  await sql.unsafe(schemaSql)

  console.log('Clearing target tables…')
  // FK order: children first
  await sql.unsafe(`
    TRUNCATE TABLE
      public.audit_logs,
      public.adjustments,
      public.loan_ledger,
      public.penalties,
      public.interest_accruals,
      public.payments,
      public.loans,
      public.borrowers
    RESTART IDENTITY CASCADE
  `)

  const borrowers = sqliteJson('SELECT * FROM borrowers ORDER BY id')
  for (const r of borrowers) {
    await sql`
      INSERT INTO borrowers (
        id, first_name, last_name, email, phone, address, city, province, zip_code,
        id_number, id_type, created_at, updated_at
      ) VALUES (
        ${r.id}, ${r.first_name}, ${r.last_name}, ${r.email}, ${r.phone}, ${r.address},
        ${r.city}, ${r.province}, ${r.zip_code}, ${r.id_number}, ${r.id_type},
        ${r.created_at}, ${r.updated_at}
      )
    `
  }
  console.log(`borrowers: ${borrowers.length}`)

  const loans = sqliteJson('SELECT * FROM loans ORDER BY id')
  for (const r of loans) {
    await sql`
      INSERT INTO loans (
        id, borrower_id, principal_amount, loan_amount, balance, interest_rate, interest_type,
        loan_term_months, disbursement_date, maturity_date, payment_frequency, penalty_per_day,
        grace_period_days, interest_balance, penalty_balance, status, notes, created_at, updated_at
      ) VALUES (
        ${r.id}, ${r.borrower_id}, ${num(r.principal_amount)}, ${num(r.loan_amount)}, ${num(r.balance)},
        ${num(r.interest_rate)}, ${r.interest_type || 'simple'}, ${r.loan_term_months},
        ${r.disbursement_date}, ${r.maturity_date}, ${r.payment_frequency || 'monthly'},
        ${num(r.penalty_per_day) ?? 0}, ${r.grace_period_days ?? 7},
        ${num(r.interest_balance) ?? 0}, ${num(r.penalty_balance) ?? 0},
        ${r.status || 'active'}, ${r.notes}, ${r.created_at}, ${r.updated_at}
      )
    `
  }
  console.log(`loans: ${loans.length}`)

  const payments = sqliteJson('SELECT * FROM payments ORDER BY id')
  for (const r of payments) {
    await sql`
      INSERT INTO payments (
        id, loan_id, payment_date, amount, payment_method, reference_number, notes, created_at, updated_at
      ) VALUES (
        ${r.id}, ${r.loan_id}, ${r.payment_date}, ${num(r.amount)}, ${r.payment_method || 'cash'},
        ${r.reference_number}, ${r.notes}, ${r.created_at}, ${r.updated_at}
      )
    `
  }
  console.log(`payments: ${payments.length}`)

  const accruals = sqliteJson('SELECT * FROM interest_accruals ORDER BY id')
  for (const r of accruals) {
    await sql`
      INSERT INTO interest_accruals (
        id, loan_id, accrual_date, principal_balance, accrued_interest, created_at
      ) VALUES (
        ${r.id}, ${r.loan_id}, ${r.accrual_date}, ${num(r.principal_balance) ?? 0},
        ${num(r.accrued_interest) ?? 0}, ${r.created_at}
      )
    `
  }
  console.log(`interest_accruals: ${accruals.length}`)

  const penalties = sqliteJson('SELECT * FROM penalties ORDER BY id')
  for (const r of penalties) {
    await sql`
      INSERT INTO penalties (
        id, loan_id, penalty_date, penalty_type, penalty_amount, reason, applied, created_at, updated_at
      ) VALUES (
        ${r.id}, ${r.loan_id}, ${r.penalty_date}, ${r.penalty_type || 'late'},
        ${num(r.penalty_amount) ?? 0}, ${r.reason}, ${bool(r.applied)}, ${r.created_at}, ${r.updated_at}
      )
    `
  }
  console.log(`penalties: ${penalties.length}`)

  const ledger = sqliteJson('SELECT * FROM loan_ledger ORDER BY id')
  for (const r of ledger) {
    await sql`
      INSERT INTO loan_ledger (
        id, loan_id, entry_date, entry_type, principal, interest, penalties, amount_paid,
        principal_balance, interest_balance, penalty_balance, notes, created_at
      ) VALUES (
        ${r.id}, ${r.loan_id}, ${r.entry_date}, ${r.entry_type},
        ${num(r.principal) ?? 0}, ${num(r.interest) ?? 0}, ${num(r.penalties) ?? 0},
        ${num(r.amount_paid) ?? 0}, ${num(r.principal_balance)}, ${num(r.interest_balance)},
        ${num(r.penalty_balance)}, ${r.notes ?? null}, ${r.created_at}
      )
    `
  }
  console.log(`loan_ledger: ${ledger.length}`)

  const adjustments = sqliteJson('SELECT * FROM adjustments ORDER BY id')
  for (const r of adjustments) {
    await sql`
      INSERT INTO adjustments (
        id, loan_id, adjustment_date, adjustment_type, amount, reason, created_by, created_at
      ) VALUES (
        ${r.id}, ${r.loan_id}, ${r.adjustment_date}, ${r.adjustment_type},
        ${num(r.amount)}, ${r.reason}, ${r.created_by}, ${r.created_at}
      )
    `
  }
  console.log(`adjustments: ${adjustments.length}`)

  const audits = sqliteJson('SELECT * FROM audit_logs ORDER BY id')
  for (const r of audits) {
    let oldValues = null
    let newValues = null
    try {
      oldValues = r.old_values ? JSON.parse(r.old_values) : null
    } catch {
      oldValues = { raw: r.old_values }
    }
    try {
      newValues = r.new_values ? JSON.parse(r.new_values) : null
    } catch {
      newValues = { raw: r.new_values }
    }
    await sql`
      INSERT INTO audit_logs (
        id, user_id, table_name, record_id, action, old_values, new_values, created_at
      ) VALUES (
        ${r.id}, ${null}, ${r.table_name}, ${r.record_id}, ${r.action},
        ${sql.json(oldValues)}, ${sql.json(newValues)}, ${r.created_at}
      )
    `
  }
  console.log(`audit_logs: ${audits.length}`)

  console.log('Resetting sequences…')
  for (const table of ['borrowers', 'loans', 'payments', 'interest_accruals', 'penalties', 'loan_ledger', 'adjustments', 'audit_logs']) {
    await sql.unsafe(`
      SELECT setval(
        pg_get_serial_sequence('public.${table}', 'id'),
        COALESCE((SELECT MAX(id) FROM public.${table}), 1),
        true
      )
    `)
  }

  console.log('\nVerification (sqlite → postgres):')
  let ok = true
  for (const table of TABLES) {
    const src = sqliteCount(table)
    const [row] = await sql.unsafe(`SELECT COUNT(*)::int AS c FROM public.${table}`)
    const dst = row.c
    const mark = src === dst ? 'OK' : 'MISMATCH'
    if (src !== dst) ok = false
    console.log(`  ${table}: ${src} → ${dst} [${mark}]`)
  }

  const [loanCheck] = await sql`
    SELECT id, balance::float8 AS balance, interest_balance::float8 AS interest_balance
    FROM loans WHERE id = 3
  `
  console.log('\nSpot-check loan 3:', loanCheck)

  if (!ok) {
    console.error('Migration verification FAILED')
    process.exit(1)
  }
  console.log('\nMigration verified.')
} finally {
  await sql.end({ timeout: 5 })
}

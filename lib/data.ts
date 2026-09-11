import { sql, num, dateStr } from '@/lib/db'
import { accrueLoan, getLoanSummary } from '@/lib/loan-service'
import { cache } from 'react'

function mapLoan(row: any) {
  return {
    ...row,
    principal_amount: num(row.principal_amount),
    loan_amount: num(row.loan_amount),
    balance: num(row.balance),
    interest_rate: num(row.interest_rate),
    interest_balance: num(row.interest_balance),
    penalty_balance: num(row.penalty_balance),
    penalty_per_day: num(row.penalty_per_day),
    disbursement_date: dateStr(row.disbursement_date),
    maturity_date: dateStr(row.maturity_date),
    borrower: row.borrower_first_name
      ? {
          first_name: row.borrower_first_name,
          last_name: row.borrower_last_name,
          email: row.borrower_email,
          phone: row.borrower_phone ?? null,
        }
      : null,
  }
}

/** Per-request deduped loan list (joined with borrower). */
export const listLoans = cache(async () => {
  const rows = await sql`
    SELECT
      l.*,
      b.first_name AS borrower_first_name,
      b.last_name AS borrower_last_name,
      b.email AS borrower_email,
      b.phone AS borrower_phone
    FROM loans l
    LEFT JOIN borrowers b ON l.borrower_id = b.id
    ORDER BY l.created_at DESC
  `
  return rows.map(mapLoan)
})

export const listBorrowers = cache(async () => {
  return sql`SELECT * FROM borrowers ORDER BY created_at DESC`
})

export const getBorrower = cache(async (id: number) => {
  const [row] = await sql`SELECT * FROM borrowers WHERE id = ${id}`
  return row ?? null
})

export const getLoan = cache(async (id: number) => {
  const [row] = await sql`
    SELECT
      l.*,
      b.first_name AS borrower_first_name,
      b.last_name AS borrower_last_name,
      b.email AS borrower_email,
      b.phone AS borrower_phone
    FROM loans l
    LEFT JOIN borrowers b ON l.borrower_id = b.id
    WHERE l.id = ${id}
  `
  if (!row) return null

  const [activity] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM payments WHERE loan_id = ${id})
      + (SELECT COUNT(*)::int FROM interest_accruals WHERE loan_id = ${id}) AS n
  `

  return {
    ...mapLoan(row),
    has_activity: Number(activity.n) > 0,
  }
})

export const listPaymentsForLoan = cache(async (loanId: number) => {
  const rows = await sql`
    SELECT * FROM payments
    WHERE loan_id = ${loanId}
    ORDER BY payment_date DESC, id DESC
  `
  return rows.map((p: any) => ({ ...p, amount: num(p.amount), payment_date: dateStr(p.payment_date) }))
})

export const getPayment = cache(async (id: number) => {
  const [row] = await sql`SELECT * FROM payments WHERE id = ${id}`
  if (!row) return null
  return { ...row, amount: num(row.amount), payment_date: dateStr(row.payment_date) }
})

export const listLoansForBorrower = cache(async (borrowerId: number) => {
  const rows = await sql`
    SELECT
      l.*,
      b.first_name AS borrower_first_name,
      b.last_name AS borrower_last_name,
      b.email AS borrower_email,
      b.phone AS borrower_phone
    FROM loans l
    LEFT JOIN borrowers b ON l.borrower_id = b.id
    WHERE l.borrower_id = ${borrowerId}
    ORDER BY l.created_at DESC
  `
  return rows.map(mapLoan)
})

/**
 * Accrue then load loan detail in parallel — one server round for the whole page.
 */
export async function loadLoanDetail(loanId: number) {
  await accrueLoan(loanId)
  const [loan, payments, summary] = await Promise.all([
    getLoan(loanId),
    listPaymentsForLoan(loanId),
    getLoanSummary(loanId),
  ])
  return { loan, payments, summary }
}

/** Public share: resolve token then load the same detail payload. */
export async function loadSharedLoanDetail(token: string) {
  const { resolveShareToken } = await import('@/lib/share-links')
  const link = await resolveShareToken(token)
  if (!link) return null
  const detail = await loadLoanDetail(link.loan_id)
  if (!detail.loan) return null
  return { ...detail, shareToken: link.token }
}

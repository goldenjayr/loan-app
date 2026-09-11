import { sql, num, dateStr } from '@/lib/db'
import { getLoanSummary } from '@/lib/loan-service'
import type { LoanReportData } from './types'

export class LoanReportNotFoundError extends Error {
  constructor(loanId: number) {
    super(`Loan ${loanId} not found`)
    this.name = 'LoanReportNotFoundError'
  }
}

export function slugifyBorrowerName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function buildLoanReportData(
  loanId: number,
  generatedAt: Date = new Date()
): Promise<LoanReportData> {
  const [loan] = await sql`
    SELECT
      l.*,
      b.first_name AS borrower_first_name,
      b.last_name AS borrower_last_name,
      b.email AS borrower_email
    FROM loans l
    LEFT JOIN borrowers b ON b.id = l.borrower_id
    WHERE l.id = ${loanId}
  `

  if (!loan) throw new LoanReportNotFoundError(loanId)

  return {
    loanId,
    borrower: {
      firstName: loan.borrower_first_name || '',
      lastName: loan.borrower_last_name || '',
      email: loan.borrower_email || null,
    },
    status: loan.status,
    terms: {
      originalPrincipal: num(loan.principal_amount || loan.loan_amount),
      outstandingPrincipal: num(loan.balance),
      interestRate: num(loan.interest_rate),
      interestType: loan.interest_type || 'simple',
      termMonths: Number(loan.loan_term_months || 0),
      paymentFrequency: loan.payment_frequency || 'monthly',
      disbursementDate: dateStr(loan.disbursement_date),
      maturityDate: dateStr(loan.maturity_date),
      penaltyPerDay: num(loan.penalty_per_day),
    },
    summary: await getLoanSummary(loanId),
    generatedAt,
  }
}

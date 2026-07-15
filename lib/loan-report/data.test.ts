import { describe, expect, it } from 'vitest'
import { buildLoanReportData, slugifyBorrowerName } from './data'

describe('loan report data', () => {
  it('creates a stable borrower slug for the download filename', () => {
    expect(slugifyBorrowerName('  Julie Ann Campugan  ')).toBe('julie-ann-campugan')
    expect(slugifyBorrowerName('María Dela Cruz')).toBe('maria-dela-cruz')
  })

  it('maps the current loan ledger without recomputing financial values', () => {
    const report = buildLoanReportData(3, new Date('2026-07-15T00:00:00+08:00'))

    expect(report.loanId).toBe(3)
    expect(report.borrower).toMatchObject({
      firstName: 'Julie Ann',
      lastName: 'Campugan',
      email: 'julie@gmail.com',
    })
    expect(report.summary.statement.outstandingBalance).toBe(87_850)
    expect(report.summary.statement.amountDueToStayCurrent).toBe(
      report.summary.accruedInterest + report.summary.penalties
    )
    expect(report.summary.statement.amountDueToStayCurrent).toBeGreaterThan(0)
    expect(report.summary.paymentBreakdown.items).toHaveLength(4)
    expect(report.generatedAt.toISOString()).toBe('2026-07-14T16:00:00.000Z')
  })
})

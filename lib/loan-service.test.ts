import { describe, expect, it } from 'vitest'
import {
  businessToday,
  computeLoanReplay,
  DEFAULT_GRACE_DAYS,
  diffLoanChange,
  validatePaymentDate,
} from './loan-service'

function makeLoan(
  interestType: 'simple' | 'compound',
  disbursed = '2026-01-01',
  opts: { penaltyPerDay?: number; graceDays?: number } = {}
) {
  return {
    principal_amount: 100000,
    loan_amount: 100000,
    balance: 100000,
    interest_rate: 12,
    interest_type: interestType,
    loan_term_months: 12,
    disbursement_date: disbursed,
    maturity_date: '2027-01-01',
    payment_frequency: 'monthly',
    penalty_per_day: opts.penaltyPerDay ?? 0,
    grace_period_days: opts.graceDays ?? DEFAULT_GRACE_DAYS,
    status: 'active',
  }
}

const AS_OF = new Date('2026-04-01T00:00:00Z')

describe('interest base', () => {
  it('simple charges on principal only', () => {
    const result = computeLoanReplay(makeLoan('simple'), [], AS_OF)
    expect(result.interestBalance).toBe(3000)
    expect(result.balance).toBe(100000)
  })

  it('compound charges on principal + unpaid interest carried forward', () => {
    const result = computeLoanReplay(makeLoan('compound'), [], AS_OF)
    expect(result.interestBalance).toBe(3030.1)
    expect(result.balance).toBe(100000)
  })

  it('compound base is net of what was paid', () => {
    const result = computeLoanReplay(
      makeLoan('compound'),
      [{ payment_date: '2026-02-01', amount: 500 }],
      AS_OF
    )
    expect(result.interestBalance).toBe(2520.05)
    expect(result.balance).toBe(100000)
  })
})

describe('monthly boundaries', () => {
  it('charges once per calendar month for a month-end loan', () => {
    const result = computeLoanReplay(
      makeLoan('compound', '2026-01-31'),
      [],
      new Date('2026-06-30T00:00:00Z')
    )
    const dates = result.accruals.map((a) => a.accrual_date)
    expect(dates).toEqual(['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30'])
    expect(new Set(dates.map((d) => d.slice(0, 7))).size).toBe(dates.length)
  })
})

describe('late penalties', () => {
  it('charges nothing while still inside the grace period', () => {
    const result = computeLoanReplay(
      makeLoan('compound', '2026-01-01', { penaltyPerDay: 1, graceDays: 7 }),
      [{ payment_date: '2026-02-06', amount: 1000 }],
      new Date('2026-02-10T00:00:00Z')
    )
    expect(result.penalties).toHaveLength(0)
    expect(result.penaltyBalance).toBe(0)
    expect(result.interestBalance).toBe(0)
  })

  it('charges on the overdue interest, not the whole principal', () => {
    const result = computeLoanReplay(
      makeLoan('compound', '2026-01-01', { penaltyPerDay: 1, graceDays: 7 }),
      [],
      new Date('2026-02-18T00:00:00Z')
    )
    expect(result.penaltyBalance).toBe(100)
    expect(result.penaltyBalance).toBeLessThan(result.interestBalance)
  })

  it('stops penalising once the interest is cleared (no penalty on penalties)', () => {
    const result = computeLoanReplay(
      makeLoan('compound', '2026-01-01', { penaltyPerDay: 1, graceDays: 7 }),
      [{ payment_date: '2026-02-18', amount: 1100 }],
      new Date('2026-02-25T00:00:00Z')
    )
    expect(result.penaltyBalance).toBe(0)
    expect(result.interestBalance).toBe(0)
    expect(result.penalties.filter((p) => p.penalty_date > '2026-02-18')).toHaveLength(0)
  })
})

describe('input and date handling', () => {
  it('treats "today" as the lender\'s calendar day, not UTC\'s', () => {
    const earlyManila = new Date('2026-09-08T01:00:00+08:00')
    expect(earlyManila.toISOString().split('T')[0]).toBe('2026-09-07')
    expect(businessToday(earlyManila)).toBe('2026-09-08')
    expect(validatePaymentDate('2026-09-08', earlyManila)).toBeNull()
    expect(validatePaymentDate('2026-09-09', earlyManila)).toMatch(/future/)
    expect(validatePaymentDate('nonsense', earlyManila)).toMatch(/Invalid/)
  })

  it('diffs loan term changes for the audit log', () => {
    const before = makeLoan('simple')
    const diff = diffLoanChange(before, { interest_type: 'compound', grace_period_days: 14 })
    expect(diff).toEqual({
      oldValues: { interest_type: 'simple', grace_period_days: 7 },
      newValues: { interest_type: 'compound', grace_period_days: 14 },
    })
    expect(diffLoanChange(before, { interest_type: 'simple' })).toBeNull()
  })
})

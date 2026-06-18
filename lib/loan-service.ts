import type Database from 'better-sqlite3'
import getDb from './db'
import { money, isZero } from './money'
import { calculateMonthlyPayment } from './calculations'

/**
 * LOAN FINANCIAL ENGINE — deterministic replay
 * --------------------------------------------
 * Model: reducing-balance interest.
 *   - At each payment-period boundary (from disbursement, stepped by
 *     payment_frequency), interest = current outstanding principal × periodRate.
 *   - Penalties accrue PER DAY on the overdue principal for as long as the loan
 *     is in arrears (a due date passed with unpaid interest). Arrears clears when
 *     a payment brings interest current.
 *   - Payments apply as a waterfall: penalties → interest → principal.
 *
 * `rebuildLoan` is the ONLY thing that mutates a loan's balances. It throws away
 * all derived rows (accruals, penalties, ledger) and replays the loan's events
 * (period boundaries + payments) in strict chronological order from the original
 * principal. This makes the engine:
 *   - self-healing: any historically corrupted balance is recomputed correctly;
 *   - drift-free: edit/delete of a payment is just "change the row, then rebuild";
 *   - idempotent: running it any number of times yields the same state.
 *
 * `rebuildLoan` does NOT open its own transaction — callers compose it inside one.
 * `accrueLoan` is the transactional public entry point.
 */

type Loan = any

const DAY_MS = 1000 * 60 * 60 * 24

function addPeriods(date: Date, frequency: string, count: number): Date {
  const d = new Date(date)
  switch (frequency) {
    case 'weekly':
      d.setDate(d.getDate() + 7 * count)
      break
    case 'biweekly':
      d.setDate(d.getDate() + 14 * count)
      break
    case 'quarterly':
      d.setMonth(d.getMonth() + 3 * count)
      break
    case 'monthly':
    default:
      d.setMonth(d.getMonth() + count)
      break
  }
  return d
}

function periodRate(annualRate: number, frequency: string): number {
  const annual = annualRate / 100
  switch (frequency) {
    case 'weekly':
      return annual / 52
    case 'biweekly':
      return annual / 26
    case 'quarterly':
      return annual / 4
    case 'monthly':
    default:
      return annual / 12
  }
}

function dateOnly(d: Date): string {
  return d.toISOString().split('T')[0]
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS)
}

type ReplayEvent =
  | { date: Date; kind: 'accrue'; order: number }
  | { date: Date; kind: 'pay'; order: number; payment: any }
  | { date: Date; kind: 'end'; order: number }

/**
 * Recompute a loan's entire state from its original principal by replaying every
 * accrual and payment in chronological order. Must run inside a transaction.
 */
export function rebuildLoan(db: Database.Database, loanId: number, asOfDate: Date = new Date()): Loan {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId) as Loan
  if (!loan) throw new Error('Loan not found')

  const frequency = loan.payment_frequency || 'monthly'
  const rate = periodRate(loan.interest_rate, frequency)
  const penaltyRate = (loan.penalty_per_day || 0) / 100
  const disburse = new Date(loan.disbursement_date)

  // Wipe all derived rows — they are regenerated below.
  db.prepare('DELETE FROM interest_accruals WHERE loan_id = ?').run(loanId)
  db.prepare('DELETE FROM penalties WHERE loan_id = ?').run(loanId)
  db.prepare('DELETE FROM loan_ledger WHERE loan_id = ?').run(loanId)

  let balance = money(loan.principal_amount || loan.loan_amount || 0)
  let interestBalance = 0
  let penaltyBalance = 0

  const payments = db
    .prepare('SELECT * FROM payments WHERE loan_id = ? ORDER BY date(payment_date) ASC, id ASC')
    .all(loanId) as any[]

  // Build the event timeline.
  const events: ReplayEvent[] = []
  if (rate > 0) {
    for (let n = 1; ; n++) {
      const b = addPeriods(disburse, frequency, n)
      if (b.getTime() > asOfDate.getTime()) break
      events.push({ date: b, kind: 'accrue', order: 0 })
    }
  }
  for (const p of payments) {
    events.push({ date: new Date(p.payment_date), kind: 'pay', order: 1, payment: p })
  }
  // Same date: accrue (0) before pay (1) so a payment can settle that day's interest.
  events.sort((a, b) => a.date.getTime() - b.date.getTime() || a.order - b.order)
  events.push({ date: asOfDate, kind: 'end', order: 2 }) // settle trailing penalty

  const insAccrual = db.prepare(`
    INSERT INTO interest_accruals (loan_id, accrued_interest, accrual_date, principal_balance, daily_interest)
    VALUES (?, ?, ?, ?, ?)
  `)
  const insPenalty = db.prepare(`
    INSERT INTO penalties (loan_id, penalty_amount, penalty_date, reason, penalty_type, applied)
    VALUES (?, ?, ?, ?, 'late', 1)
  `)
  const insLedger = db.prepare(`
    INSERT INTO loan_ledger (
      loan_id, entry_date, entry_type, principal, interest, penalties,
      principal_balance, interest_balance, penalty_balance, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  let inArrears = false
  let segStart = disburse // start of the current (unbilled) penalty segment

  for (const e of events) {
    // Charge per-day penalty for the gap [segStart, e.date] if overdue. Balance is
    // constant across this gap (it only changes at pay events, which are boundaries).
    if (inArrears && penaltyRate > 0 && balance > 0.005) {
      const days = daysBetween(segStart, e.date)
      if (days > 0) {
        const pen = money(balance * penaltyRate * days)
        if (pen > 0) {
          penaltyBalance = money(penaltyBalance + pen)
          insPenalty.run(loanId, pen, dateOnly(e.date), `Late penalty: ${days} day(s) overdue on ₱${balance.toLocaleString()}`)
          insLedger.run(loanId, dateOnly(e.date), 'penalty_charge', 0, 0, pen, balance, interestBalance, penaltyBalance, null)
        }
      }
    }
    segStart = e.date

    if (e.kind === 'accrue') {
      if (balance > 0.005) {
        const interest = money(balance * rate)
        if (interest > 0) {
          interestBalance = money(interestBalance + interest)
          insAccrual.run(loanId, interest, dateOnly(e.date), balance, money((balance * (loan.interest_rate / 100)) / 365))
          insLedger.run(loanId, dateOnly(e.date), 'interest_accrual', 0, interest, 0, balance, interestBalance, penaltyBalance, null)
        }
      }
      if (interestBalance > 0.005) inArrears = true
    } else if (e.kind === 'pay') {
      let remaining = money(e.payment.amount)
      const payPenalty = money(Math.min(remaining, penaltyBalance))
      remaining = money(remaining - payPenalty)
      const payInterest = money(Math.min(remaining, interestBalance))
      remaining = money(remaining - payInterest)
      const payPrincipal = money(Math.min(remaining, balance))

      penaltyBalance = money(penaltyBalance - payPenalty)
      interestBalance = money(interestBalance - payInterest)
      balance = money(balance - payPrincipal)

      insLedger.run(
        loanId,
        dateOnly(e.date),
        'payment',
        payPrincipal,
        payInterest,
        payPenalty,
        balance,
        interestBalance,
        penaltyBalance,
        null
      )

      // Brought current → arrears clears.
      if (isZero(interestBalance) && isZero(penaltyBalance)) inArrears = false
    }
  }

  // Status: completed when fully paid; otherwise active. A manual 'defaulted'
  // flag is preserved.
  let status = loan.status
  if (status !== 'defaulted') {
    status = isZero(balance) && isZero(interestBalance) && isZero(penaltyBalance) ? 'completed' : 'active'
  }

  db.prepare('UPDATE loans SET balance = ?, interest_balance = ?, penalty_balance = ?, status = ?, updated_at = ? WHERE id = ?').run(
    balance,
    interestBalance,
    penaltyBalance,
    status,
    new Date().toISOString(),
    loanId
  )

  return db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId)
}

/**
 * Public transactional entry point: recompute a loan's interest, penalties and
 * status as of `asOfDate`. Safe to call on demand (idempotent / self-healing).
 */
export function accrueLoan(loanId: number, asOfDate: Date = new Date()) {
  const db = getDb()
  return db.transaction(() => rebuildLoan(db, loanId, asOfDate))()
}

/**
 * Read-only period-by-period statement, derived entirely from the engine's own
 * accrual rows and balances (NOT a separate amortization model). This is what the
 * "amount due to stay current" card renders, so it always agrees with the
 * Financial Summary.
 *
 * "Due to stay current" = unpaid accrued interest + penalties (what the engine
 * actually treats as overdue). Principal is paid flexibly and is only fully due at
 * maturity, so it is not counted as overdue here. The `scheduledInstallment` is the
 * informational level payment that would clear the loan over its term.
 */
export function getLoanStatement(loanId: number, asOfDate: Date = new Date()) {
  const db = getDb()
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId) as Loan
  if (!loan) throw new Error('Loan not found')

  const frequency = loan.payment_frequency || 'monthly'
  const rate = periodRate(loan.interest_rate, frequency)
  const disburse = new Date(loan.disbursement_date)

  const balance = money(loan.balance || 0)
  const interestBalance = money(loan.interest_balance || 0)
  const penaltyBalance = money(loan.penalty_balance || 0)

  // Each accrual row is one elapsed period boundary, with the principal it was
  // charged on. Allocate interest paid (charged − still owed) oldest-first to mark
  // which periods are settled vs still outstanding.
  const accruals = db
    .prepare('SELECT accrual_date, principal_balance, accrued_interest FROM interest_accruals WHERE loan_id = ? ORDER BY date(accrual_date) ASC')
    .all(loanId) as any[]
  const totalInterestCharged = money(accruals.reduce((s, a) => s + a.accrued_interest, 0))
  let interestPaid = money(totalInterestCharged - interestBalance)

  const periods = accruals.map((a) => {
    const charged = money(a.accrued_interest)
    const paid = money(Math.min(interestPaid, charged))
    interestPaid = money(interestPaid - paid)
    const remaining = money(charged - paid)
    const past = new Date(a.accrual_date).getTime() < asOfDate.getTime()
    return {
      date: a.accrual_date,
      openingBalance: money(a.principal_balance),
      interestCharged: charged,
      interestPaid: paid,
      interestRemaining: remaining,
      status: remaining > 0.005 ? (past ? 'overdue' : 'due') : 'paid',
    }
  })

  // Next upcoming boundary and the interest it will charge (projected on the
  // current balance).
  let nextDueDate: Date | null = null
  for (let n = 1; n <= 600; n++) {
    const b = addPeriods(disburse, frequency, n)
    if (b.getTime() > asOfDate.getTime()) {
      nextDueDate = b
      break
    }
  }
  const nextInterestCharge = nextDueDate && balance > 0.005 ? money(balance * rate) : 0

  const amountDueToStayCurrent = money(interestBalance + penaltyBalance)
  const payoffToday = money(balance + interestBalance + penaltyBalance)
  // The level installment that clears the original loan over its full term.
  const suggestedMonthlyPayment = money(
    calculateMonthlyPayment(loan.principal_amount || loan.loan_amount || 0, loan.interest_rate, loan.loan_term_months)
  )

  return {
    outstandingBalance: balance,
    accruedInterest: interestBalance,
    penalties: penaltyBalance,
    totalDue: payoffToday,
    payoffToday,
    amountDueToStayCurrent,
    isOverdue: periods.some((p) => p.status === 'overdue') || penaltyBalance > 0.005,
    nextDueDate: nextDueDate ? dateOnly(nextDueDate) : null,
    nextInterestCharge,
    // Interest charged per period on the CURRENT balance (what "interest per month" is right now).
    monthlyInterest: money(balance * rate),
    suggestedMonthlyPayment,
    scheduledInstallment: suggestedMonthlyPayment,
    monthlyRatePct: money(loan.interest_rate / 12),
    termMonths: loan.loan_term_months,
    maturityDate: loan.maturity_date,
    periods,
  }
}

/**
 * Read-only per-payment breakdown: for each payment, how much went to penalties,
 * interest and principal (the waterfall split), plus the balance left afterward.
 * Derived from the ledger rows the rebuild already wrote (one 'payment' row per
 * payment, in chronological order), joined to the payments table for metadata.
 */
export function getPaymentBreakdown(loanId: number) {
  const db = getDb()

  const payments = db
    .prepare('SELECT id, payment_date, amount, payment_method, reference_number FROM payments WHERE loan_id = ? ORDER BY date(payment_date) ASC, id ASC')
    .all(loanId) as any[]
  const ledgerPays = db
    .prepare("SELECT entry_date, principal, interest, penalties, principal_balance, interest_balance, penalty_balance FROM loan_ledger WHERE loan_id = ? AND entry_type = 'payment' ORDER BY id ASC")
    .all(loanId) as any[]

  let totalToInterest = 0
  let totalToPrincipal = 0
  let totalToPenalty = 0

  const items = payments.map((p, i) => {
    const l = ledgerPays[i] || {}
    const toPenalty = money(l.penalties || 0)
    const toInterest = money(l.interest || 0)
    const toPrincipal = money(l.principal || 0)
    // What was outstanding right BEFORE this payment = what it paid + what remained after.
    const interestDueBefore = money(toInterest + (l.interest_balance || 0))
    const penaltyDueBefore = money(toPenalty + (l.penalty_balance || 0))
    totalToInterest = money(totalToInterest + toInterest)
    totalToPrincipal = money(totalToPrincipal + toPrincipal)
    totalToPenalty = money(totalToPenalty + toPenalty)
    return {
      id: p.id,
      date: p.payment_date,
      amount: money(p.amount),
      method: p.payment_method,
      reference: p.reference_number,
      toPenalty,
      toInterest,
      toPrincipal,
      interestDueBefore,
      penaltyDueBefore,
      // True when the payment was fully consumed by interest/penalties (nothing left for principal).
      fullyConsumedByInterest: toPrincipal <= 0.005 && toInterest > 0.005,
      balanceAfter: money(l.principal_balance || 0),
    }
  })

  return {
    items,
    totalToInterest,
    totalToPrincipal,
    totalToPenalty,
    totalPaid: money(totalToInterest + totalToPrincipal + totalToPenalty),
  }
}

/**
 * Read-only loan summary for display. Performs NO writes — call `accrueLoan`
 * (the accrue route) first so GETs stay idempotent.
 */
export function getLoanSummary(loanId: number) {
  const db = getDb()
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId) as Loan
  if (!loan) throw new Error('Loan not found')

  const payments = db.prepare('SELECT amount FROM payments WHERE loan_id = ?').all(loanId) as any[]
  const totalPaid = money(payments.reduce((sum, p) => sum + p.amount, 0))

  const balance = money(loan.balance || 0)
  const interestBalance = money(loan.interest_balance || 0)
  const penaltyBalance = money(loan.penalty_balance || 0)

  const statement = getLoanStatement(loanId)
  const paymentBreakdown = getPaymentBreakdown(loanId)

  return {
    loanAmount: loan.loan_amount,
    balance,
    totalPaid,
    paymentBreakdown,
    accruredInterest: interestBalance, // (key name kept for UI compatibility)
    accruedInterest: interestBalance,
    penalties: penaltyBalance,
    dueAmount: money(interestBalance + penaltyBalance),
    totalDue: money(balance + interestBalance + penaltyBalance),
    status: loan.status,
    interestRate: loan.interest_rate,
    loanTermMonths: loan.loan_term_months,
    disbursementDate: loan.disbursement_date,
    statement,
    calculationNotes: {
      // Unpaid interest carried forward — NOT balance × rate (that's next month's charge).
      interestFormula:
        interestBalance > 0.005
          ? `Unpaid accrued interest carried forward`
          : `Fully paid — next charge ₱${statement.nextInterestCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${statement.nextDueDate ? ` on ${statement.nextDueDate}` : ''}`,
      monthlyRate: `${(loan.interest_rate / 12).toFixed(2)}% monthly (reducing balance)`,
    },
  }
}

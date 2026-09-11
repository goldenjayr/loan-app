import { sql, num, dateStr } from './db'
import { money, isZero } from './money'

/**
 * LOAN FINANCIAL ENGINE — deterministic replay
 * --------------------------------------------
 * Model: reducing-balance interest, simple or compounding per `loans.interest_type`.
 *   - At each payment-period boundary (from disbursement, stepped by
 *     payment_frequency), interest = base × periodRate, where base is the
 *     outstanding principal ('simple') or principal + unpaid accrued interest
 *     ('compound' — unpaid interest is capitalised, as a bank would).
 *   - Penalties accrue PER DAY on the OVERDUE AMOUNT (the unpaid interest), not on
 *     the whole principal, and only after `grace_period_days` have passed since the
 *     interest was billed. Penalties stop the moment interest is cleared, so a
 *     penalty never itself earns a penalty.
 *   - Payments apply as a waterfall: penalties → interest → principal.
 *   - Interest keeps accruing past maturity_date BY DESIGN — a loan in default must
 *     not stop costing the borrower. `getLoanStatement` flags `pastMaturity` so the
 *     UI can say so.
 *
 * `rebuildLoan` is the ONLY thing that mutates a loan's balances. It throws away
 * all derived rows (accruals, penalties, ledger) and replays the loan's events
 * (period boundaries + payments) in strict chronological order from the original
 * principal.
 *
 * `rebuildLoan` does NOT open its own transaction — callers compose it inside one
 * (`sql.begin`). `accrueLoan` is the transactional public entry point.
 */

type Loan = any
type Payment = { id?: number; payment_date: string; amount: number }

const DAY_MS = 1000 * 60 * 60 * 24

export const DEFAULT_GRACE_DAYS = 7
export const BUSINESS_TIMEZONE = 'Asia/Manila'

export function businessToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function addPeriods(date: Date, frequency: string, count: number): Date {
  const d = new Date(date)
  switch (frequency) {
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7 * count)
      break
    case 'biweekly':
      d.setUTCDate(d.getUTCDate() + 14 * count)
      break
    case 'quarterly':
      addMonths(d, 3 * count)
      break
    case 'monthly':
    default:
      addMonths(d, count)
      break
  }
  return d
}

function addMonths(d: Date, months: number): void {
  const targetDay = d.getUTCDate()
  d.setUTCMonth(d.getUTCMonth() + months)
  if (d.getUTCDate() < targetDay) d.setUTCDate(0)
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

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

function annuityPayment(owed: number, ratePerPeriod: number, periods: number): number {
  if (periods <= 0) return owed
  if (ratePerPeriod === 0) return owed / periods
  const growth = Math.pow(1 + ratePerPeriod, periods)
  return (owed * ratePerPeriod * growth) / (growth - 1)
}

type ReplayEvent =
  | { date: Date; kind: 'accrue'; order: number }
  | { date: Date; kind: 'pay'; order: number; payment: Payment }
  | { date: Date; kind: 'end'; order: number }

export type LoanReplayResult = {
  balance: number
  interestBalance: number
  penaltyBalance: number
  status: string
  accruals: Array<{ accrued_interest: number; accrual_date: string; principal_balance: number }>
  penalties: Array<{ penalty_amount: number; penalty_date: string; reason: string }>
  ledger: Array<{
    entry_date: string
    entry_type: string
    principal: number
    interest: number
    penalties: number
    principal_balance: number
    interest_balance: number
    penalty_balance: number
    notes: string | null
  }>
}

/**
 * Pure replay — no DB I/O. Used by rebuildLoan and unit tests.
 */
export function computeLoanReplay(
  loan: Loan,
  payments: Payment[],
  asOfDate: Date = new Date()
): LoanReplayResult {
  const frequency = loan.payment_frequency || 'monthly'
  const rate = periodRate(num(loan.interest_rate), frequency)
  const penaltyRate = num(loan.penalty_per_day) / 100
  const graceDays = Math.max(0, loan.grace_period_days ?? DEFAULT_GRACE_DAYS)
  const disburse = new Date(dateStr(loan.disbursement_date))
  const compounding = (loan.interest_type || 'simple') === 'compound'

  let balance = money(num(loan.principal_amount || loan.loan_amount))
  let interestBalance = 0
  let penaltyBalance = 0

  const events: ReplayEvent[] = []
  if (rate > 0) {
    for (let n = 1; ; n++) {
      const b = addPeriods(disburse, frequency, n)
      if (b.getTime() > asOfDate.getTime()) break
      events.push({ date: b, kind: 'accrue', order: 0 })
    }
  }
  for (const p of payments) {
    events.push({
      date: new Date(dateStr(p.payment_date)),
      kind: 'pay',
      order: 1,
      payment: { ...p, amount: num(p.amount) },
    })
  }
  events.sort((a, b) => a.date.getTime() - b.date.getTime() || a.order - b.order)
  events.push({ date: asOfDate, kind: 'end', order: 2 })

  const accruals: LoanReplayResult['accruals'] = []
  const penalties: LoanReplayResult['penalties'] = []
  const ledger: LoanReplayResult['ledger'] = []

  let arrearsSince: Date | null = null
  let segStart = disburse

  for (const e of events) {
    if (arrearsSince && penaltyRate > 0 && interestBalance > 0.005) {
      const chargeFrom = addDays(arrearsSince, graceDays)
      const from = segStart.getTime() > chargeFrom.getTime() ? segStart : chargeFrom
      const days = daysBetween(from, e.date)
      if (days > 0) {
        const pen = money(interestBalance * penaltyRate * days)
        if (pen > 0) {
          penaltyBalance = money(penaltyBalance + pen)
          penalties.push({
            penalty_amount: pen,
            penalty_date: dateOnly(e.date),
            reason: `Late penalty: ${days} day(s) past the ${graceDays}-day grace on ₱${interestBalance.toLocaleString()} overdue interest`,
          })
          ledger.push({
            entry_date: dateOnly(e.date),
            entry_type: 'penalty_charge',
            principal: 0,
            interest: 0,
            penalties: pen,
            principal_balance: balance,
            interest_balance: interestBalance,
            penalty_balance: penaltyBalance,
            notes: null,
          })
        }
      }
    }
    segStart = e.date

    if (e.kind === 'accrue') {
      const base = compounding ? money(balance + interestBalance) : balance
      if (base > 0.005) {
        const interest = money(base * rate)
        if (interest > 0) {
          interestBalance = money(interestBalance + interest)
          accruals.push({
            accrued_interest: interest,
            accrual_date: dateOnly(e.date),
            principal_balance: base,
          })
          ledger.push({
            entry_date: dateOnly(e.date),
            entry_type: 'interest_accrual',
            principal: 0,
            interest,
            penalties: 0,
            principal_balance: balance,
            interest_balance: interestBalance,
            penalty_balance: penaltyBalance,
            notes: null,
          })
        }
      }
      if (interestBalance > 0.005 && !arrearsSince) arrearsSince = e.date
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

      ledger.push({
        entry_date: dateOnly(e.date),
        entry_type: 'payment',
        principal: payPrincipal,
        interest: payInterest,
        penalties: payPenalty,
        principal_balance: balance,
        interest_balance: interestBalance,
        penalty_balance: penaltyBalance,
        notes: null,
      })

      if (isZero(interestBalance)) arrearsSince = null
    }
  }

  let status = loan.status
  if (status !== 'defaulted') {
    status =
      isZero(balance) && isZero(interestBalance) && isZero(penaltyBalance) ? 'completed' : 'active'
  }

  return { balance, interestBalance, penaltyBalance, status, accruals, penalties, ledger }
}

type Sql = typeof sql

/**
 * Persist a full replay for `loanId`. Must run inside a transaction when composed
 * with other writes. Pass the transaction-scoped `sql` when inside `sql.begin`.
 */
export async function rebuildLoan(
  loanId: number,
  asOfDate: Date = new Date(),
  db: Sql = sql
): Promise<Loan> {
  const [loan] = await db`SELECT * FROM loans WHERE id = ${loanId}`
  if (!loan) throw new Error('Loan not found')

  const payments = await db`
    SELECT * FROM payments
    WHERE loan_id = ${loanId}
    ORDER BY payment_date ASC, id ASC
  `

  const result = computeLoanReplay(loan, payments as Payment[], asOfDate)

  await db`DELETE FROM interest_accruals WHERE loan_id = ${loanId}`
  await db`DELETE FROM penalties WHERE loan_id = ${loanId}`
  await db`DELETE FROM loan_ledger WHERE loan_id = ${loanId}`

  for (const a of result.accruals) {
    await db`
      INSERT INTO interest_accruals (loan_id, accrued_interest, accrual_date, principal_balance)
      VALUES (${loanId}, ${a.accrued_interest}, ${a.accrual_date}, ${a.principal_balance})
    `
  }
  for (const p of result.penalties) {
    await db`
      INSERT INTO penalties (loan_id, penalty_amount, penalty_date, reason, penalty_type, applied)
      VALUES (${loanId}, ${p.penalty_amount}, ${p.penalty_date}, ${p.reason}, 'late', true)
    `
  }
  for (const l of result.ledger) {
    await db`
      INSERT INTO loan_ledger (
        loan_id, entry_date, entry_type, principal, interest, penalties,
        principal_balance, interest_balance, penalty_balance, notes
      ) VALUES (
        ${loanId}, ${l.entry_date}, ${l.entry_type}, ${l.principal}, ${l.interest}, ${l.penalties},
        ${l.principal_balance}, ${l.interest_balance}, ${l.penalty_balance}, ${l.notes}
      )
    `
  }

  await db`
    UPDATE loans SET
      balance = ${result.balance},
      interest_balance = ${result.interestBalance},
      penalty_balance = ${result.penaltyBalance},
      status = ${result.status},
      updated_at = ${new Date().toISOString()}
    WHERE id = ${loanId}
  `

  const [updated] = await db`SELECT * FROM loans WHERE id = ${loanId}`
  return normalizeLoan(updated)
}

export function diffLoanChange(
  before: Record<string, any>,
  after: Record<string, any>
): { oldValues: Record<string, any>; newValues: Record<string, any> } | null {
  const oldValues: Record<string, any> = {}
  const newValues: Record<string, any> = {}
  for (const key of Object.keys(after)) {
    if (key === 'updated_at') continue
    if (before[key] !== after[key]) {
      oldValues[key] = before[key] ?? null
      newValues[key] = after[key]
    }
  }
  if (Object.keys(newValues).length === 0) return null
  return { oldValues, newValues }
}

export async function auditLoanChange(
  loanId: number,
  before: Record<string, any>,
  after: Record<string, any>,
  db: Sql = sql,
  userId: string | null = null
): Promise<void> {
  const diff = diffLoanChange(before, after)
  if (!diff) return
  await db`
    INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, user_id, created_at)
    VALUES (
      'loans',
      ${loanId},
      'UPDATE',
      ${db.json(diff.oldValues)},
      ${db.json(diff.newValues)},
      ${userId},
      ${new Date().toISOString()}
    )
  `
}

export function validatePaymentDate(value: string, now: Date = new Date()): string | null {
  const d = new Date(value)
  if (isNaN(d.getTime())) return 'Invalid payment date'
  if (dateOnly(d) > businessToday(now)) return 'Payment date cannot be in the future'
  return null
}

export async function accrueLoan(loanId: number, asOfDate: Date = new Date()) {
  return sql.begin(async (tx) => rebuildLoan(loanId, asOfDate, tx as unknown as Sql))
}

function normalizeLoan(loan: any): Loan {
  if (!loan) return loan
  return {
    ...loan,
    principal_amount: num(loan.principal_amount),
    loan_amount: num(loan.loan_amount),
    balance: num(loan.balance),
    interest_rate: num(loan.interest_rate),
    penalty_per_day: num(loan.penalty_per_day),
    interest_balance: num(loan.interest_balance),
    penalty_balance: num(loan.penalty_balance),
    grace_period_days: Number(loan.grace_period_days ?? DEFAULT_GRACE_DAYS),
    loan_term_months: Number(loan.loan_term_months),
    disbursement_date: dateStr(loan.disbursement_date),
    maturity_date: dateStr(loan.maturity_date),
  }
}

export async function getLoanStatement(loanId: number, asOfDate: Date = new Date()) {
  const [raw] = await sql`SELECT * FROM loans WHERE id = ${loanId}`
  if (!raw) throw new Error('Loan not found')
  const loan = normalizeLoan(raw)

  const frequency = loan.payment_frequency || 'monthly'
  const rate = periodRate(loan.interest_rate, frequency)
  const disburse = new Date(loan.disbursement_date)
  const graceDays = Math.max(0, loan.grace_period_days ?? DEFAULT_GRACE_DAYS)

  const balance = money(loan.balance || 0)
  const interestBalance = money(loan.interest_balance || 0)
  const penaltyBalance = money(loan.penalty_balance || 0)
  const compounding = (loan.interest_type || 'simple') === 'compound'
  const interestBase = compounding ? money(balance + interestBalance) : balance

  const accruals = await sql`
    SELECT accrual_date, principal_balance, accrued_interest
    FROM interest_accruals
    WHERE loan_id = ${loanId}
    ORDER BY accrual_date ASC
  `
  const totalInterestCharged = money(
    accruals.reduce((s: number, a: any) => s + num(a.accrued_interest), 0)
  )
  let interestPaid = money(totalInterestCharged - interestBalance)

  const periods = accruals.map((a: any, i: number) => {
    const charged = money(num(a.accrued_interest))
    const paid = money(Math.min(interestPaid, charged))
    interestPaid = money(interestPaid - paid)
    const remaining = money(charged - paid)
    const chargedDate = new Date(dateStr(a.accrual_date))
    const dueBy = addDays(chargedDate, graceDays)
    const past = dueBy.getTime() < asOfDate.getTime()
    const status = remaining > 0.005 ? (past ? 'overdue' : 'due') : 'paid'
    const periodStart = i > 0 ? dateStr(accruals[i - 1].accrual_date) : dateOnly(disburse)
    return {
      date: dateStr(a.accrual_date),
      periodStart,
      chargedOn: dateStr(a.accrual_date),
      openingBalance: money(num(a.principal_balance)),
      interestCharged: charged,
      interestPaid: paid,
      interestRemaining: remaining,
      status,
      dueBy: dateOnly(dueBy),
      daysOverdue: status === 'overdue' ? Math.max(0, daysBetween(dueBy, asOfDate)) : 0,
    }
  })

  let nextDueDate: Date | null = null
  for (let n = 1; n <= 600; n++) {
    const b = addPeriods(disburse, frequency, n)
    if (b.getTime() > asOfDate.getTime()) {
      nextDueDate = b
      break
    }
  }
  const nextInterestCharge = nextDueDate && interestBase > 0.005 ? money(interestBase * rate) : 0

  const pb = await getPaymentBreakdown(loanId)
  const timeline = [
    ...periods.map((p) => ({ kind: 'interest' as const, sort: new Date(p.date).getTime(), tie: 0, ...p })),
    ...pb.items.map((p) => ({ kind: 'payment' as const, sort: new Date(p.date).getTime(), tie: 1, ...p })),
  ].sort((a, b) => a.sort - b.sort || a.tie - b.tie)

  const amountDueToStayCurrent = money(interestBalance + penaltyBalance)
  const payoffToday = money(balance + interestBalance + penaltyBalance)

  const maturity = loan.maturity_date ? new Date(loan.maturity_date) : null
  const pastMaturity = Boolean(maturity && maturity.getTime() < asOfDate.getTime())
  let remainingPeriods = 0
  if (maturity) {
    for (let n = 1; n <= 600; n++) {
      if (addPeriods(disburse, frequency, n).getTime() > maturity.getTime()) break
      if (addPeriods(disburse, frequency, n).getTime() > asOfDate.getTime()) remainingPeriods++
    }
  }
  const suggestedMonthlyPayment = money(annuityPayment(payoffToday, rate, remainingPeriods))

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
    graceDays,
    remainingPeriods,
    pastMaturity,
    labels: {
      interestModel: compounding ? 'Compounding' : 'Reducing balance',
      installment: pastMaturity
        ? 'Past maturity — clears everything owed today in one payment.'
        : `Clears everything owed today over the ${remainingPeriods} period(s) left to ${loan.maturity_date}.`,
    },
    monthlyInterest: money(interestBase * rate),
    interestType: compounding ? 'compound' : 'simple',
    suggestedMonthlyPayment,
    scheduledInstallment: suggestedMonthlyPayment,
    monthlyRatePct: money(loan.interest_rate / 12),
    termMonths: loan.loan_term_months,
    maturityDate: loan.maturity_date,
    periods,
    timeline,
  }
}

export async function getPaymentBreakdown(loanId: number) {
  const payments = await sql`
    SELECT id, payment_date, amount, payment_method, reference_number
    FROM payments
    WHERE loan_id = ${loanId}
    ORDER BY payment_date ASC, id ASC
  `
  const ledgerPays = await sql`
    SELECT entry_date, principal, interest, penalties, principal_balance, interest_balance, penalty_balance
    FROM loan_ledger
    WHERE loan_id = ${loanId} AND entry_type = 'payment'
    ORDER BY id ASC
  `

  let totalToInterest = 0
  let totalToPrincipal = 0
  let totalToPenalty = 0

  const items = payments.map((p: any, i: number) => {
    const l = ledgerPays[i] || {}
    const toPenalty = money(num(l.penalties))
    const toInterest = money(num(l.interest))
    const toPrincipal = money(num(l.principal))
    const interestDueBefore = money(toInterest + num(l.interest_balance))
    const penaltyDueBefore = money(toPenalty + num(l.penalty_balance))
    totalToInterest = money(totalToInterest + toInterest)
    totalToPrincipal = money(totalToPrincipal + toPrincipal)
    totalToPenalty = money(totalToPenalty + toPenalty)
    return {
      id: p.id,
      date: dateStr(p.payment_date),
      amount: money(num(p.amount)),
      method: p.payment_method,
      reference: p.reference_number,
      toPenalty,
      toInterest,
      toPrincipal,
      interestDueBefore,
      penaltyDueBefore,
      fullyConsumedByInterest: toPrincipal <= 0.005 && toInterest > 0.005,
      balanceAfter: money(num(l.principal_balance)),
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

export async function getLoanSummary(loanId: number) {
  const [raw] = await sql`SELECT * FROM loans WHERE id = ${loanId}`
  if (!raw) throw new Error('Loan not found')
  const loan = normalizeLoan(raw)

  const payments = await sql`SELECT amount FROM payments WHERE loan_id = ${loanId}`
  const totalPaid = money(payments.reduce((sum: number, p: any) => sum + num(p.amount), 0))

  const balance = money(loan.balance || 0)
  const interestBalance = money(loan.interest_balance || 0)
  const penaltyBalance = money(loan.penalty_balance || 0)

  const statement = await getLoanStatement(loanId)
  const paymentBreakdown = await getPaymentBreakdown(loanId)

  return {
    loanAmount: loan.loan_amount,
    balance,
    totalPaid,
    paymentBreakdown,
    accruredInterest: interestBalance,
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
      interestFormula:
        interestBalance > 0.005
          ? `Unpaid accrued interest carried forward`
          : `Fully paid — next charge ₱${statement.nextInterestCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${statement.nextDueDate ? ` on ${statement.nextDueDate}` : ''}`,
      monthlyRate: `${(loan.interest_rate / 12).toFixed(2)}% monthly (${
        statement.interestType === 'compound' ? 'compounded on unpaid balance' : 'reducing balance'
      })`,
    },
  }
}

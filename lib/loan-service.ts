import getDb from './db'
import { calculateAccruedInterest, calculatePenalty } from './calculations'

/**
 * Process loan interest accrual
 */
export async function accrueInterest(
  loanId: number,
  asOfDate: Date = new Date()
) {
  const db = getDb()
  try {
    // Get loan details
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId) as any

    if (!loan) {
      throw new Error('Loan not found')
    }

    const asOfDateStr = asOfDate.toISOString().split('T')[0]

    // Check if interest already accrued for TODAY (or specific date)
    const existingDate = db.prepare(`
      SELECT * FROM interest_accruals 
      WHERE loan_id = ? 
      AND accrual_date = ?
      LIMIT 1
    `).get(loanId, asOfDateStr) as any

    if (existingDate) {
      // If we are forcing an update (e.g. from payment), update the existing record
      return { message: 'Existing accrual found' }
    }

    // Get last accrual date
    const lastAccrual = db.prepare(`
      SELECT accrual_date FROM interest_accruals 
      WHERE loan_id = ? 
      ORDER BY accrual_date DESC 
      LIMIT 1
    `).get(loanId) as any

    const lastAccrualDate = lastAccrual?.accrual_date
      ? new Date(lastAccrual.accrual_date)
      : new Date(loan.disbursement_date)

    const monthlyRate = loan.interest_rate / 100 / 12
    const targetMonthlyInterest = loan.principal_amount * monthlyRate // Use principal_amount or balance for the target

    // Calculate how much interest has ALREADY been accrued since the last milestone date
    const lastMilestoneDate = new Date(loan.disbursement_date)
    while (new Date(lastMilestoneDate.getTime() + 30 * 24 * 60 * 60 * 1000) < asOfDate) {
      lastMilestoneDate.setDate(lastMilestoneDate.getDate() + 30)
    }
    
    const accruedSinceMilestone = db.prepare(`
      SELECT SUM(accrued_interest) as total 
      FROM interest_accruals 
      WHERE loan_id = ? AND accrual_date >= ?
    `).get(loanId, lastMilestoneDate.toISOString().split('T')[0]) as any
    
    const alreadyAccrued = accruedSinceMilestone?.total || 0

    const dailyInterest = (loan.balance * (loan.interest_rate / 100)) / 365
    let interestAmount = calculateAccruedInterest(
      loan.balance,
      loan.interest_rate,
      lastAccrualDate,
      asOfDate,
      loan.interest_type
    )

    // Cap at the monthly target
    if (alreadyAccrued + interestAmount > targetMonthlyInterest) {
      interestAmount = Math.max(0, targetMonthlyInterest - alreadyAccrued)
    }

    if (interestAmount > 0) {
      const transaction = db.transaction(() => {
        const result = db.prepare(`
          INSERT INTO interest_accruals (
            loan_id, accrued_interest, accrual_date, principal_balance, daily_interest
          ) VALUES (?, ?, ?, ?, ?)
        `).run(
          loanId,
          interestAmount,
          asOfDateStr,
          loan.balance,
          (loan.balance * (loan.interest_rate / 100)) / 365
        )

        // Update interest balance in loans table
        db.prepare('UPDATE loans SET interest_balance = interest_balance + ?, updated_at = ? WHERE id = ?').run(
          interestAmount,
          asOfDateStr,
          loanId
        )

        // Record in ledger
        db.prepare(`
          INSERT INTO loan_ledger (
            loan_id, entry_date, entry_type, interest, interest_balance
          ) VALUES (?, ?, ?, ?, ?)
        `).run(
          loanId,
          asOfDateStr,
          'interest_accrual',
          interestAmount,
          loan.interest_balance + interestAmount
        )

        return result.lastInsertRowid
      })

      const lastId = transaction()
      return db.prepare('SELECT * FROM interest_accruals WHERE id = ?').get(lastId)
    }

    return { message: 'No interest to accrue' }
  } catch (error) {
    console.error('Error accruing interest:', error)
    throw error
  }
}

/**
 * Process late payment penalties
 */
export async function processPenalties(
  loanId: number,
  asOfDate: Date = new Date()
) {
  const db = getDb()
  try {
    // Get loan details
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId) as any

    if (!loan) {
      throw new Error('Loan not found')
    }

    // Get last payment
    const lastPayment = db.prepare(`
      SELECT payment_date FROM payments 
      WHERE loan_id = ? 
      ORDER BY payment_date DESC 
      LIMIT 1
    `).get(loanId) as any

    const referenceDate = lastPayment ? new Date(lastPayment.payment_date) : new Date(loan.disbursement_date)
    const daysDue = Math.floor((asOfDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24))

    const asOfDateStr = asOfDate.toISOString().split('T')[0]

    if (daysDue >= 30) {
      // Check if there's already a penalty for this period
      const penaltyPeriodStart = new Date(referenceDate)
      penaltyPeriodStart.setDate(penaltyPeriodStart.getDate() + 30)

      const existingPenalty = db.prepare(`
        SELECT * FROM penalties 
        WHERE loan_id = ? 
        AND penalty_date >= ?
        LIMIT 1
      `).get(loanId, penaltyPeriodStart.toISOString().split('T')[0])

      if (!existingPenalty) {
        const penaltyAmount = calculatePenalty(
          loan.balance,
          (loan.penalty_per_day || 0) / 100,
          Math.floor(daysDue / 30)
        )

        if (penaltyAmount > 0) {
          const transaction = db.transaction(() => {
            const result = db.prepare(`
              INSERT INTO penalties (
                loan_id, penalty_amount, penalty_date, reason, penalty_type, applied
              ) VALUES (?, ?, ?, ?, ?, ?)
            `).run(
              loanId,
              penaltyAmount,
              asOfDateStr,
              `Late payment penalty for ${Math.floor(daysDue / 30)} months`,
              'late',
              0
            )

            // Update penalty balance in loans table
            db.prepare('UPDATE loans SET penalty_balance = penalty_balance + ?, updated_at = ? WHERE id = ?').run(
              penaltyAmount,
              asOfDateStr,
              loanId
            )

            // Record in ledger
            db.prepare(`
              INSERT INTO loan_ledger (
                loan_id, entry_date, entry_type, penalties, penalty_balance
              ) VALUES (?, ?, ?, ?, ?)
            `).run(
              loanId,
              asOfDateStr,
              'penalty_charge',
              penaltyAmount,
              loan.penalty_balance + penaltyAmount
            )

            return result.lastInsertRowid
          })

          const lastId = transaction()
          return db.prepare('SELECT * FROM penalties WHERE id = ?').get(lastId)
        }
      }
    }

    return { message: 'No penalty to process' }
  } catch (error) {
    console.error('Error processing penalties:', error)
    throw error
  }
}

/**
 * Calculate loan summary/dashboard data
 */
export async function getLoanSummary(
  loanId: number
) {
  const db = getDb()
  try {
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId) as any

    if (!loan) throw new Error('Loan not found')

    // Automatically trigger accruals and penalties
    try {
      await accrueInterest(loanId)
      await processPenalties(loanId)
    } catch (e) {
      console.error('Failed to auto-accrue/penalty:', e)
      // We continue even if this fails, so the user sees the last known data
    }

    // Get all payments
    const payments = db.prepare('SELECT amount FROM payments WHERE loan_id = ?').all(loanId) as any[]
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

    // Get interest accruals
    const interests = db.prepare('SELECT accrued_interest FROM interest_accruals WHERE loan_id = ?').all(loanId) as any[]
    const totalInterest = interests.reduce((sum, i) => sum + i.accrued_interest, 0)

    // Get penalties
    const penalties = db.prepare('SELECT penalty_amount FROM penalties WHERE loan_id = ?').all(loanId) as any[]
    const totalPenalties = penalties.reduce((sum, p) => sum + p.penalty_amount, 0)

    return {
      loanAmount: loan.loan_amount,
      balance: loan.balance,
      totalPaid,
      accruredInterest: loan.interest_balance,
      penalties: loan.penalty_balance,
      dueAmount: loan.interest_balance + loan.penalty_balance,
      totalDue: Math.max(0, loan.balance + loan.interest_balance + loan.penalty_balance),
      status: loan.status,
      interestRate: loan.interest_rate,
      disbursementDate: loan.disbursement_date,
      calculationNotes: {
        interestFormula: `₱${loan.balance.toLocaleString()} × ${loan.interest_rate}% p.a.`,
        monthlyRate: `${(loan.interest_rate / 12).toFixed(2)}% monthly`
      }
    }
  } catch (error) {
    console.error('Error getting loan summary:', error)
    throw error
  }
}

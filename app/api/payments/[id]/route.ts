import getDb from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(parseInt(id))
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }
    return NextResponse.json(payment)
  } catch (error) {
    console.error('Error fetching payment:', error)
    return NextResponse.json({ error: 'Failed to fetch payment' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { amount, payment_date, payment_method, reference_number, notes } = body
    const paymentId = parseInt(id)
    const newAmount = parseFloat(amount)

    const db = getDb()

    const transaction = db.transaction(() => {
      // 1. Get current payment and ledger breakdown
      const payment = db.prepare('SELECT loan_id, amount FROM payments WHERE id = ?').get(paymentId) as any
      if (!payment) throw new Error('PAYMENT_NOT_FOUND')
      const loanId = payment.loan_id
      const oldTotalAmount = payment.amount

      const ledgerEntry = db.prepare(`
        SELECT principal, interest, penalties 
        FROM loan_ledger 
        WHERE loan_id = ? AND entry_type = 'payment' AND entry_date = (SELECT payment_date FROM payments WHERE id = ?)
        ORDER BY created_at DESC LIMIT 1
      `).get(loanId, paymentId) as any

      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId) as any
      if (!loan) throw new Error('LOAN_NOT_FOUND')

      // 2. Undo Old Payment Impacts
      // Fallback: If no ledger entry exists, assume the full amount was principal
      const oldPrincipal = ledgerEntry ? ledgerEntry.principal : oldTotalAmount
      const oldInterest = ledgerEntry ? ledgerEntry.interest : 0
      const oldPenalty = ledgerEntry ? ledgerEntry.penalties : 0
      
      const restoredBalance = loan.balance + oldPrincipal
      const restoredInterestBalance = loan.interest_balance + oldInterest
      const restoredPenaltyBalance = loan.penalty_balance + oldPenalty

      // 3. Apply New Payment (Waterfall with Protected Monthly Interest)
      let remaining = newAmount
      const now = new Date().toISOString()
      const monthlyRate = (loan.interest_rate || 0) / 100 / 12
      const targetMonthlyInterest = restoredBalance * monthlyRate
      
      const newPenaltyPayment = Math.min(remaining, restoredPenaltyBalance)
      const finalPenaltyBalance = restoredPenaltyBalance - newPenaltyPayment
      remaining -= newPenaltyPayment

      const newInterestPayment = Math.min(remaining, Math.max(targetMonthlyInterest, restoredInterestBalance))
      const finalInterestBalance = Math.max(0, restoredInterestBalance - newInterestPayment)
      remaining -= newInterestPayment

      const newPrincipalPayment = remaining
      const finalPrincipalBalance = Math.max(0, restoredBalance - newPrincipalPayment)

      // 4. Update Payment Record
      db.prepare(`
        UPDATE payments 
        SET amount = ?, payment_date = ?, payment_method = ?, reference_number = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `).run(newAmount, payment_date, payment_method, reference_number, notes, now, paymentId)

      // 5. Update Loan Balances
      db.prepare(`
        UPDATE loans 
        SET balance = ?, interest_balance = ?, penalty_balance = ?, updated_at = ?
        WHERE id = ?
      `).run(finalPrincipalBalance, finalInterestBalance, finalPenaltyBalance, now, loanId)

      // Catch-up accrual for early settlement
      const catchupAmount = newInterestPayment - restoredInterestBalance
      if (catchupAmount > 0) {
        db.prepare(`
          INSERT INTO interest_accruals (
            loan_id, accrued_interest, accrual_date, principal_balance, daily_interest
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(loan_id, accrual_date) DO UPDATE SET 
            accrued_interest = accrued_interest + excluded.accrued_interest
        `).run(
          loanId,
          catchupAmount,
          payment_date,
          finalPrincipalBalance,
          (finalPrincipalBalance * ((loan.interest_rate || 0) / 100)) / 365
        )
      }

      // 6. Update/Create Ledger entry for adjustment
      db.prepare(`
        INSERT INTO loan_ledger (
          loan_id, entry_date, entry_type, principal, interest, penalties,
          principal_balance, interest_balance, penalty_balance, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        loanId,
        payment_date,
        'payment_adjustment',
        newPrincipalPayment,
        newInterestPayment,
        newPenaltyPayment,
        finalPrincipalBalance,
        finalInterestBalance,
        finalPenaltyBalance,
        `Adjustment of payment ID ${paymentId}`
      )

      return { success: true }
    })

    transaction()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating payment:', error)
    return NextResponse.json({ error: error.message || 'Failed to update payment' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const paymentId = parseInt(id)
    const db = getDb()

    const transaction = db.transaction(() => {
      const payment = db.prepare('SELECT loan_id, amount FROM payments WHERE id = ?').get(paymentId) as any
      if (!payment) throw new Error('PAYMENT_NOT_FOUND')
      const loanId = payment.loan_id

      const ledgerEntry = db.prepare(`
        SELECT principal, interest, penalties 
        FROM loan_ledger 
        WHERE loan_id = ? AND entry_type = 'payment' 
        ORDER BY created_at DESC LIMIT 1
      `).get(loanId) as any

      const loan = db.prepare('SELECT balance, interest_balance, penalty_balance FROM loans WHERE id = ?').get(loanId) as any
      
      // Revert balance impacts
      const oldPrincipal = ledgerEntry?.principal || payment.amount 
      const oldInterest = ledgerEntry?.interest || 0
      const oldPenalty = ledgerEntry?.penalties || 0

      db.prepare(`
        UPDATE loans 
        SET balance = balance + ?, 
            interest_balance = interest_balance + ?, 
            penalty_balance = penalty_balance + ?, 
            updated_at = ?
        WHERE id = ?
      `).run(oldPrincipal, oldInterest, oldPenalty, new Date().toISOString(), loanId)

      // Delete payment
      db.prepare('DELETE FROM payments WHERE id = ?').run(paymentId)
      
      return { success: true }
    })

    transaction()
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting payment:', error)
    return NextResponse.json({ error: error.message || 'Failed to delete payment' }, { status: 500 })
  }
}

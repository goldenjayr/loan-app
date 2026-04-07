import getDb from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const loanId = searchParams.get('loan_id')

    const db = getDb()
    let data
    if (loanId) {
      data = db.prepare('SELECT * FROM payments WHERE loan_id = ? ORDER BY payment_date DESC').all(parseInt(loanId))
    } else {
      data = db.prepare('SELECT * FROM payments ORDER BY payment_date DESC').all()
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      loan_id,
      payment_amount, // from frontend
      payment_date,
      payment_method,
      reference_number,
      notes,
    } = body

    // Validation
    if (!loan_id || !payment_amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const amount = parseFloat(payment_amount)
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be positive' },
        { status: 400 }
      )
    }

    const db = getDb()

    // Start transaction
    const transaction = db.transaction(() => {
      // Check if loan exists and get balances
      const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(parseInt(loan_id)) as any
      if (!loan) {
        throw new Error('LOAN_NOT_FOUND')
      }

      const now = new Date().toISOString()
      
      // Insert payment
      const stmt = db.prepare(`
        INSERT INTO payments (
          loan_id, payment_date, amount, payment_method, reference_number, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const result = stmt.run(
        parseInt(loan_id),
        payment_date || now.split('T')[0],
        amount,
        payment_method || 'cash',
        reference_number || null,
        notes || null,
        now,
        now
      )

      // Waterfall Payment Logic
      let remaining = amount
      
      // 1. Pay Penalties
      const penaltyPayment = Math.min(remaining, loan.penalty_balance || 0)
      const newPenaltyBalance = (loan.penalty_balance || 0) - penaltyPayment
      remaining -= penaltyPayment

      // 2. Pay Interest (Protected Monthly Target)
      const monthlyRate = loan.interest_rate / 100 / 12
      // Using the current balance as the opening balance for the target interest calculation
      // matches the "Interest calculated against 100k" logic for the first month.
      const targetMonthlyInterest = (loan.balance || 0) * monthlyRate
      
      const interestPayment = Math.min(remaining, Math.max(targetMonthlyInterest, loan.interest_balance || 0))
      const newInterestBalance = Math.max(0, (loan.interest_balance || 0) - interestPayment)
      remaining -= interestPayment

      // 3. Pay Principal
      const principalPayment = remaining
      const newPrincipalBalance = Math.max(0, (loan.balance || 0) - principalPayment)

      // Update loan balances
      db.prepare(`
        UPDATE loans 
        SET balance = ?, 
            interest_balance = ?, 
            penalty_balance = ?, 
            updated_at = ? 
        WHERE id = ?
      `).run(
        newPrincipalBalance,
        newInterestBalance,
        newPenaltyBalance,
        now,
        parseInt(loan_id)
      )

      // If we paid more interest than what was currently accrued, 
      // record a catch-up entry in interest_accruals to satisfy the daily meter
      const catchupAmount = interestPayment - (loan.interest_balance || 0)
      if (catchupAmount > 0) {
        db.prepare(`
          INSERT INTO interest_accruals (
            loan_id, accrued_interest, accrual_date, principal_balance, daily_interest
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(loan_id, accrual_date) DO UPDATE SET 
            accrued_interest = accrued_interest + excluded.accrued_interest
        `).run(
          parseInt(loan_id),
          catchupAmount,
          payment_date || now.split('T')[0],
          loan.balance,
          (loan.balance * (loan.interest_rate / 100)) / 365
        )
      }

      // Record in ledger
      db.prepare(`
        INSERT INTO loan_ledger (
          loan_id, entry_date, entry_type, principal, interest, penalties, 
          principal_balance, interest_balance, penalty_balance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        parseInt(loan_id),
        payment_date || now.split('T')[0],
        'payment',
        principalPayment,
        interestPayment,
        penaltyPayment,
        newPrincipalBalance,
        newInterestBalance,
        newPenaltyBalance
      )

      return result.lastInsertRowid
    })

    try {
      const lastInsertId = transaction()
      const newPayment = db.prepare('SELECT * FROM payments WHERE id = ?').get(lastInsertId)
      return NextResponse.json(newPayment, { status: 201 })
    } catch (e: any) {
      if (e.message === 'LOAN_NOT_FOUND') {
        return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
      }
      throw e
    }
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    )
  }
}

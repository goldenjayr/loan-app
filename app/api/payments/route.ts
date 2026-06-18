import getDb from '@/lib/db'
import { rebuildLoan } from '@/lib/loan-service'
import { money } from '@/lib/money'
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

    const amount = money(parseFloat(payment_amount))
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be positive' },
        { status: 400 }
      )
    }

    const db = getDb()
    const now = new Date()
    const paymentDateStr = payment_date || now.toISOString().split('T')[0]
    // Accrue interest/penalties up to today (a back-dated payment must not stop
    // the clock), then replay payments in chronological order inside the rebuild.
    const asOfDate = now

    // Start transaction
    const transaction = db.transaction(() => {
      const loanIdNum = parseInt(loan_id)
      const exists = db.prepare('SELECT id FROM loans WHERE id = ?').get(loanIdNum)
      if (!exists) {
        throw new Error('LOAN_NOT_FOUND')
      }

      // Bring the loan fully current (interest + penalties) before validating the
      // payment, so we reject overpayments against an accurate total.
      const current = rebuildLoan(db, loanIdNum, asOfDate)
      const totalOwed = money((current.balance || 0) + (current.interest_balance || 0) + (current.penalty_balance || 0))
      if (amount > totalOwed + 0.005) {
        throw new Error(`OVERPAYMENT:${totalOwed}`)
      }

      const nowIso = now.toISOString()

      // Record the payment, then recompute the loan from scratch. The waterfall,
      // balances, ledger and status are all derived by the rebuild.
      const result = db.prepare(`
        INSERT INTO payments (
          loan_id, payment_date, amount, payment_method, reference_number, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        loanIdNum,
        paymentDateStr,
        amount,
        payment_method || 'cash',
        reference_number || null,
        notes || null,
        nowIso,
        nowIso
      )

      rebuildLoan(db, loanIdNum, asOfDate)

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
      if (typeof e.message === 'string' && e.message.startsWith('OVERPAYMENT:')) {
        const owed = parseFloat(e.message.split(':')[1])
        return NextResponse.json(
          { error: `Payment exceeds the total amount owed (₱${owed.toLocaleString()}). Reduce the payment amount.` },
          { status: 400 }
        )
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

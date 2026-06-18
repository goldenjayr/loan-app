import getDb from '@/lib/db'
import { rebuildLoan } from '@/lib/loan-service'
import { money } from '@/lib/money'
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
    const paymentId = parseInt(id)
    if (isNaN(paymentId)) {
      return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 })
    }

    const body = await request.json()
    const { amount, payment_date, payment_method, reference_number, notes } = body
    const newAmount = money(parseFloat(amount))
    if (!Number.isFinite(newAmount) || newAmount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be positive' }, { status: 400 })
    }

    const db = getDb()

    const transaction = db.transaction(() => {
      const payment = db.prepare('SELECT loan_id, payment_date FROM payments WHERE id = ?').get(paymentId) as any
      if (!payment) throw new Error('PAYMENT_NOT_FOUND')
      const loanId = payment.loan_id

      const now = new Date().toISOString()
      db.prepare(`
        UPDATE payments
        SET amount = ?, payment_date = ?, payment_method = ?, reference_number = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `).run(
        newAmount,
        payment_date || payment.payment_date,
        payment_method || 'cash',
        reference_number || null,
        notes || null,
        now,
        paymentId
      )

      // Recompute the whole loan from its (now edited) payment set.
      const loan = rebuildLoan(db, loanId)

      // Guard: an edit must not leave the loan over-paid (negative net). The
      // rebuild floors balances at zero, so detect a historical overpayment by
      // comparing total payments to the original principal + total charges.
      const totals = db
        .prepare("SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE loan_id = ?")
        .get(loanId) as any
      const charged = db
        .prepare(`
          SELECT COALESCE(SUM(accrued_interest),0) AS interest FROM interest_accruals WHERE loan_id = ?
        `)
        .get(loanId) as any
      const penaltyCharged = db
        .prepare('SELECT COALESCE(SUM(penalty_amount),0) AS pen FROM penalties WHERE loan_id = ?')
        .get(loanId) as any
      const capacity = money((loan.principal_amount || 0) + charged.interest + penaltyCharged.pen)
      if (totals.paid > capacity + 0.005) {
        throw new Error(`OVERPAYMENT:${capacity}`)
      }

      return loanId
    })

    try {
      transaction()
      const updated = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId)
      return NextResponse.json(updated)
    } catch (e: any) {
      if (e.message === 'PAYMENT_NOT_FOUND') {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
      }
      if (typeof e.message === 'string' && e.message.startsWith('OVERPAYMENT:')) {
        const cap = parseFloat(e.message.split(':')[1])
        return NextResponse.json(
          { error: `That amount would over-pay the loan (max payable across all payments is ₱${cap.toLocaleString()}).` },
          { status: 400 }
        )
      }
      throw e
    }
  } catch (error: any) {
    console.error('Error updating payment:', error)
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const paymentId = parseInt(id)
    if (isNaN(paymentId)) {
      return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 })
    }

    const db = getDb()

    const transaction = db.transaction(() => {
      const payment = db.prepare('SELECT loan_id FROM payments WHERE id = ?').get(paymentId) as any
      if (!payment) throw new Error('PAYMENT_NOT_FOUND')
      const loanId = payment.loan_id

      db.prepare('DELETE FROM payments WHERE id = ?').run(paymentId)

      // Recompute the loan from its remaining payments.
      rebuildLoan(db, loanId)
    })

    try {
      transaction()
      return NextResponse.json({ success: true })
    } catch (e: any) {
      if (e.message === 'PAYMENT_NOT_FOUND') {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
      }
      throw e
    }
  } catch (error: any) {
    console.error('Error deleting payment:', error)
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 })
  }
}

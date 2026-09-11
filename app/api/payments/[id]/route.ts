import { requireUser } from '@/lib/auth'
import { sql, num } from '@/lib/db'
import { rebuildLoan, validatePaymentDate } from '@/lib/loan-service'
import { money } from '@/lib/money'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireUser()
  if (errorResponse) return errorResponse

  try {
    const { id } = await params
    const [payment] = await sql`SELECT * FROM payments WHERE id = ${parseInt(id)}`
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }
    return NextResponse.json({ ...payment, amount: num(payment.amount) })
  } catch (error) {
    console.error('Error fetching payment:', error)
    return NextResponse.json({ error: 'Failed to fetch payment' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireUser()
  if (errorResponse) return errorResponse

  try {
    const { id } = await params
    const paymentId = parseInt(id)
    if (isNaN(paymentId)) {
      return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 })
    }

    const body = await request.json()
    const { amount, payment_date, payment_method, reference_number, notes } = body
    const newAmount = money(Number(amount))
    if (!Number.isFinite(newAmount) || newAmount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be positive' }, { status: 400 })
    }
    if (payment_date !== undefined && payment_date !== null) {
      const err = validatePaymentDate(payment_date)
      if (err) return NextResponse.json({ error: err }, { status: 400 })
    }

    try {
      await sql.begin(async (tx) => {
        const [payment] = await tx`SELECT loan_id, payment_date FROM payments WHERE id = ${paymentId}`
        if (!payment) throw new Error('PAYMENT_NOT_FOUND')
        const loanId = payment.loan_id as number

        const now = new Date().toISOString()
        await tx`
          UPDATE payments SET
            amount = ${newAmount},
            payment_date = ${payment_date || payment.payment_date},
            payment_method = ${payment_method || 'cash'},
            reference_number = ${reference_number || null},
            notes = ${notes || null},
            updated_at = ${now}
          WHERE id = ${paymentId}
        `

        const loan = await rebuildLoan(loanId, new Date(), tx as any)

        const [totals] = await tx`SELECT COALESCE(SUM(amount),0)::float8 AS paid FROM payments WHERE loan_id = ${loanId}`
        const [charged] = await tx`SELECT COALESCE(SUM(accrued_interest),0)::float8 AS interest FROM interest_accruals WHERE loan_id = ${loanId}`
        const [penaltyCharged] = await tx`SELECT COALESCE(SUM(penalty_amount),0)::float8 AS pen FROM penalties WHERE loan_id = ${loanId}`
        const capacity = money(num(loan.principal_amount) + num(charged.interest) + num(penaltyCharged.pen))
        if (num(totals.paid) > capacity + 0.005) {
          throw new Error(`OVERPAYMENT:${capacity}`)
        }
      })

      const [updated] = await sql`SELECT * FROM payments WHERE id = ${paymentId}`
      return NextResponse.json({ ...updated, amount: num(updated.amount) })
    } catch (e: any) {
      if (e.message === 'PAYMENT_NOT_FOUND') {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
      }
      if (typeof e.message === 'string' && e.message.startsWith('OVERPAYMENT:')) {
        const cap = parseFloat(e.message.split(':')[1])
        return NextResponse.json(
          {
            error: `That amount would over-pay the loan (max payable across all payments is ₱${cap.toLocaleString()}).`,
          },
          { status: 400 }
        )
      }
      throw e
    }
  } catch (error) {
    console.error('Error updating payment:', error)
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireUser()
  if (errorResponse) return errorResponse

  try {
    const { id } = await params
    const paymentId = parseInt(id)
    if (isNaN(paymentId)) {
      return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 })
    }

    try {
      await sql.begin(async (tx) => {
        const [payment] = await tx`SELECT loan_id FROM payments WHERE id = ${paymentId}`
        if (!payment) throw new Error('PAYMENT_NOT_FOUND')
        const loanId = payment.loan_id as number
        await tx`DELETE FROM payments WHERE id = ${paymentId}`
        await rebuildLoan(loanId, new Date(), tx as any)
      })
      return NextResponse.json({ success: true })
    } catch (e: any) {
      if (e.message === 'PAYMENT_NOT_FOUND') {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
      }
      throw e
    }
  } catch (error) {
    console.error('Error deleting payment:', error)
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 })
  }
}

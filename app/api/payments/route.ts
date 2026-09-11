import { requireUser } from '@/lib/auth'
import { sql, num } from '@/lib/db'
import { businessToday, rebuildLoan, validatePaymentDate } from '@/lib/loan-service'
import { money } from '@/lib/money'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { errorResponse } = await requireUser()
  if (errorResponse) return errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const loanId = searchParams.get('loan_id')

    const data = loanId
      ? await sql`SELECT * FROM payments WHERE loan_id = ${parseInt(loanId)} ORDER BY payment_date DESC`
      : await sql`SELECT * FROM payments ORDER BY payment_date DESC`

    return NextResponse.json(
      data.map((p: any) => ({
        ...p,
        amount: num(p.amount),
      }))
    )
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { errorResponse } = await requireUser()
  if (errorResponse) return errorResponse

  try {
    const body = await request.json()
    const {
      loan_id,
      payment_amount,
      payment_date,
      payment_method,
      reference_number,
      notes,
    } = body

    if (!loan_id || !payment_amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const amount = money(Number(payment_amount))
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be positive' }, { status: 400 })
    }

    const now = new Date()
    const paymentDateStr = payment_date || businessToday(now)
    const paymentDateErr = validatePaymentDate(paymentDateStr, now)
    if (paymentDateErr) {
      return NextResponse.json({ error: paymentDateErr }, { status: 400 })
    }
    const asOfDate = now
    const loanIdNum = parseInt(loan_id)

    try {
      const newPayment = await sql.begin(async (tx) => {
        const [exists] = await tx`SELECT id FROM loans WHERE id = ${loanIdNum}`
        if (!exists) throw new Error('LOAN_NOT_FOUND')

        const current = await rebuildLoan(loanIdNum, asOfDate, tx as any)
        const totalOwed = money(
          (current.balance || 0) + (current.interest_balance || 0) + (current.penalty_balance || 0)
        )
        if (amount > totalOwed + 0.005) {
          throw new Error(`OVERPAYMENT:${totalOwed}`)
        }

        const nowIso = now.toISOString()
        const [payment] = await tx`
          INSERT INTO payments (
            loan_id, payment_date, amount, payment_method, reference_number, notes, created_at, updated_at
          ) VALUES (
            ${loanIdNum}, ${paymentDateStr}, ${amount}, ${payment_method || 'cash'},
            ${reference_number || null}, ${notes || null}, ${nowIso}, ${nowIso}
          )
          RETURNING *
        `

        await rebuildLoan(loanIdNum, asOfDate, tx as any)
        return payment
      })

      return NextResponse.json(newPayment, { status: 201 })
    } catch (e: any) {
      if (e.message === 'LOAN_NOT_FOUND') {
        return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
      }
      if (typeof e.message === 'string' && e.message.startsWith('OVERPAYMENT:')) {
        const owed = parseFloat(e.message.split(':')[1])
        return NextResponse.json(
          {
            error: `Payment exceeds the total amount owed (₱${owed.toLocaleString()}). Reduce the payment amount.`,
          },
          { status: 400 }
        )
      }
      throw e
    }
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}

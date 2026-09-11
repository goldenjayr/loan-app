import { requireUser } from '@/lib/auth'
import { sql, num } from '@/lib/db'
import { auditLoanChange, rebuildLoan } from '@/lib/loan-service'
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
    const loanId = parseInt(id)
    if (isNaN(loanId)) {
      return NextResponse.json({ error: 'Invalid loan ID' }, { status: 400 })
    }

    const [loan] = await sql`
      SELECT l.*, b.first_name as borrower_first_name, b.last_name as borrower_last_name, b.email as borrower_email
      FROM loans l LEFT JOIN borrowers b ON l.borrower_id = b.id
      WHERE l.id = ${loanId}
    `

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    const [activity] = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM payments WHERE loan_id = ${loanId})
        + (SELECT COUNT(*)::int FROM interest_accruals WHERE loan_id = ${loanId}) AS n
    `

    const data = {
      ...loan,
      principal_amount: num(loan.principal_amount),
      loan_amount: num(loan.loan_amount),
      balance: num(loan.balance),
      interest_rate: num(loan.interest_rate),
      interest_balance: num(loan.interest_balance),
      penalty_balance: num(loan.penalty_balance),
      penalty_per_day: num(loan.penalty_per_day),
      has_activity: Number(activity.n) > 0,
      borrower: loan.borrower_first_name
        ? {
            first_name: loan.borrower_first_name,
            last_name: loan.borrower_last_name,
            email: loan.borrower_email,
          }
        : null,
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching loan:', error)
    return NextResponse.json({ error: 'Failed to fetch loan' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser()
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { id } = await params
    const loanId = parseInt(id)
    if (isNaN(loanId)) {
      return NextResponse.json({ error: 'Invalid loan ID' }, { status: 400 })
    }

    const [loan] = await sql`SELECT * FROM loans WHERE id = ${loanId}`
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    const body = await request.json()

    const [paymentCountRow] = await sql`SELECT COUNT(*)::int AS c FROM payments WHERE loan_id = ${loanId}`
    const [accrualCountRow] = await sql`SELECT COUNT(*)::int AS c FROM interest_accruals WHERE loan_id = ${loanId}`
    const hasActivity = paymentCountRow.c > 0 || accrualCountRow.c > 0

    const updates: Record<string, any> = {}

    if (body.notes !== undefined) updates.notes = body.notes || null
    if (body.payment_frequency !== undefined) updates.payment_frequency = body.payment_frequency
    if (body.interest_rate !== undefined) {
      const rate = Number(body.interest_rate)
      if (!Number.isFinite(rate) || rate < 0) {
        return NextResponse.json({ error: 'Interest rate must be zero or a positive number' }, { status: 400 })
      }
      updates.interest_rate = rate
    }
    if (body.penalty_per_day !== undefined) {
      const penalty = Number(body.penalty_per_day)
      if (!Number.isFinite(penalty) || penalty < 0) {
        return NextResponse.json({ error: 'Penalty per day must be zero or a positive number' }, { status: 400 })
      }
      updates.penalty_per_day = penalty
    }
    if (body.status !== undefined) {
      const allowed = ['active', 'completed', 'defaulted']
      if (!allowed.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      updates.status = body.status
    }
    if (body.grace_period_days !== undefined) {
      const grace = Number(body.grace_period_days)
      if (!Number.isInteger(grace) || grace < 0) {
        return NextResponse.json({ error: 'Grace period must be zero or a positive whole number of days' }, { status: 400 })
      }
      updates.grace_period_days = grace
    }
    if (body.interest_type !== undefined) {
      if (!['simple', 'compound'].includes(body.interest_type)) {
        return NextResponse.json({ error: "Interest type must be 'simple' or 'compound'" }, { status: 400 })
      }
      updates.interest_type = body.interest_type
    }

    const wantsCoreEdit =
      body.loan_amount !== undefined ||
      body.disbursement_date !== undefined ||
      body.loan_term_months !== undefined

    if (wantsCoreEdit) {
      if (hasActivity) {
        return NextResponse.json(
          {
            error:
              'Cannot change loan amount, term or disbursement date after payments or interest exist. Edit these only before activity, or create a new loan.',
          },
          { status: 400 }
        )
      }

      let amount = num(loan.loan_amount)
      if (body.loan_amount !== undefined) {
        amount = money(Number(body.loan_amount))
        if (!Number.isFinite(amount) || amount <= 0) {
          return NextResponse.json({ error: 'Loan amount must be a positive number' }, { status: 400 })
        }
        updates.loan_amount = amount
        updates.principal_amount = amount
        updates.balance = amount
      }
      let term = Number(loan.loan_term_months)
      if (body.loan_term_months !== undefined) {
        term = Number(body.loan_term_months)
        if (!Number.isInteger(term) || term <= 0) {
          return NextResponse.json({ error: 'Loan term must be a positive whole number of months' }, { status: 400 })
        }
        updates.loan_term_months = term
      }

      let disbursement = loan.disbursement_date
      if (body.disbursement_date !== undefined) {
        if (isNaN(new Date(body.disbursement_date).getTime())) {
          return NextResponse.json({ error: 'Invalid disbursement date' }, { status: 400 })
        }
        disbursement = body.disbursement_date
        updates.disbursement_date = disbursement
      }

      if (body.disbursement_date !== undefined || body.loan_term_months !== undefined) {
        const d = new Date(disbursement)
        const targetDay = d.getDate()
        d.setMonth(d.getMonth() + term)
        if (d.getDate() < targetDay) d.setDate(0)
        updates.maturity_date = d.toISOString().split('T')[0]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const affectsReplay = [
      'interest_type',
      'interest_rate',
      'penalty_per_day',
      'grace_period_days',
      'payment_frequency',
      'loan_amount',
      'disbursement_date',
      'loan_term_months',
    ].some((c) => c in updates)

    const updated = await sql.begin(async (tx) => {
      await auditLoanChange(loanId, loan, updates, tx as any, auth.user!.id)
      await tx`UPDATE loans SET ${tx(updates)} WHERE id = ${loanId}`
      if (affectsReplay) await rebuildLoan(loanId, new Date(), tx as any)
      const [row] = await tx`SELECT * FROM loans WHERE id = ${loanId}`
      return row
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating loan:', error)
    return NextResponse.json({ error: 'Failed to update loan' }, { status: 500 })
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
    const loanId = parseInt(id)
    if (isNaN(loanId)) {
      return NextResponse.json({ error: 'Invalid loan ID' }, { status: 400 })
    }

    const [loan] = await sql`SELECT id FROM loans WHERE id = ${loanId}`
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    await sql`DELETE FROM loans WHERE id = ${loanId}`
    return NextResponse.json({ message: 'Loan deleted successfully' })
  } catch (error) {
    console.error('Error deleting loan:', error)
    return NextResponse.json({ error: 'Failed to delete loan' }, { status: 500 })
  }
}

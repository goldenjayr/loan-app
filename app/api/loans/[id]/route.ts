import getDb from '@/lib/db'
import { money } from '@/lib/money'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const loanId = parseInt(id)
    if (isNaN(loanId)) {
      return NextResponse.json({ error: 'Invalid loan ID' }, { status: 400 })
    }

    const db = getDb()
    const loan = db.prepare(`
      SELECT l.*, b.first_name as borrower_first_name, b.last_name as borrower_last_name, b.email as borrower_email
      FROM loans l LEFT JOIN borrowers b ON l.borrower_id = b.id
      WHERE l.id = ?
    `).get(loanId) as any

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    const data = {
      ...loan,
      borrower: loan.borrower_first_name
        ? { first_name: loan.borrower_first_name, last_name: loan.borrower_last_name, email: loan.borrower_email }
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
  try {
    const { id } = await params
    const loanId = parseInt(id)
    if (isNaN(loanId)) {
      return NextResponse.json({ error: 'Invalid loan ID' }, { status: 400 })
    }

    const db = getDb()
    const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId) as any
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    const body = await request.json()

    // A loan that has already had payments or interest accrued cannot have its core
    // financial terms changed (that would corrupt history). Only such loans may edit
    // amount / disbursement date / term / interest type.
    const paymentCount = (db.prepare('SELECT COUNT(*) AS c FROM payments WHERE loan_id = ?').get(loanId) as any).c
    const accrualCount = (db.prepare('SELECT COUNT(*) AS c FROM interest_accruals WHERE loan_id = ?').get(loanId) as any).c
    const hasActivity = paymentCount > 0 || accrualCount > 0

    const updates: Record<string, any> = {}

    // Always-editable fields.
    if (body.notes !== undefined) updates.notes = body.notes || null
    if (body.payment_frequency !== undefined) updates.payment_frequency = body.payment_frequency
    if (body.interest_rate !== undefined) {
      const rate = parseFloat(body.interest_rate)
      if (!Number.isFinite(rate) || rate < 0) {
        return NextResponse.json({ error: 'Interest rate must be zero or a positive number' }, { status: 400 })
      }
      updates.interest_rate = rate
    }
    if (body.penalty_per_day !== undefined) {
      const penalty = parseFloat(body.penalty_per_day)
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

    // Core financial fields — only when the loan has no activity yet.
    const wantsCoreEdit =
      body.loan_amount !== undefined ||
      body.disbursement_date !== undefined ||
      body.loan_term_months !== undefined ||
      body.interest_type !== undefined

    if (wantsCoreEdit) {
      if (hasActivity) {
        return NextResponse.json(
          { error: 'Cannot change loan amount, term, disbursement date or interest type after payments or interest exist. Edit these only before activity, or create a new loan.' },
          { status: 400 }
        )
      }

      let amount = loan.loan_amount
      if (body.loan_amount !== undefined) {
        amount = money(parseFloat(body.loan_amount))
        if (!Number.isFinite(amount) || amount <= 0) {
          return NextResponse.json({ error: 'Loan amount must be a positive number' }, { status: 400 })
        }
        // No activity yet, so principal/balance track the new amount.
        updates.loan_amount = amount
        updates.principal_amount = amount
        updates.balance = amount
      }
      if (body.interest_type !== undefined) updates.interest_type = body.interest_type

      let term = loan.loan_term_months
      if (body.loan_term_months !== undefined) {
        term = parseInt(body.loan_term_months)
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

      // Recompute maturity if disbursement or term changed.
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
    const cols = Object.keys(updates)
    const setClause = cols.map((c) => `${c} = ?`).join(', ')
    db.prepare(`UPDATE loans SET ${setClause} WHERE id = ?`).run(...cols.map((c) => updates[c]), loanId)

    const updated = db.prepare('SELECT * FROM loans WHERE id = ?').get(loanId)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating loan:', error)
    return NextResponse.json({ error: 'Failed to update loan' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const loanId = parseInt(id)
    if (isNaN(loanId)) {
      return NextResponse.json({ error: 'Invalid loan ID' }, { status: 400 })
    }

    const db = getDb()
    
    // Check if loan exists
    const loan = db.prepare('SELECT id FROM loans WHERE id = ?').get(loanId)
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    // Delete loan (cascading deletes for payments, accruals, penalties are handled by DB)
    db.prepare('DELETE FROM loans WHERE id = ?').run(loanId)

    return NextResponse.json({ message: 'Loan deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting loan:', error)
    return NextResponse.json(
      { error: 'Failed to delete loan' },
      { status: 500 }
    )
  }
}

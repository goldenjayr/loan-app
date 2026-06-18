import getDb from '@/lib/db'
import { money } from '@/lib/money'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const db = getDb()
    const loans = db.prepare(`
      SELECT 
        l.*,
        b.first_name as borrower_first_name,
        b.last_name as borrower_last_name,
        b.email as borrower_email
      FROM loans l
      LEFT JOIN borrowers b ON l.borrower_id = b.id
      ORDER BY l.created_at DESC
    `).all() as any[]

    const data = loans.map(loan => ({
      ...loan,
      borrower: loan.borrower_first_name ? {
        first_name: loan.borrower_first_name,
        last_name: loan.borrower_last_name,
        email: loan.borrower_email,
      } : null,
    }))

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching loans:', error)
    return NextResponse.json(
      { error: 'Failed to fetch loans' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      borrower_id,
      loan_amount,
      interest_rate,
      interest_type,
      loan_term_months,
      disbursement_date,
      payment_frequency,
      penalty_per_day,
      notes,
    } = body

    // Validation
    if (!borrower_id || !loan_amount || !interest_rate || !loan_term_months || !disbursement_date) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const amount = money(parseFloat(loan_amount))
    const rate = parseFloat(interest_rate)
    const term = parseInt(loan_term_months)
    const penalty = parseFloat(penalty_per_day || 0)

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Loan amount must be a positive number' }, { status: 400 })
    }
    if (!Number.isFinite(rate) || rate < 0) {
      return NextResponse.json({ error: 'Interest rate must be zero or a positive number' }, { status: 400 })
    }
    if (!Number.isInteger(term) || term <= 0) {
      return NextResponse.json({ error: 'Loan term must be a positive whole number of months' }, { status: 400 })
    }
    if (!Number.isFinite(penalty) || penalty < 0) {
      return NextResponse.json({ error: 'Penalty per day must be zero or a positive number' }, { status: 400 })
    }
    if (isNaN(new Date(disbursement_date).getTime())) {
      return NextResponse.json({ error: 'Invalid disbursement date' }, { status: 400 })
    }

    const db = getDb()

    // Calculate maturity date (clamps month-end overflow, e.g. Jan 31 + 1mo -> Feb 28).
    const disburseDate = new Date(disbursement_date)
    const maturityDate = new Date(disburseDate)
    const targetDay = maturityDate.getDate()
    maturityDate.setMonth(maturityDate.getMonth() + term)
    if (maturityDate.getDate() < targetDay) {
      // Overflowed into the next month; back up to the last day of the intended month.
      maturityDate.setDate(0)
    }
    const maturity_date = maturityDate.toISOString().split('T')[0]

    const stmt = db.prepare(`
      INSERT INTO loans (
        borrower_id, principal_amount, loan_amount, balance, interest_rate, 
        interest_type, loan_term_months, disbursement_date, maturity_date,
        payment_frequency, penalty_per_day, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const now = new Date().toISOString()

    const result = stmt.run(
      parseInt(borrower_id),
      amount, // principal_amount
      amount, // loan_amount
      amount, // balance (initial)
      rate,
      interest_type || 'simple',
      term,
      disbursement_date,
      maturity_date,
      payment_frequency || 'monthly',
      penalty,
      'active',
      notes || null,
      now,
      now
    )

    const newLoan = db.prepare('SELECT * FROM loans WHERE id = ?').get(result.lastInsertRowid)

    return NextResponse.json(newLoan, { status: 201 })
  } catch (error) {
    console.error('Error creating loan:', error)
    return NextResponse.json(
      { error: 'Failed to create loan' },
      { status: 500 }
    )
  }
}

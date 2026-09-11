import { requireUser } from '@/lib/auth'
import { sql, num } from '@/lib/db'
import { DEFAULT_GRACE_DAYS } from '@/lib/loan-service'
import { money } from '@/lib/money'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const { errorResponse } = await requireUser()
  if (errorResponse) return errorResponse

  try {
    const loans = await sql`
      SELECT
        l.*,
        b.first_name as borrower_first_name,
        b.last_name as borrower_last_name,
        b.email as borrower_email
      FROM loans l
      LEFT JOIN borrowers b ON l.borrower_id = b.id
      ORDER BY l.created_at DESC
    `

    const data = loans.map((loan: any) => ({
      ...loan,
      principal_amount: num(loan.principal_amount),
      loan_amount: num(loan.loan_amount),
      balance: num(loan.balance),
      interest_rate: num(loan.interest_rate),
      interest_balance: num(loan.interest_balance),
      penalty_balance: num(loan.penalty_balance),
      penalty_per_day: num(loan.penalty_per_day),
      borrower: loan.borrower_first_name
        ? {
            first_name: loan.borrower_first_name,
            last_name: loan.borrower_last_name,
            email: loan.borrower_email,
          }
        : null,
    }))

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching loans:', error)
    return NextResponse.json({ error: 'Failed to fetch loans' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { errorResponse } = await requireUser()
  if (errorResponse) return errorResponse

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
      grace_period_days,
      notes,
    } = body

    if (!borrower_id || !loan_amount || !interest_rate || !loan_term_months || !disbursement_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const amount = money(Number(loan_amount))
    const rate = Number(interest_rate)
    const term = Number(loan_term_months)
    const penalty = Number(penalty_per_day || 0)
    const grace =
      grace_period_days === undefined || grace_period_days === null || grace_period_days === ''
        ? DEFAULT_GRACE_DAYS
        : Number(grace_period_days)

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
    if (!Number.isInteger(grace) || grace < 0) {
      return NextResponse.json({ error: 'Grace period must be zero or a positive whole number of days' }, { status: 400 })
    }
    if (isNaN(new Date(disbursement_date).getTime())) {
      return NextResponse.json({ error: 'Invalid disbursement date' }, { status: 400 })
    }
    const interestType = interest_type || 'compound'
    if (!['simple', 'compound'].includes(interestType)) {
      return NextResponse.json({ error: "Interest type must be 'simple' or 'compound'" }, { status: 400 })
    }

    const disburseDate = new Date(disbursement_date)
    const maturityDate = new Date(disburseDate)
    const targetDay = maturityDate.getDate()
    maturityDate.setMonth(maturityDate.getMonth() + term)
    if (maturityDate.getDate() < targetDay) maturityDate.setDate(0)
    const maturity_date = maturityDate.toISOString().split('T')[0]
    const now = new Date().toISOString()

    const [newLoan] = await sql`
      INSERT INTO loans (
        borrower_id, principal_amount, loan_amount, balance, interest_rate,
        interest_type, loan_term_months, disbursement_date, maturity_date,
        payment_frequency, penalty_per_day, grace_period_days, status, notes, created_at, updated_at
      ) VALUES (
        ${parseInt(borrower_id)}, ${amount}, ${amount}, ${amount}, ${rate},
        ${interestType}, ${term}, ${disbursement_date}, ${maturity_date},
        ${payment_frequency || 'monthly'}, ${penalty}, ${grace}, 'active', ${notes || null},
        ${now}, ${now}
      )
      RETURNING *
    `

    return NextResponse.json(newLoan, { status: 201 })
  } catch (error) {
    console.error('Error creating loan:', error)
    return NextResponse.json({ error: 'Failed to create loan' }, { status: 500 })
  }
}

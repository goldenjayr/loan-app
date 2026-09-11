import { requireUser } from '@/lib/auth'
import { accrueLoan } from '@/lib/loan-service'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Bring a loan's interest, penalties and status up to date. This is a deliberate
 * WRITE (POST) — reads (the summary GET) never mutate. Idempotent.
 */
export async function POST(
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

    const loan = await accrueLoan(loanId)
    return NextResponse.json(loan)
  } catch (error: any) {
    if (error.message === 'Loan not found') {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }
    console.error('Error accruing loan:', error)
    return NextResponse.json({ error: 'Failed to accrue loan' }, { status: 500 })
  }
}

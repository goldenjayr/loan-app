import { accrueLoan } from '@/lib/loan-service'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Bring a loan's interest, penalties and status up to date. This is a deliberate
 * WRITE (POST) — reads (the summary GET) never mutate. Idempotent, so it is safe
 * for a scheduler/cron to call periodically or for the UI to call on view.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const loanId = parseInt(id)
    if (isNaN(loanId)) {
      return NextResponse.json({ error: 'Invalid loan ID' }, { status: 400 })
    }

    const loan = accrueLoan(loanId)
    return NextResponse.json(loan)
  } catch (error: any) {
    if (error.message === 'Loan not found') {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }
    console.error('Error accruing loan:', error)
    return NextResponse.json({ error: 'Failed to accrue loan' }, { status: 500 })
  }
}

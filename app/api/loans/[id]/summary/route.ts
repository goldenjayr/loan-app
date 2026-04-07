import getDb from '@/lib/db'
import { getLoanSummary } from '@/lib/loan-service'
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

    const summary = await getLoanSummary(loanId)
    return NextResponse.json(summary)
  } catch (error: any) {
    console.error('Error fetching loan summary:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch loan summary' },
      { status: 500 }
    )
  }
}

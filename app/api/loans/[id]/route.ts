import getDb from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

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

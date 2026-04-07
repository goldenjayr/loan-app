import getDb from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const borrowerId = parseInt(id)
    if (isNaN(borrowerId)) {
      return NextResponse.json({ error: 'Invalid borrower ID' }, { status: 400 })
    }

    const db = getDb()
    
    // Check if borrower exists
    const borrower = db.prepare('SELECT id FROM borrowers WHERE id = ?').get(borrowerId)
    if (!borrower) {
      return NextResponse.json({ error: 'Borrower not found' }, { status: 404 })
    }

    // Check for active or past loans (DB RESTRICT will catch this, but pre-check for better message)
    const loansCount = db.prepare('SELECT count(*) as count FROM loans WHERE borrower_id = ?').get(borrowerId) as any
    if (loansCount.count > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete borrower with associated loans. Please delete all their loans first.' 
      }, { status: 400 })
    }

    // Delete borrower
    db.prepare('DELETE FROM borrowers WHERE id = ?').run(borrowerId)

    return NextResponse.json({ message: 'Borrower deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting borrower:', error)
    return NextResponse.json(
      { error: 'Failed to delete borrower' },
      { status: 500 }
    )
  }
}

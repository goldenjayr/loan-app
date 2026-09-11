import { requireUser } from '@/lib/auth'
import { sql } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireUser()
  if (errorResponse) return errorResponse

  try {
    const { id } = await params
    const borrowerId = parseInt(id)
    if (isNaN(borrowerId)) {
      return NextResponse.json({ error: 'Invalid borrower ID' }, { status: 400 })
    }

    const [borrower] = await sql`SELECT id FROM borrowers WHERE id = ${borrowerId}`
    if (!borrower) {
      return NextResponse.json({ error: 'Borrower not found' }, { status: 404 })
    }

    const [loansCount] = await sql`SELECT count(*)::int AS count FROM loans WHERE borrower_id = ${borrowerId}`
    if (loansCount.count > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete borrower with associated loans. Please delete all their loans first.',
        },
        { status: 400 }
      )
    }

    await sql`DELETE FROM borrowers WHERE id = ${borrowerId}`
    return NextResponse.json({ message: 'Borrower deleted successfully' })
  } catch (error) {
    console.error('Error deleting borrower:', error)
    return NextResponse.json({ error: 'Failed to delete borrower' }, { status: 500 })
  }
}

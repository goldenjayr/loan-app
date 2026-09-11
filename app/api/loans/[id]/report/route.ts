import { requireUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import {
  buildLoanReportData,
  LoanReportNotFoundError,
  slugifyBorrowerName,
} from '@/lib/loan-report/data'
import { renderLoanReportPdf } from '@/lib/loan-report/pdf'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireUser()
  if (errorResponse) return errorResponse

  const { id } = await params
  const loanId = Number(id)

  if (!Number.isInteger(loanId) || loanId <= 0) {
    return NextResponse.json({ error: 'Invalid loan ID' }, { status: 400 })
  }

  try {
    const report = await buildLoanReportData(loanId)
    const bytes = await renderLoanReportPdf(report)
    const borrowerSlug =
      slugifyBorrowerName(`${report.borrower.firstName} ${report.borrower.lastName}`) || 'borrower'

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="loan-${loanId}-${borrowerSlug}-report.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof LoanReportNotFoundError) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }

    console.error('Error exporting loan report:', error)
    return NextResponse.json({ error: 'Failed to export PDF' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { resolveShareToken } from '@/lib/share-links'
import {
  buildLoanReportData,
  LoanReportNotFoundError,
  slugifyBorrowerName,
} from '@/lib/loan-report/data'
import { renderLoanReportPdf } from '@/lib/loan-report/pdf'
import { accrueLoan } from '@/lib/loan-service'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const link = await resolveShareToken(token)
  if (!link) {
    return NextResponse.json({ error: 'Share link not found or revoked' }, { status: 404 })
  }

  try {
    await accrueLoan(link.loan_id)
    const report = await buildLoanReportData(link.loan_id)
    const bytes = await renderLoanReportPdf(report)
    const borrowerSlug =
      slugifyBorrowerName(`${report.borrower.firstName} ${report.borrower.lastName}`) || 'borrower'

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="loan-statement-${borrowerSlug}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof LoanReportNotFoundError) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }
    console.error('Error exporting shared loan report:', error)
    return NextResponse.json({ error: 'Failed to export PDF' }, { status: 500 })
  }
}

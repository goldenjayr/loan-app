import { notFound } from 'next/navigation'
import { loadLoanDetail } from '@/lib/data'
import { PageTransition } from '@/lib/view-transition'
import LoanDetailClient from './loan-detail-client'

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const loanId = Number(id)
  if (!Number.isInteger(loanId) || loanId <= 0) notFound()

  const { loan, payments, summary } = await loadLoanDetail(loanId)
  if (!loan) notFound()

  return (
    <PageTransition>
      <LoanDetailClient
        loanId={String(loanId)}
        loan={loan}
        payments={payments}
        summary={summary}
      />
    </PageTransition>
  )
}

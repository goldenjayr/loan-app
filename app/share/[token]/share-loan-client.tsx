'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type Props = {
  token: string
  loan: any
  summary: any
}

function peso(n: number) {
  return `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ShareLoanClient({ token, loan, summary }: Props) {
  const [exporting, setExporting] = useState(false)
  const statement = summary?.statement

  async function downloadPdf() {
    setExporting(true)
    try {
      const res = await fetch(`/share/${token}/report`)
      if (!res.ok) throw new Error('Failed to download PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `loan-statement.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF downloaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to download PDF')
    } finally {
      setExporting(false)
    }
  }

  const statusClass =
    loan.status === 'active'
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      : loan.status === 'completed'
        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card/90 backdrop-blur-md sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Loan statement</p>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
              {loan.borrower?.first_name} {loan.borrower?.last_name}
            </h1>
          </div>
          <Button className="min-h-11 gap-2 w-full sm:w-auto" onClick={downloadPdf} disabled={exporting}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" aria-hidden="true" />}
            {exporting ? 'Preparing…' : 'Download PDF'}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8 max-w-3xl space-y-6">
        <Card className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusClass}>{loan.status?.charAt(0).toUpperCase() + loan.status?.slice(1)}</Badge>
            {statement?.isOverdue ? (
              <Badge variant="destructive">Overdue</Badge>
            ) : (
              <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">
                Current
              </Badge>
            )}
          </div>

          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            {loan.borrower?.email && (
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium break-all">{loan.borrower.email}</p>
              </div>
            )}
            {loan.borrower?.phone && (
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium">{loan.borrower.phone}</p>
              </div>
            )}
            {statement?.nextDueDate && (
              <div>
                <p className="text-muted-foreground">Next due</p>
                <p className="font-medium">{format(new Date(statement.nextDueDate), 'MMM dd, yyyy')}</p>
              </div>
            )}
          </div>
        </Card>

        <div className="grid sm:grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Outstanding balance</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{peso(statement?.outstandingBalance ?? loan.balance)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Due to stay current</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{peso(statement?.amountDueToStayCurrent ?? 0)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Pay off today</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{peso(statement?.payoffToday ?? 0)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Recommended installment</p>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {peso(statement?.suggestedMonthlyPayment ?? 0)}
              <span className="text-xs font-semibold text-muted-foreground">/mo</span>
            </p>
          </Card>
        </div>

        <Card className="p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold">Loan terms</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Loan amount</p>
              <p className="font-bold tabular-nums text-lg">{peso(loan.loan_amount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Monthly rate</p>
              <p className="font-bold tabular-nums text-lg">{(loan.interest_rate / 12).toFixed(2)}%</p>
              <p className="text-xs text-muted-foreground">{Number(loan.interest_rate).toFixed(2)}% annual</p>
            </div>
            <div>
              <p className="text-muted-foreground">Interest type</p>
              <p className="font-semibold capitalize">{loan.interest_type}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Term</p>
              <p className="font-semibold tabular-nums">{loan.loan_term_months} months</p>
            </div>
            <div>
              <p className="text-muted-foreground">Disbursement</p>
              <p className="font-semibold">
                {loan.disbursement_date
                  ? format(new Date(loan.disbursement_date), 'MMM dd, yyyy')
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Accrued interest</p>
              <p className="font-semibold tabular-nums">{peso(statement?.accruedInterest ?? 0)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold">Interest statement</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {statement?.labels?.interestModel || 'Interest charged monthly on the remaining balance.'}
          </p>
          {(!statement?.timeline || statement.timeline.length === 0) ? (
            <p className="text-sm text-muted-foreground italic">No interest charges or payments yet.</p>
          ) : (
            <ol className="space-y-4">
              {statement.timeline.map((item: any, idx: number) => {
                if (item.kind === 'payment') {
                  return (
                    <li key={idx} className="rounded-lg border border-border p-3 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{format(new Date(item.date), 'MMM dd, yyyy')}</p>
                        <Badge className="bg-indigo-600 text-white">Payment</Badge>
                      </div>
                      <p className="text-sm tabular-nums">
                        Paid {peso(item.amount)} → interest {peso(item.toInterest)}
                        {item.toPenalty > 0 ? `, penalty ${peso(item.toPenalty)}` : ''}, principal{' '}
                        {peso(item.toPrincipal)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Balance after {peso(item.balanceAfter)}
                      </p>
                    </li>
                  )
                }
                const isOverdue = item.status === 'overdue'
                const isPaid = item.status === 'paid'
                return (
                  <li key={idx} className="rounded-lg border border-border p-3 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{format(new Date(item.date), 'MMM dd, yyyy')}</p>
                      <Badge
                        className={cn(
                          'text-white',
                          isOverdue ? 'bg-red-600' : isPaid ? 'bg-emerald-600' : 'bg-blue-600'
                        )}
                      >
                        {isOverdue ? 'Overdue' : isPaid ? 'Paid' : 'Due'}
                      </Badge>
                    </div>
                    <p className="text-sm tabular-nums">
                      Interest charged {peso(item.interestCharged)} · still due {peso(item.interestRemaining)}
                    </p>
                  </li>
                )
              })}
            </ol>
          )}
        </Card>

        {summary?.paymentBreakdown?.items?.length > 0 && (
          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="text-lg font-semibold">Where your payments went</h2>
            <p className="text-sm text-muted-foreground">
              Order: penalties → interest → principal. Only principal lowers the balance.
            </p>
            <div className="space-y-3">
              {summary.paymentBreakdown.items.map((p: any) => (
                <div key={p.id} className="rounded-lg border border-border p-3 text-sm space-y-2">
                  <p className="font-semibold">{format(new Date(p.date), 'MMM dd, yyyy')}</p>
                  <div className="grid grid-cols-2 gap-2 tabular-nums">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground font-bold">Paid</p>
                      <p className="font-bold">{peso(p.amount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-orange-500/80 font-bold">Interest</p>
                      <p className="font-semibold text-orange-500">{peso(p.toInterest)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-blue-600/80 font-bold">Principal</p>
                      <p className="font-semibold text-blue-600">{peso(p.toPrincipal)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground font-bold">Balance after</p>
                      <p className="font-bold">{peso(p.balanceAfter)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Total paid {peso(summary.paymentBreakdown.totalPaid)}: interest{' '}
              {peso(summary.paymentBreakdown.totalToInterest)}, principal{' '}
              {peso(summary.paymentBreakdown.totalToPrincipal)}.
            </p>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground pb-8">
          This is a read-only shared statement. Contact your lender if you have questions.
        </p>
      </main>
    </div>
  )
}

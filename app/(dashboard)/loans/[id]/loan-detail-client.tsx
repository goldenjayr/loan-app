'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import LoanSummary from '@/components/loan-summary'
import PaymentsList from '@/components/payments-list'
import { ArrowLeft, Calendar, DollarSign, Clock, Trash2, Pencil, Download, Loader2 } from 'lucide-react'
import { TransitionLink } from '@/components/transition-link'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { downloadLoanReport } from '@/lib/download-report'
import Link from 'next/link'
import { LoanShareControls } from '@/components/loan-share-controls'

type Props = {
  loanId: string
  loan: any
  payments: any[]
  summary: any
}

export default function LoanDetailClient({ loanId, loan, payments, summary }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/loans/${loanId}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Loan deleted successfully')
        router.push('/loans')
        router.refresh()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete loan')
      }
    } catch (error) {
      console.error('Error deleting loan:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setDeleting(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await downloadLoanReport(loanId)
      toast.success('PDF report downloaded')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export PDF')
    } finally {
      setExporting(false)
    }
  }

  const peso = (n: number) =>
    `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const statement = summary?.statement
  const lastPayment = payments.length > 0 ? payments[0] : null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'defaulted':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  if (!loan) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Loan not found</p>
          <Link href="/loans">
            <Button className="mt-4 min-h-11">Back to Loans</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
      <div className="container mx-auto px-4 py-8 stagger-in">
        <TransitionLink href="/loans" transition="back" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6 min-h-11">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to Loans
        </TransitionLink>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6 sm:mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-pretty truncate">
              {loan.borrower?.first_name} {loan.borrower?.last_name}
            </h1>
            <p className="text-muted-foreground mt-1 truncate">{loan.borrower?.email}</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
              aria-busy={exporting}
              className="shadow-none min-h-11 flex-1 sm:flex-none"
            >
              {exporting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-4" aria-hidden="true" />
              )}
              {exporting ? 'Exporting…' : 'Export PDF'}
            </Button>
            <Link href={`/loans/${loanId}/edit`}>
              <Button variant="outline" size="icon" className="shadow-none min-h-11 min-w-11" aria-label="Edit loan">
                <Pencil className="w-4 h-4" aria-hidden="true" />
              </Button>
            </Link>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Delete loan" className="min-h-11 min-w-11 text-destructive border-destructive hover:bg-destructive shadow-none bg-transparent hover:text-white group">
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the loan
                    for {loan.borrower?.first_name} {loan.borrower?.last_name} and remove all associated payment records.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting...' : 'Delete Loan'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Badge className={getStatusColor(loan.status)}>
              {loan.status?.charAt(0).toUpperCase() + loan.status?.slice(1)}
            </Badge>
          </div>
        </div>

        {/* Quick Stats Overlay */}
        {/* Quick Stats Overlay */}
        <div className="grid md:grid-cols-3 gap-6 mb-8 items-start">
          {/* Combined Date and Payment Status Card */}
          <div className="flex flex-col gap-6">
            <Card className="p-6 border-l-4 border-l-primary shadow-sm bg-slate-50/10">
              <div className="flex flex-col gap-6">
                {/* Next Due Date Section */}
                <div className="flex items-center gap-4 group">
                  <div className="p-3 bg-primary/10 rounded-full text-primary ring-4 ring-primary/5 group-hover:scale-110 transition-transform duration-300">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Next Due Date</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className={cn(
                        "text-xl font-black tracking-tight",
                        statement?.isOverdue ? "text-red-600" : "text-foreground"
                      )}>
                        {statement?.nextDueDate ? format(new Date(statement.nextDueDate), 'MMM dd, yyyy') : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-100 dark:bg-slate-800" />

                {/* Last Payment Section */}
                <div className="flex items-center gap-4 group">
                  <div className="p-3 bg-green-100 rounded-full text-green-600 ring-4 ring-green-50 group-hover:scale-110 transition-transform duration-300">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Last Payment</p>
                    <p className="text-xl font-black text-foreground mt-1 tracking-tight">
                      {lastPayment ? peso(lastPayment.amount) : 'None'}
                    </p>
                    {lastPayment && (
                      <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70 mt-0.5">
                        {format(new Date(lastPayment.payment_date), 'MMMM dd, yyyy')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Amount Due to Stay Current — driven entirely by the engine statement */}
          <Card className={cn(
            "p-6 border-l-4 md:col-span-2 shadow-sm transition-all duration-500",
            statement?.isOverdue ? "border-l-red-600 bg-red-50/20" : "border-l-orange-500 bg-orange-50/10"
          )}>
            <div className="flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-orange-100 rounded-full text-orange-600 ring-4 ring-orange-50">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Amount Due to Stay Current</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-foreground tracking-tight">
                      {peso(statement?.amountDueToStayCurrent ?? 0)}
                    </p>
                    {statement?.isOverdue ? (
                      <Badge variant="destructive" className="animate-pulse h-5 font-black uppercase text-[10px] tracking-widest px-2">Overdue</Badge>
                    ) : (
                      <Badge variant="outline" className="h-5 font-black uppercase text-[10px] tracking-widest px-2 border-green-500 text-green-700">Current</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
                    This is the <span className="font-semibold text-foreground">unpaid interest</span> {peso(statement?.accruedInterest ?? 0)}
                    {(statement?.penalties ?? 0) > 0 && <> plus penalties {peso(statement?.penalties ?? 0)}</>} owed right now.
                    Paying it keeps the loan in good standing, but <span className="font-semibold">does not reduce the {peso(statement?.outstandingBalance ?? 0)} you still owe</span>.
                  </p>
                </div>
              </div>

              {/* Plain-language payment guide */}
              <div className="grid sm:grid-cols-3 gap-3 mb-2">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white/40 dark:bg-slate-900/30">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Minimum (interest only)</p>
                  <p className="text-lg font-black text-foreground mt-1">{peso(statement?.monthlyInterest ?? 0)}<span className="text-[10px] font-bold text-muted-foreground">/mo</span></p>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-snug">Covers this month&rsquo;s interest only. Your balance stays the same.</p>
                </div>
                <div className="rounded-xl border-2 border-primary/40 p-3 bg-primary/5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-primary">Recommended installment</p>
                  <p className="text-lg font-black text-foreground mt-1">{peso(statement?.suggestedMonthlyPayment ?? 0)}<span className="text-[10px] font-bold text-muted-foreground">/mo</span></p>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{statement?.labels?.installment}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white/40 dark:bg-slate-900/30">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pay off in full today</p>
                  <p className="text-lg font-black text-foreground mt-1">{peso(statement?.payoffToday ?? 0)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-snug">Clears principal + interest. The loan closes.</p>
                </div>
              </div>

              {/* Per-period interest statement (from the engine's own accrual rows) */}
              <div className="flex flex-col gap-3 mt-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                 <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                      <p className="text-[12px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-[0.15em]">Interest Statement</p>
                      <span className="hidden sm:block h-4 w-px bg-slate-300 dark:bg-slate-700 shrink-0" />
                      <span className="text-[11px] font-bold text-slate-500 italic opacity-70 truncate">{statement?.labels?.interestModel}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-black h-5 border-slate-300 text-slate-500 bg-white/50 backdrop-blur-sm px-2 shrink-0">
                      {statement?.periods?.length ?? 0} Periods
                    </Badge>
                 </div>

                 <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                   {statement?.interestType === 'compound' ? (
                     <>
                       Each month, interest is charged at <span className="font-semibold text-foreground">{statement?.monthlyRatePct ?? 0}% of your unpaid balance</span> — principal plus any interest still owed (compounding).
                       Unpaid interest is added to that base, so it grows until you pay it down.
                     </>
                   ) : (
                     <>
                       Each month, interest is charged at <span className="font-semibold text-foreground">{statement?.monthlyRatePct ?? 0}% of your remaining balance</span> (reducing balance).
                       As you pay down the principal, the monthly interest gets smaller.
                     </>
                   )}
                   <span className="text-emerald-700 dark:text-emerald-400 font-semibold"> Paid</span> = interest settled,
                   <span className="text-red-600 font-semibold"> Overdue</span> = a past month still unpaid,
                   <span className="text-blue-600 font-semibold"> Due</span> = upcoming.
                   <span className="text-indigo-600 font-semibold"> Indigo dots</span> are the customer&rsquo;s payments.
                 </p>

                 {(!statement?.timeline || statement.timeline.length === 0) ? (
                   <p className="text-sm text-muted-foreground italic py-2">No interest charged or payments yet.</p>
                 ) : (
                 <div className="relative space-y-5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
                   {statement.timeline.map((item: any, idx: number) => {
                     // Payment event in the timeline
                     if (item.kind === 'payment') {
                       return (
                         <div key={idx} className="relative pl-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 group transition-transform duration-300 hover:translate-x-0.5">
                           <div className="absolute left-0 top-[2px] w-[22px] h-[22px] rounded-full border-4 border-white dark:border-slate-950 flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-125 z-10 bg-indigo-500">
                             <div className="w-1.5 h-1.5 rounded-full bg-white" />
                           </div>
                           <div className="flex flex-col">
                             <span className="text-[14px] font-black text-foreground tracking-tight leading-none">
                               {format(new Date(item.date), 'MMMM dd, yyyy')}
                             </span>
                             <div className="flex items-center gap-2 mt-2 flex-wrap">
                               <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm tracking-widest text-white bg-indigo-600">Payment</span>
                               {item.toPenalty > 0 && (
                                 <span className="text-[9px] text-red-600 font-bold tracking-tight uppercase">→ Penalty {peso(item.toPenalty)}</span>
                               )}
                               <span className="text-[9px] text-orange-500 font-bold tracking-tight uppercase">→ Interest {peso(item.toInterest)}</span>
                               <span className="text-[9px] text-blue-600 font-bold tracking-tight uppercase">→ Principal {peso(item.toPrincipal)}</span>
                             </div>
                             {item.fullyConsumedByInterest && (
                               <p className="text-[10px] text-red-600/90 mt-1.5 leading-snug">
                                 <span className="font-black uppercase tracking-wider mr-1">Why?</span>
                                 Interest had piled up to {peso(item.interestDueBefore)}, so this payment went entirely to interest — ₱0.00 reduced the balance.
                               </p>
                             )}
                           </div>
                           <div className="text-right">
                             <div className="flex items-center gap-6 justify-end">
                               <div className="flex flex-col items-end">
                                 <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">Paid</p>
                                 <span className="text-[13px] font-black text-emerald-600">{peso(item.amount)}</span>
                               </div>
                               <div className="h-10 w-px bg-slate-200 dark:bg-slate-800" />
                               <div className="flex flex-col items-end">
                                 <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">Balance After</p>
                                 <div className="text-[16px] font-black text-foreground tracking-tighter">{peso(item.balanceAfter)}</div>
                               </div>
                             </div>
                           </div>
                         </div>
                       )
                     }
                     // Interest charge event
                     const isOverdue = item.status === 'overdue'
                     const isPaid = item.status === 'paid'
                     return (
                     <div key={idx} className="relative pl-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 group transition-transform duration-300 hover:translate-x-0.5">
                       <div className={cn(
                         "absolute left-0 top-[2px] w-[22px] h-[22px] rounded-full border-4 border-white dark:border-slate-950 flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-125 z-10",
                         isOverdue ? "bg-red-500" : isPaid ? "bg-emerald-500" : "bg-blue-500"
                       )}>
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                       </div>

                       <div className="flex flex-col">
                         <span className="text-[14px] font-black text-foreground tracking-tight leading-none">
                           {format(new Date(item.date), 'MMMM dd, yyyy')}
                         </span>
                         <div className="flex items-center gap-2 mt-2">
                           <span className={cn(
                             "text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm tracking-widest text-white",
                             isOverdue ? "bg-red-600" : isPaid ? "bg-emerald-600" : "bg-blue-600"
                           )}>
                             {isOverdue ? 'Overdue' : isPaid ? 'Paid' : 'Due'}
                           </span>
                           <div className="h-1 w-1 rounded-full bg-slate-300" />
                           <span className="text-[9px] text-muted-foreground font-bold tracking-tight opacity-80 uppercase">
                             Opening: {peso(item.openingBalance)}
                           </span>
                           {item.interestPaid > 0 && (
                             <>
                               <div className="h-1 w-1 rounded-full bg-slate-300" />
                               <span className="text-[9px] text-emerald-700 font-bold tracking-tight opacity-80 uppercase">
                                 Paid: {peso(item.interestPaid)}
                               </span>
                             </>
                           )}
                         </div>
                         {/* When this interest appears, and how long overdue */}
                         <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
                           Appears on <span className="font-semibold text-foreground">{format(new Date(item.chargedOn ?? item.date), 'MMM dd, yyyy')}</span>
                           {item.periodStart && (
                             <> — interest for {format(new Date(item.periodStart), 'MMM dd')}–{format(new Date(item.date), 'MMM dd')}</>
                           )}
                           {isOverdue && (
                             <span className="text-red-600 font-semibold"> · overdue since {format(new Date(item.date), 'MMM dd')} ({item.daysOverdue} day{item.daysOverdue === 1 ? '' : 's'})</span>
                           )}
                           {isPaid && <span className="text-emerald-700 font-semibold"> · settled</span>}
                         </p>
                       </div>

                       <div className="text-right">
                         <div className="flex items-center gap-6 justify-end">
                           <div className="flex flex-col items-end">
                             <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">Interest Charged</p>
                             <span className="text-[13px] font-black text-orange-500">{peso(item.interestCharged)}</span>
                           </div>
                           <div className="h-10 w-px bg-slate-200 dark:bg-slate-800" />
                           <div className="flex flex-col items-end">
                             <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">Still Due</p>
                             <div className="text-[16px] font-black text-foreground tracking-tighter">
                               {peso(item.interestRemaining)}
                             </div>
                           </div>
                         </div>
                       </div>
                     </div>
                     )
                   })}
                 </div>
                 )}
              </div>

              {/* Where each payment went (waterfall split) */}
              {summary?.paymentBreakdown?.items?.length > 0 && (
                <div className="flex flex-col gap-3 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[12px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-[0.15em]">Where Your Payments Went</p>
                    <Badge variant="outline" className="text-[10px] font-black h-5 border-slate-300 text-slate-500 bg-white/50 backdrop-blur-sm px-2">
                      {summary.paymentBreakdown.items.length} Payments
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
                    Every payment is split in this order: <span className="font-semibold text-red-600">penalties</span> →
                    <span className="font-semibold text-orange-500"> interest</span> →
                    <span className="font-semibold text-blue-600"> principal</span>. Only the principal part actually lowers what you owe.
                  </p>

                  {/* Header row */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 px-3 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    <span className="col-span-3">Date</span>
                    <span className="col-span-2 text-right">Paid</span>
                    {summary.paymentBreakdown.totalToPenalty > 0 && <span className="col-span-2 text-right">→ Penalty</span>}
                    <span className={cn("text-right", summary.paymentBreakdown.totalToPenalty > 0 ? "col-span-1" : "col-span-2")}>→ Interest</span>
                    <span className="col-span-2 text-right">→ Principal</span>
                    <span className="col-span-2 text-right">Balance After</span>
                  </div>

                  <div className="space-y-2">
                    {summary.paymentBreakdown.items.map((p: any) => {
                      const hasPenaltyCol = summary.paymentBreakdown.totalToPenalty > 0
                      let note: React.ReactNode = null
                      if (p.fullyConsumedByInterest) {
                        note = (
                          <>Interest had piled up to <span className="font-bold text-orange-500">{peso(p.interestDueBefore)}</span> (no payment for a while), so this entire payment went to interest — <span className="font-bold">₱0.00 reduced the balance</span>.</>
                        )
                      } else if (p.toInterest <= 0.005 && p.toPenalty <= 0.005) {
                        note = <>No interest was due yet, so the whole payment reduced the principal.</>
                      } else if (p.toInterest > 0.005 && p.toPrincipal > 0.005) {
                        note = (
                          <>Cleared <span className="font-bold text-orange-500">{peso(p.toInterest)}</span> of interest first, then <span className="font-bold text-blue-600">{peso(p.toPrincipal)}</span> reduced the principal.</>
                        )
                      }
                      return (
                        <div key={p.id} className="px-3 py-2 rounded-lg bg-white/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800">
                          <div className="hidden sm:grid grid-cols-12 gap-2 items-center text-[12px]">
                            <span className="col-span-3 font-bold text-foreground">
                              {format(new Date(p.date), 'MMM dd, yyyy')}
                            </span>
                            <span className="col-span-2 text-right font-black text-foreground tabular-nums">{peso(p.amount)}</span>
                            {hasPenaltyCol && (
                              <span className="col-span-2 text-right font-semibold text-red-600 tabular-nums">{peso(p.toPenalty)}</span>
                            )}
                            <span className={cn('text-right font-semibold text-orange-500 tabular-nums', hasPenaltyCol ? 'col-span-1' : 'col-span-2')}>{peso(p.toInterest)}</span>
                            <span className="col-span-2 text-right font-semibold text-blue-600 tabular-nums">{peso(p.toPrincipal)}</span>
                            <span className="col-span-2 text-right font-bold text-foreground tabular-nums">{peso(p.balanceAfter)}</span>
                          </div>
                          <div className="sm:hidden space-y-2 text-[12px]">
                            <p className="font-bold text-foreground">{format(new Date(p.date), 'MMM dd, yyyy')}</p>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Paid</p>
                                <p className="font-black tabular-nums">{peso(p.amount)}</p>
                              </div>
                              {hasPenaltyCol && (
                                <div>
                                  <p className="text-[9px] font-black uppercase tracking-wider text-red-500/80">→ Penalty</p>
                                  <p className="font-semibold text-red-600 tabular-nums">{peso(p.toPenalty)}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-wider text-orange-500/80">→ Interest</p>
                                <p className="font-semibold text-orange-500 tabular-nums">{peso(p.toInterest)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-wider text-blue-600/80">→ Principal</p>
                                <p className="font-semibold text-blue-600 tabular-nums">{peso(p.toPrincipal)}</p>
                              </div>
                              <div className="col-span-2">
                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Balance After</p>
                                <p className="font-bold tabular-nums">{peso(p.balanceAfter)}</p>
                              </div>
                            </div>
                          </div>
                          {note && (
                            <p className={cn(
                              "text-[10.5px] mt-1.5 leading-snug",
                              p.fullyConsumedByInterest ? "text-red-600/90" : "text-muted-foreground"
                            )}>
                              {p.fullyConsumedByInterest && <span className="font-black uppercase tracking-wider mr-1">Why?</span>}
                              {note}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Totals */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 items-center px-3 pt-2 mt-1 border-t border-dashed border-slate-300 dark:border-slate-700 text-[12px]">
                    <span className="col-span-3 text-[10px] font-black uppercase tracking-wider text-slate-500">Totals</span>
                    <span className="col-span-2 text-right font-black text-foreground tabular-nums">{peso(summary.paymentBreakdown.totalPaid)}</span>
                    {summary.paymentBreakdown.totalToPenalty > 0 && (
                      <span className="col-span-2 text-right font-black text-red-600 tabular-nums">{peso(summary.paymentBreakdown.totalToPenalty)}</span>
                    )}
                    <span className={cn('text-right font-black text-orange-500 tabular-nums', summary.paymentBreakdown.totalToPenalty > 0 ? 'col-span-1' : 'col-span-2')}>{peso(summary.paymentBreakdown.totalToInterest)}</span>
                    <span className="col-span-2 text-right font-black text-blue-600 tabular-nums">{peso(summary.paymentBreakdown.totalToPrincipal)}</span>
                    <span className="col-span-2 text-right" />
                  </div>
                  <div className="sm:hidden grid grid-cols-2 gap-2 px-3 pt-2 mt-1 border-t border-dashed border-slate-300 dark:border-slate-700 text-[12px]">
                    <p className="col-span-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Totals</p>
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-400">Paid</p>
                      <p className="font-black tabular-nums">{peso(summary.paymentBreakdown.totalPaid)}</p>
                    </div>
                    {summary.paymentBreakdown.totalToPenalty > 0 && (
                      <div>
                        <p className="text-[9px] font-black uppercase text-red-500/80">Penalty</p>
                        <p className="font-black text-red-600 tabular-nums">{peso(summary.paymentBreakdown.totalToPenalty)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[9px] font-black uppercase text-orange-500/80">Interest</p>
                      <p className="font-black text-orange-500 tabular-nums">{peso(summary.paymentBreakdown.totalToInterest)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-blue-600/80">Principal</p>
                      <p className="font-black text-blue-600 tabular-nums">{peso(summary.paymentBreakdown.totalToPrincipal)}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    So far {peso(summary.paymentBreakdown.totalPaid)} paid: <span className="font-semibold text-orange-500">{peso(summary.paymentBreakdown.totalToInterest)}</span> went to interest
                    and <span className="font-semibold text-blue-600">{peso(summary.paymentBreakdown.totalToPrincipal)}</span> reduced the principal.
                  </p>
                </div>
              )}

              {/* Beginner glossary */}
              <details className="mt-5 group">
                <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-foreground select-none">
                  New to this? Tap to understand the terms
                </summary>
                <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[11px] text-muted-foreground leading-relaxed">
                  <p><span className="font-bold text-foreground">Principal</span> — the amount originally borrowed ({peso(loan.loan_amount)}).</p>
                  <p><span className="font-bold text-foreground">Outstanding balance</span> — how much principal is still unpaid ({peso(statement?.outstandingBalance ?? loan.balance)}).</p>
                  <p><span className="font-bold text-foreground">Interest</span> — the fee for borrowing, charged each month on the balance.</p>
                  <p><span className="font-bold text-foreground">Accrued interest</span> — interest already charged but not yet paid ({peso(statement?.accruedInterest ?? 0)}).</p>
                  {statement?.interestType === 'compound' ? (
                    <p><span className="font-bold text-foreground">Compounding</span> — interest is calculated on principal <em>plus</em> any interest still unpaid, so leaving interest unpaid makes it grow.</p>
                  ) : (
                    <p><span className="font-bold text-foreground">Reducing balance</span> — interest is calculated on what you still owe, so it falls as you pay down principal.</p>
                  )}
                  <p><span className="font-bold text-foreground">Payment order</span> — each payment covers penalties first, then interest, then principal.</p>
                  <p><span className="font-bold text-foreground">Due to stay current</span> — the minimum (interest + penalties) to avoid falling behind.</p>
                  <p><span className="font-bold text-foreground">Pay off today</span> — everything owed right now: balance + interest + penalties ({peso(statement?.payoffToday ?? 0)}).</p>
                </div>
              </details>
            </div>
          </Card>
        </div>

        <div className="mb-6">
          <LoanShareControls loanId={loanId} />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-4 sm:p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Loan Details</h2>
              <div className="grid grid-cols-2 gap-4 sm:gap-6">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Loan Amount</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground mt-2 tabular-nums truncate">
                    ₱{loan.loan_amount?.toLocaleString()}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                  <p className="text-lg sm:text-2xl font-bold text-foreground mt-2 tabular-nums truncate">
                    ₱{loan.balance?.toLocaleString()}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Monthly Interest Rate</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground mt-2 tabular-nums">
                    {(loan.interest_rate / 12).toFixed(2)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                    {Number(loan.interest_rate).toFixed(2)}% annual
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Interest Type</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground mt-2 capitalize">{loan.interest_type}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Loan Term</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground mt-2 tabular-nums">{loan.loan_term_months} months</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Payment Frequency</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground mt-2 capitalize">{loan.payment_frequency}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Disbursement Date</p>
                  <p className="text-sm font-semibold text-foreground mt-2">
                    {new Date(loan.disbursement_date).toLocaleDateString('en-PH')}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Penalty per Day</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground mt-2 tabular-nums">{loan.penalty_per_day}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    of overdue interest, after {statement?.graceDays ?? 7} day(s) grace
                  </p>
                </div>
              </div>
            </Card>

            <PaymentsList loanId={loanId} payments={payments} />
          </div>

          <div>
            <LoanSummary loanId={loanId} loan={loan} summary={summary} />
          </div>
        </div>
      </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { redirect } from 'next/navigation'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardHeader from '@/components/dashboard-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import LoanSummary from '@/components/loan-summary'
import PaymentsList from '@/components/payments-list'
import { ArrowLeft, Calendar, DollarSign, Clock, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { calculateMonthlyPayment } from '@/lib/calculations'
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

export default function LoanDetailPage() {
  const router = useRouter()
  const params = useParams()
  const loanId = params.id as string
  const [user, setUser] = useState<any>(null)
  const [loan, setLoan] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        redirect('/auth/login')
      }

      setUser(user)

      // Fetch loan details
      const loansResponse = await fetch('/api/loans')
      if (loansResponse.ok) {
        const loansData = await loansResponse.json()
        const selectedLoan = loansData.find((l: any) => l.id === Number(loanId))
        setLoan(selectedLoan)
      }

      // Fetch payments for this loan
      const paymentsResponse = await fetch(`/api/payments?loan_id=${loanId}`)
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json()
        setPayments(paymentsData)
      }

      setLoading(false)
    }

    checkAuth()
  }, [loanId])

  const calculateNextDue = () => {
    if (!loan) return { date: null, amount: 0, originalAmount: 0, principal: 0, interest: 0, openingBalance: 0, isOverdue: false, breakdown: [] }

    const monthlyInstalment = calculateMonthlyPayment(
      loan.principal_amount,
      loan.interest_rate,
      loan.loan_term_months
    )

    const totalPaid = payments.reduce((sum, p: any) => sum + p.amount, 0)
    const disburseDate = new Date(loan.disbursement_date)
    const frequency = loan.payment_frequency || 'monthly'
    
    const today = new Date()
    let nextDate = new Date(disburseDate)
    let currentActualBalance = loan.principal_amount
    let remainingPaid = totalPaid
    let cumulativeScheduled = 0
    let earliestUnpaidDate: Date | null = null
    const monthlyRate = loan.interest_rate / 100 / 12
    const breakdown: any[] = []

    for (let i = 1; i <= loan.loan_term_months; i++) {
        let milestoneDate = new Date(disburseDate)
        if (frequency === 'monthly') milestoneDate.setMonth(milestoneDate.getMonth() + i)
        else if (frequency === 'weekly') milestoneDate.setDate(milestoneDate.getDate() + (i * 7))
        else if (frequency === 'biweekly') milestoneDate.setDate(milestoneDate.getDate() + (i * 14))
        else if (frequency === 'quarterly') milestoneDate.setMonth(milestoneDate.getMonth() + (i * 3))

        const milestoneInterest = (currentActualBalance * monthlyRate)
        const milestonePrincipal = Math.max(0, monthlyInstalment - milestoneInterest)
        
        cumulativeScheduled += monthlyInstalment
        
        const paymentApplied = Math.min(remainingPaid, monthlyInstalment)
        const paidTowardInterest = Math.min(paymentApplied, milestoneInterest)
        const paidTowardPrincipal = Math.min(
          milestonePrincipal,
          Math.max(0, paymentApplied - paidTowardInterest)
        )
        const remainingInterest = Math.max(0, milestoneInterest - paidTowardInterest)
        const remainingPrincipal = Math.max(0, milestonePrincipal - paidTowardPrincipal)
        const unpaidInMilestone = remainingInterest + remainingPrincipal
        
        breakdown.push({
            date: milestoneDate,
            interest: remainingInterest,
            principal: remainingPrincipal,
            scheduledInterest: milestoneInterest,
            scheduledPrincipal: milestonePrincipal,
            scheduledAmount: monthlyInstalment,
            paidAmount: paymentApplied,
            remainingDue: unpaidInMilestone,
            openingBalance: currentActualBalance,
            isOverdue: milestoneDate < today && unpaidInMilestone > 0.01
        })

        currentActualBalance -= paidTowardPrincipal
        remainingPaid = Math.max(0, remainingPaid - monthlyInstalment)

        // Track the earliest unpaid milestone for the date display
        if (!earliestUnpaidDate && unpaidInMilestone > 0.01) {
            earliestUnpaidDate = milestoneDate
        }

        // We stop once we've included the FIRST milestone that is in the future
        if (milestoneDate > today) {
            nextDate = milestoneDate
            break
        }
        
        if (i === loan.loan_term_months) {
            nextDate = milestoneDate
        }
    }

    const remainingAmount = Math.max(0, cumulativeScheduled - totalPaid)
    
    // Summary info for the current/latest period in the breakdown
    const latest = breakdown[breakdown.length - 1] || { 
        principal: 0, interest: 0, openingBalance: loan.principal_amount 
    }

    return {
      date: earliestUnpaidDate || nextDate,
      amount: remainingAmount,
      originalAmount: monthlyInstalment,
      principal: latest.principal,
      interest: latest.interest,
      openingBalance: latest.openingBalance,
      isOverdue: earliestUnpaidDate ? earliestUnpaidDate < today : false,
      breakdown: breakdown.filter(b => (b.date <= today || b.date === nextDate) && b.remainingDue > 0.01)
    }
  }


  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/loans/${loanId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Loan deleted successfully')
        router.push('/loans')
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

  const nextDue = calculateNextDue()
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    )
  }

  if (!loan) {
    return (
      <main className="min-h-screen bg-background">
        <DashboardHeader user={user} />
        <div className="container mx-auto px-4 py-8">
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Loan not found</p>
            <Link href="/loans">
              <Button className="mt-4">Back to Loans</Button>
            </Link>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <div className="container mx-auto px-4 py-8">
        <Link href="/loans" className="flex items-center gap-2 text-primary hover:text-primary/80 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Loans
        </Link>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {loan.borrower?.first_name} {loan.borrower?.last_name}
            </h1>
            <p className="text-muted-foreground mt-1">{loan.borrower?.email}</p>
          </div>
          <div className="flex gap-2 items-center">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="text-destructive border-destructive hover:bg-destructive shadow-none bg-transparent hover:text-white group">
                  <Trash2 className="w-4 h-4" />
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
                        nextDue.isOverdue ? "text-red-600" : "text-foreground"
                      )}>
                        {nextDue.date ? format(nextDue.date, 'MMM dd, yyyy') : 'N/A'}
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
                      {lastPayment ? `₱${lastPayment.amount.toLocaleString()}` : 'None'}
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

          {/* Expanded Due Amount & Breakdown Card */}
          <Card className={cn(
            "p-6 border-l-4 md:col-span-2 shadow-sm transition-all duration-500",
            nextDue.isOverdue ? "border-l-red-600 bg-red-50/20" : "border-l-orange-500 bg-orange-50/10"
          )}>
            <div className="flex flex-col">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-orange-100 rounded-full text-orange-600 ring-4 ring-orange-50">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider">Total Amount Due to Stay Current</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-foreground tracking-tight">
                      ₱{nextDue.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    {nextDue.isOverdue && (
                      <Badge variant="destructive" className="animate-pulse h-5 font-black uppercase text-[10px] tracking-widest px-2">Overdue</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 font-medium italic opacity-70 uppercase">
                    (Standard Scheduled: ₱{nextDue.originalAmount.toLocaleString()})
                  </p>
                </div>
              </div>

              {/* Detailed Due Breakdown */}
              <div className="flex flex-col gap-3 mt-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                 <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <p className="text-[12px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-[0.15em]">Detailed Breakdown</p>
                      <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
                      <span className="text-[11px] font-bold text-slate-500 italic opacity-70">Catch-up Summary</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-black h-5 border-slate-300 text-slate-500 bg-white/50 backdrop-blur-sm px-2">
                      {nextDue.breakdown.length} Periods
                    </Badge>
                 </div>
                 
                 <div className="relative space-y-5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
                   {nextDue?.breakdown?.map((item: any, idx: number) => (
                     <div key={idx} className="relative pl-8 flex justify-between items-center group transition-all duration-300 hover:translate-x-1">
                       {/* Status Dot Indicator */}
                       <div className={cn(
                         "absolute left-0 top-[2px] w-[22px] h-[22px] rounded-full border-4 border-white dark:border-slate-950 flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-125 z-10",
                         item.isOverdue ? "bg-red-500" : "bg-blue-500"
                       )}>
                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                       </div>

                       <div className="flex flex-col">
                         <span className="text-[14px] font-black text-foreground tracking-tight leading-none">
                           {format(item.date, 'MMMM dd, yyyy')}
                         </span>
                         <div className="flex items-center gap-2 mt-2">
                           <span className={cn(
                             "text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-sm tracking-widest",
                             item.isOverdue ? "bg-red-600 text-white" : "bg-blue-600 text-white"
                           )}>
                             {item.isOverdue ? 'Overdue' : 'Upcoming'}
                           </span>
                           <div className="h-1 w-1 rounded-full bg-slate-300" />
                           <span className="text-[9px] text-muted-foreground font-bold tracking-tight opacity-80 uppercase">
                             Opening: ₱{item.openingBalance?.toLocaleString()}
                           </span>
                           {item.paidAmount > 0 && (
                             <>
                               <div className="h-1 w-1 rounded-full bg-slate-300" />
                               <span className="text-[9px] text-emerald-700 font-bold tracking-tight opacity-80 uppercase">
                                 Paid: ₱{item.paidAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                               </span>
                             </>
                           )}
                         </div>
                         <div className="mt-1 text-[9px] text-muted-foreground font-bold tracking-tight opacity-70 uppercase">
                           Scheduled: ₱{item.scheduledAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                         </div>
                       </div>

                       <div className="text-right">
                         <div className="flex items-center gap-6 justify-end">
                           <div className="flex gap-4">
                             <div className="flex flex-col items-end">
                               <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">Principal</p>
                               <span className="text-[13px] font-black text-blue-600">₱{item.principal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                             </div>
                             <div className="flex flex-col items-end">
                               <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">Interest</p>
                               <span className="text-[13px] font-black text-orange-500">₱{item.interest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                             </div>
                           </div>
                           <div className="h-10 w-px bg-slate-200 dark:bg-slate-800" />
                           <div className="flex flex-col items-end">
                             <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">Due</p>
                             <div className="text-[16px] font-black text-foreground tracking-tighter">
                               ₱{item.remainingDue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                             </div>
                           </div>
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-foreground mb-4">Loan Details</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Loan Amount</p>
                  <p className="text-2xl font-bold text-foreground mt-2">
                    ₱{loan.loan_amount?.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                  <p className="text-2xl font-bold text-foreground mt-2">
                    ₱{loan.balance?.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Interest Rate</p>
                  <p className="text-xl font-bold text-foreground mt-2">{loan.interest_rate / 12}% monthly</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Interest Type</p>
                  <p className="text-xl font-bold text-foreground mt-2 capitalize">{loan.interest_type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Loan Term</p>
                  <p className="text-xl font-bold text-foreground mt-2">{loan.loan_term_months} months</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Frequency</p>
                  <p className="text-xl font-bold text-foreground mt-2 capitalize">{loan.payment_frequency}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Disbursement Date</p>
                  <p className="text-sm font-semibold text-foreground mt-2">
                    {new Date(loan.disbursement_date).toLocaleDateString('en-PH')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Penalty per Day</p>
                  <p className="text-xl font-bold text-foreground mt-2">{loan.penalty_per_day}%</p>
                </div>
              </div>
            </Card>

            <PaymentsList loanId={loanId} payments={payments} />
          </div>

          <div>
            <LoanSummary loanId={loanId} loan={loan} />
          </div>
        </div>
      </div>
    </main>
  )
}

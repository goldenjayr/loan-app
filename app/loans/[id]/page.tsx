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
    if (!loan) return { date: null, amount: 0, originalAmount: 0, principal: 0, interest: 0, openingBalance: 0, isOverdue: false }

    const monthlyInstalment = calculateMonthlyPayment(
      loan.principal_amount,
      loan.interest_rate,
      loan.loan_term_months
    )

    const totalPaid = payments.reduce((sum, p: any) => sum + p.amount, 0)
    const disburseDate = new Date(loan.disbursement_date)
    const frequency = loan.payment_frequency || 'monthly'
    
    let nextDate = new Date(disburseDate)
    let cumulativeDue = 0
    let periodsCalculated = 0

    // Find the first milestone where cumulativeDue > totalPaid
    while (periodsCalculated < loan.loan_term_months) {
      if (frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1)
      else if (frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7)
      else if (frequency === 'biweekly') nextDate.setDate(nextDate.getDate() + 14)
      else if (frequency === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3)
      else break

      cumulativeDue += monthlyInstalment
      periodsCalculated++

      if (cumulativeDue > totalPaid + 0.01) { // 0.01 for floating point precision
        break
      }
    }

    // Find the opening balance for this specific period in the schedule
    // A simple way is to use the amortization formula for Opening Balance of period 'n'
    // or just calculate the principal reduction expected up to the previous period.
    let scheduledOpeningBalance = loan.principal_amount
    let currentPrincipal = loan.principal_amount
    const monthlyRate = loan.interest_rate / 100 / 12

    for (let i = 1; i < periodsCalculated; i++) {
        const intP = currentPrincipal * monthlyRate
        const prinP = monthlyInstalment - intP
        currentPrincipal -= prinP
    }
    scheduledOpeningBalance = currentPrincipal

    const scheduledInterest = (scheduledOpeningBalance * monthlyRate)
    const scheduledPrincipal = Math.max(0, monthlyInstalment - scheduledInterest)
    const remainingAmount = Math.max(0, cumulativeDue - totalPaid)

    return {
      date: nextDate,
      amount: remainingAmount,
      originalAmount: monthlyInstalment,
      principal: scheduledPrincipal,
      interest: scheduledInterest,
      openingBalance: scheduledOpeningBalance,
      isOverdue: nextDate < new Date() && (remainingAmount > 0.01)
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
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 border-l-4 border-l-primary">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full text-primary">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Next Due Date</p>
                <div className="flex items-center gap-2">
                  <p className={cn(
                    "text-xl font-bold",
                    nextDue.isOverdue ? "text-red-600" : "text-foreground"
                  )}>
                    {nextDue.date ? format(nextDue.date, 'MMM dd, yyyy') : 'N/A'}
                  </p>
                  {nextDue.isOverdue && (
                    <Badge variant="destructive" className="text-[10px] h-4 px-1 uppercase">Overdue</Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
          <Card className={cn(
            "p-6 border-l-4",
            nextDue.isOverdue ? "border-l-red-600 bg-red-50/30" : "border-l-orange-500"
          )}>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-full text-orange-600">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Next Due Amount</p>
                <p className="text-xl font-bold text-foreground">
                  ₱{nextDue.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <div className="flex gap-2 mt-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">
                    ₱{nextDue.originalAmount.toLocaleString()} scheduled
                  </p>
                </div>
                <div className="flex gap-3 mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                   <div className="flex items-center gap-1">
                     <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                     <span>₱{nextDue.principal.toLocaleString(undefined, { maximumFractionDigits: 0 })} Principal</span>
                   </div>
                   <div className="flex items-center gap-1">
                     <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                     <span>₱{nextDue.interest.toLocaleString(undefined, { maximumFractionDigits: 0 })} Interest</span>
                     <span className="text-[8px] opacity-70 ml-1">
                       (₱{nextDue.openingBalance?.toLocaleString()} × {(loan.interest_rate/12).toFixed(1)}%)
                     </span>
                   </div>
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-6 border-l-4 border-l-green-500">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full text-green-600">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Last Payment</p>
                <p className="text-xl font-bold text-foreground">
                  {lastPayment ? `₱${lastPayment.amount.toLocaleString()}` : 'None'}
                </p>
                {lastPayment && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(lastPayment.payment_date), 'MMM dd')}
                  </p>
                )}
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

import { notFound } from 'next/navigation'
import { getBorrower, listLoansForBorrower } from '@/lib/data'
import { PageTransition } from '@/lib/view-transition'
import { TransitionLink } from '@/components/transition-link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus } from 'lucide-react'
import BorrowerActions from './borrower-detail-client'

function statusBadgeClass(status: string) {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'completed':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    default:
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  }
}

export default async function BorrowerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const borrowerId = Number(id)
  if (!Number.isInteger(borrowerId) || borrowerId <= 0) notFound()

  const [borrower, loans] = await Promise.all([
    getBorrower(borrowerId),
    listLoansForBorrower(borrowerId),
  ])

  if (!borrower) notFound()

  const totalLoans = loans.length
  const totalBorrowed = loans.reduce((sum, l) => sum + (l.loan_amount || 0), 0)
  const totalOutstanding = loans.reduce((sum, l) => sum + (l.balance || 0), 0)
  const totalRepaid = totalBorrowed - totalOutstanding
  const activeLoans = loans.filter((l) => l.status === 'active').length

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <TransitionLink
          href="/borrowers"
          transition="back"
          className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6 min-h-11"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          Back to Borrowers
        </TransitionLink>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-pretty truncate">
            {borrower.first_name} {borrower.last_name}
          </h1>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <BorrowerActions borrowerId={String(borrowerId)} loanCount={loans.length} />
            <TransitionLink href="/loans/new" className="w-full sm:w-auto">
              <Button className="gap-2 w-full sm:w-auto min-h-11">
                <Plus className="w-4 h-4" aria-hidden="true" /> Create Loan
              </Button>
            </TransitionLink>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 sm:gap-8 mb-6 sm:mb-8">
          <div className="lg:col-span-2">
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Contact Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-foreground font-medium mt-1 truncate">{borrower.email}</p>
                </div>
                {borrower.phone && (
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="text-foreground font-medium mt-1 truncate">{borrower.phone}</p>
                  </div>
                )}
                {borrower.address && (
                  <div className="sm:col-span-2 min-w-0">
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="text-foreground font-medium mt-1 text-pretty">
                      {borrower.address}, {borrower.city}, {borrower.province} {borrower.zip_code}
                    </p>
                  </div>
                )}
                {borrower.id_number && (
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">ID</p>
                    <p className="text-foreground font-medium mt-1 font-mono text-sm truncate">
                      {borrower.id_number}
                    </p>
                  </div>
                )}
                {borrower.id_type && (
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">ID Type</p>
                    <p className="text-foreground font-medium mt-1 truncate">{borrower.id_type}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4">
            <Card className="p-4 sm:p-6">
              <p className="text-sm text-muted-foreground mb-2">Total Loans</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">{totalLoans}</p>
              <p className="text-xs text-muted-foreground mt-2">{activeLoans} active</p>
            </Card>
            <Card className="p-4 sm:p-6">
              <p className="text-sm text-muted-foreground mb-2">Total Borrowed</p>
              <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
                ₱{totalBorrowed.toLocaleString()}
              </p>
            </Card>
            <Card className="p-4 sm:p-6">
              <p className="text-sm text-muted-foreground mb-2">Total Repaid</p>
              <p className="text-2xl sm:text-3xl font-bold text-green-600 tabular-nums">
                ₱{totalRepaid.toLocaleString()}
              </p>
            </Card>
            <Card className="p-4 sm:p-6">
              <p className="text-sm text-muted-foreground mb-2">Outstanding</p>
              <p className="text-2xl sm:text-3xl font-bold text-orange-600 tabular-nums">
                ₱{totalOutstanding.toLocaleString()}
              </p>
            </Card>
          </div>
        </div>

        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 sm:mb-6">Loan History</h2>
          {loans.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              {loans.map((loan) => (
                <TransitionLink key={loan.id} href={`/loans/${loan.id}`} className="block">
                  <div className="p-4 border border-border rounded-lg hover:border-primary hover:bg-muted transition cursor-pointer">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="font-semibold text-foreground">Loan #{loan.id}</h3>
                      <Badge className={statusBadgeClass(loan.status)}>
                        {loan.status?.charAt(0).toUpperCase() + loan.status?.slice(1)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Loan Amount</p>
                        <p className="font-semibold text-foreground tabular-nums">
                          ₱{loan.loan_amount?.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Balance</p>
                        <p className="font-semibold text-foreground tabular-nums">
                          ₱{loan.balance?.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Annual Rate</p>
                        <p className="font-semibold text-foreground tabular-nums">{loan.interest_rate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p className="font-semibold text-foreground tabular-nums">
                          {new Date(loan.created_at).toLocaleDateString('en-PH')}
                        </p>
                      </div>
                    </div>
                  </div>
                </TransitionLink>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-muted-foreground mb-4">No loans for this borrower yet</p>
              <TransitionLink href="/loans/new">
                <Button className="min-h-11">Create First Loan</Button>
              </TransitionLink>
            </div>
          )}
        </Card>
      </div>
    </PageTransition>
  )
}

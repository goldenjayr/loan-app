import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import { TransitionLink } from '@/components/transition-link'

interface LoansListProps {
  loans: any[]
}

export default function LoansList({ loans }: LoansListProps) {
  const recentLoans = loans.slice(0, 5)

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

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between mb-6 gap-3">
        <h2 className="text-lg font-semibold text-foreground">Recent Loans</h2>
        <TransitionLink href="/loans" transition="forward">
          <Button variant="ghost" size="sm" className="gap-2 min-h-10">
            View All <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </TransitionLink>
      </div>

      <div className="space-y-3 stagger-in">
        {recentLoans.length > 0 ? (
          recentLoans.map((loan) => (
            <TransitionLink
              key={loan.id}
              href={`/loans/${loan.id}`}
              className="block p-4 rounded-lg border border-border hover:border-primary hover:bg-muted/60 transition-[border-color,background-color] duration-200"
            >
              <div className="flex items-center justify-between mb-2 gap-3">
                <h3 className="font-semibold text-foreground truncate min-w-0">
                  {loan.borrower?.first_name} {loan.borrower?.last_name}
                </h3>
                <Badge className={`${getStatusColor(loan.status)} shrink-0`}>
                  {loan.status?.charAt(0).toUpperCase() + loan.status?.slice(1)}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="min-w-0">
                  <p className="text-muted-foreground">Loan Amount</p>
                  <p className="font-semibold text-foreground tabular-nums truncate">
                    ₱{Number(loan.loan_amount || 0).toLocaleString()}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-muted-foreground">Outstanding Balance</p>
                  <p className="font-semibold text-foreground tabular-nums truncate">
                    ₱{Number(loan.balance || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </TransitionLink>
          ))
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-3">No loans yet</p>
            <TransitionLink href="/loans/new">
              <Button className="min-h-11">Create a Loan</Button>
            </TransitionLink>
          </div>
        )}
      </div>
    </Card>
  )
}

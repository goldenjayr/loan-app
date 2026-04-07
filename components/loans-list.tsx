import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

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
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">Recent Loans</h2>
        <Link href="/loans">
          <Button variant="ghost" size="sm" className="gap-2">
            View All <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {recentLoans.length > 0 ? (
          recentLoans.map((loan) => (
            <Link
              key={loan.id}
              href={`/loans/${loan.id}`}
              className="block p-4 rounded-lg border border-border hover:border-primary hover:bg-muted transition"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-foreground">
                  {loan.borrower?.first_name} {loan.borrower?.last_name}
                </h3>
                <Badge className={getStatusColor(loan.status)}>
                  {loan.status?.charAt(0).toUpperCase() + loan.status?.slice(1)}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Loan Amount</p>
                  <p className="font-semibold text-foreground">₱{loan.loan_amount?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Outstanding Balance</p>
                  <p className="font-semibold text-foreground">₱{loan.balance?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Interest Rate</p>
                  <p className="font-semibold text-foreground">{loan.interest_rate / 12}% monthly</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-semibold text-foreground">
                    {new Date(loan.created_at).toLocaleDateString('en-PH')}
                  </p>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No loans yet</p>
            <Link href="/loans/new">
              <Button className="mt-4">Create First Loan</Button>
            </Link>
          </div>
        )}
      </div>
    </Card>
  )
}

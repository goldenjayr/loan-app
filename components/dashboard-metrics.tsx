import { Card } from '@/components/ui/card'
import { TrendingUp, Users, DollarSign, AlertCircle } from 'lucide-react'

interface DashboardMetricsProps {
  loans: any[]
  borrowers: any[]
}

export default function DashboardMetrics({ loans, borrowers }: DashboardMetricsProps) {
  const totalLoans = loans.length
  const totalBorrowers = borrowers.length
  const totalLoanAmount = loans.reduce((sum, loan) => sum + (loan.loan_amount || 0), 0)
  const totalBalance = loans.reduce((sum, loan) => sum + (loan.balance || 0), 0)
  const activeLoans = loans.filter(loan => loan.status === 'active').length

  const metrics = [
    {
      title: 'Total Loans',
      value: totalLoans,
      icon: TrendingUp,
      color: 'bg-blue-50 dark:bg-blue-950',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Active Borrowers',
      value: totalBorrowers,
      icon: Users,
      color: 'bg-green-50 dark:bg-green-950',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      title: 'Total Disbursed',
      value: `₱${(totalLoanAmount / 1000000).toFixed(2)}M`,
      icon: DollarSign,
      color: 'bg-purple-50 dark:bg-purple-950',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      title: 'Outstanding Balance',
      value: `₱${(totalBalance / 1000000).toFixed(2)}M`,
      icon: AlertCircle,
      color: 'bg-orange-50 dark:bg-orange-950',
      iconColor: 'text-orange-600 dark:text-orange-400',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon
        return (
          <Card key={index} className="p-6 hover:shadow-lg transition">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{metric.title}</p>
                <p className="text-2xl font-bold text-foreground mt-2">{metric.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${metric.color}`}>
                <Icon className={`w-6 h-6 ${metric.iconColor}`} />
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

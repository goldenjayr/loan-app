'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Download } from 'lucide-react'

type Loan = {
  id: number
  loan_amount: number
  balance: number
  interest_rate: number
  status: string
  created_at: string
  borrower: { first_name: string; last_name: string } | null
}

type Props = {
  loans: Loan[]
}

export default function ReportsClient({ loans }: Props) {
  const handleExport = () => {
    const headers = ['Borrower', 'Loan Amount', 'Balance', 'Annual Interest Rate', 'Status', 'Created Date']
    const rows = loans.map((loan) => [
      `${loan.borrower?.first_name ?? ''} ${loan.borrower?.last_name ?? ''}`.trim(),
      loan.loan_amount,
      loan.balance,
      loan.interest_rate,
      loan.status,
      new Date(loan.created_at).toLocaleDateString('en-PH'),
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `loan-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const statusData = [
    { name: 'Active', value: loans.filter((l) => l.status === 'active').length, color: '#10b981' },
    { name: 'Completed', value: loans.filter((l) => l.status === 'completed').length, color: '#3b82f6' },
    { name: 'Defaulted', value: loans.filter((l) => l.status === 'defaulted').length, color: '#ef4444' },
  ]

  const monthlyData = (() => {
    const months: Record<string, number> = {}
    loans.forEach((loan) => {
      const month = new Date(loan.created_at).toLocaleDateString('en-PH', {
        month: 'short',
        year: '2-digit',
      })
      months[month] = (months[month] || 0) + loan.loan_amount
    })
    return Object.entries(months).map(([month, amount]) => ({ month, amount: Number(amount) }))
  })()

  const totalPortfolio = loans.reduce((sum, l) => sum + (l.loan_amount || 0), 0)
  const totalOutstanding = loans.reduce((sum, l) => sum + (l.balance || 0), 0)
  const totalCollected = totalPortfolio - totalOutstanding
  const avgRate = loans.length > 0
    ? loans.reduce((sum, l) => sum + (l.interest_rate || 0), 0) / loans.length
    : 0

  const metrics = [
    { title: 'Total Portfolio Value', value: `₱${totalPortfolio.toLocaleString()}` },
    { title: 'Total Outstanding', value: `₱${totalOutstanding.toLocaleString()}` },
    { title: 'Total Collected', value: `₱${totalCollected.toLocaleString()}` },
    { title: 'Avg Annual Interest Rate', value: `${avgRate.toFixed(2)}%` },
  ]

  const statusClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      default:
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-pretty">
          Reports &amp; Analytics
        </h1>
        <Button onClick={handleExport} className="gap-2 w-full sm:w-auto min-h-11">
          <Download className="w-4 h-4" aria-hidden="true" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {metrics.map((metric) => (
          <Card key={metric.title} className="p-4 sm:p-6">
            <p className="text-sm text-muted-foreground mb-2">{metric.title}</p>
            <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums">{metric.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
        <Card className="p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Loan Status Distribution</h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
            {statusData.map((entry) => (
              <li key={entry.name} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
                {entry.name}: {entry.value}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Monthly Disbursements</h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis width={48} tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip formatter={(value) => `₱${Number(value).toLocaleString()}`} />
                <Bar dataKey="amount" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-4 sm:p-6 mt-6 sm:mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Loan Summary</h2>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left py-3 px-4 sm:px-0 text-muted-foreground font-semibold">Borrower</th>
                <th className="text-left py-3 text-muted-foreground font-semibold">Loan Amount</th>
                <th className="text-left py-3 text-muted-foreground font-semibold">Balance</th>
                <th className="text-left py-3 text-muted-foreground font-semibold">Collected</th>
                <th className="text-left py-3 text-muted-foreground font-semibold">Annual Rate</th>
                <th className="text-left py-3 text-muted-foreground font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr key={loan.id} className="border-b border-border hover:bg-muted transition">
                  <td className="py-3 px-4 sm:px-0 font-medium text-foreground truncate max-w-[160px]">
                    {loan.borrower?.first_name} {loan.borrower?.last_name}
                  </td>
                  <td className="py-3 text-foreground tabular-nums">₱{loan.loan_amount?.toLocaleString()}</td>
                  <td className="py-3 text-foreground tabular-nums">₱{loan.balance?.toLocaleString()}</td>
                  <td className="py-3 text-green-600 tabular-nums">
                    ₱{((loan.loan_amount || 0) - (loan.balance || 0)).toLocaleString()}
                  </td>
                  <td className="py-3 text-foreground tabular-nums">{loan.interest_rate}%</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusClass(loan.status)}`}>
                      {loan.status?.charAt(0).toUpperCase() + loan.status?.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

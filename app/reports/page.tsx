'use client'

import { useEffect, useState } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardHeader from '@/components/dashboard-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Download } from 'lucide-react'

export default function ReportsPage() {
  const [user, setUser] = useState<any>(null)
  const [loans, setLoans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        redirect('/auth/login')
      }

      setUser(user)

      const response = await fetch('/api/loans')
      if (response.ok) {
        const data = await response.json()
        setLoans(data)
      }

      setLoading(false)
    }

    checkAuth()
  }, [])

  const handleExport = () => {
    const csv = generateCSV()
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `loan-report-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const generateCSV = () => {
    const headers = ['Borrower', 'Loan Amount', 'Balance', 'Interest Rate', 'Status', 'Created Date']
    const rows = loans.map(loan => [
      `${loan.borrower?.first_name} ${loan.borrower?.last_name}`,
      loan.loan_amount,
      loan.balance,
      loan.interest_rate,
      loan.status,
      new Date(loan.created_at).toLocaleDateString('en-PH'),
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')

    return csv
  }

  // Prepare data for charts
  const statusData = [
    {
      name: 'Active',
      value: loans.filter(l => l.status === 'active').length,
      color: '#10b981',
    },
    {
      name: 'Completed',
      value: loans.filter(l => l.status === 'completed').length,
      color: '#3b82f6',
    },
    {
      name: 'Defaulted',
      value: loans.filter(l => l.status === 'defaulted').length,
      color: '#ef4444',
    },
  ]

  const monthlyData = (() => {
    const months = {}
    loans.forEach(loan => {
      const month = new Date(loan.created_at).toLocaleDateString('en-PH', { month: 'short', year: '2-digit' })
      months[month] = (months[month] || 0) + loan.loan_amount
    })
    return Object.entries(months).map(([month, amount]) => ({
      month,
      amount: Number(amount),
    }))
  })()

  const metrics = [
    {
      title: 'Total Portfolio Value',
      value: `₱${loans.reduce((sum, l) => sum + (l.loan_amount || 0), 0).toLocaleString()}`,
    },
    {
      title: 'Total Outstanding',
      value: `₱${loans.reduce((sum, l) => sum + (l.balance || 0), 0).toLocaleString()}`,
    },
    {
      title: 'Total Collected',
      value: `₱${loans.reduce((sum, l) => sum + ((l.loan_amount || 0) - (l.balance || 0)), 0).toLocaleString()}`,
    },
    {
      title: 'Average Interest Rate',
      value: `${(loans.reduce((sum, l) => sum + (l.interest_rate || 0), 0) / loans.length).toFixed(2)}%`,
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
          <Button onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metrics.map((metric, index) => (
            <Card key={index} className="p-6">
              <p className="text-sm text-muted-foreground mb-2">{metric.title}</p>
              <p className="text-2xl font-bold text-foreground">{metric.value}</p>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Loan Status Distribution */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Loan Status Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
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
          </Card>

          {/* Monthly Disbursements */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Monthly Disbursements</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `₱${value.toLocaleString()}`} />
                <Bar dataKey="amount" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Summary Table */}
        <Card className="p-6 mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Loan Summary</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left py-3 text-muted-foreground font-semibold">Borrower</th>
                  <th className="text-left py-3 text-muted-foreground font-semibold">Loan Amount</th>
                  <th className="text-left py-3 text-muted-foreground font-semibold">Balance</th>
                  <th className="text-left py-3 text-muted-foreground font-semibold">Collected</th>
                  <th className="text-left py-3 text-muted-foreground font-semibold">Rate</th>
                  <th className="text-left py-3 text-muted-foreground font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr key={loan.id} className="border-b border-border hover:bg-muted transition">
                    <td className="py-3 font-medium text-foreground">
                      {loan.borrower?.first_name} {loan.borrower?.last_name}
                    </td>
                    <td className="py-3 text-foreground">₱{loan.loan_amount?.toLocaleString()}</td>
                    <td className="py-3 text-foreground">₱{loan.balance?.toLocaleString()}</td>
                    <td className="py-3 text-green-600">₱{((loan.loan_amount || 0) - (loan.balance || 0)).toLocaleString()}</td>
                    <td className="py-3 text-foreground">{loan.interest_rate}%</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        loan.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        loan.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
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
    </main>
  )
}

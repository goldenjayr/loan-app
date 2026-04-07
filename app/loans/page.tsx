'use client'

import { useEffect, useState } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardHeader from '@/components/dashboard-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Search, Plus } from 'lucide-react'

export default function LoansPage() {
  const [user, setUser] = useState<any>(null)
  const [loans, setLoans] = useState<any[]>([])
  const [filteredLoans, setFilteredLoans] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
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
        setFilteredLoans(data)
      }

      setLoading(false)
    }

    checkAuth()
  }, [])

  useEffect(() => {
    let filtered = loans

    if (statusFilter !== 'all') {
      filtered = filtered.filter(loan => loan.status === statusFilter)
    }

    if (searchTerm) {
      filtered = filtered.filter(loan =>
        `${loan.borrower?.first_name} ${loan.borrower?.last_name}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      )
    }

    setFilteredLoans(filtered)
  }, [searchTerm, statusFilter, loans])

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

  return (
    <main className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground">Loans</h1>
          <Link href="/loans/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> New Loan
            </Button>
          </Link>
        </div>

        <Card className="p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search by borrower name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'active' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('active')}
              >
                Active
              </Button>
              <Button
                variant={statusFilter === 'completed' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('completed')}
              >
                Completed
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          {filteredLoans.length > 0 ? (
            filteredLoans.map(loan => (
              <Link key={loan.id} href={`/loans/${loan.id}`}>
                <Card className="p-6 hover:shadow-lg transition cursor-pointer">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {loan.borrower?.first_name} {loan.borrower?.last_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">{loan.borrower?.email}</p>
                    </div>
                    <Badge className={getStatusColor(loan.status)}>
                      {loan.status?.charAt(0).toUpperCase() + loan.status?.slice(1)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase">Loan Amount</p>
                      <p className="text-xl font-bold text-foreground mt-1">
                        ₱{loan.loan_amount?.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase">Balance</p>
                      <p className="text-xl font-bold text-foreground mt-1">
                        ₱{loan.balance?.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase">Interest Rate</p>
                      <p className="text-xl font-bold text-foreground mt-1">{loan.interest_rate}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase">Term</p>
                      <p className="text-xl font-bold text-foreground mt-1">{loan.loan_term_months} months</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))
          ) : (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground mb-4">No loans found</p>
              <Link href="/loans/new">
                <Button>Create First Loan</Button>
              </Link>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TransitionLink } from '@/components/transition-link'
import { Search, Plus } from 'lucide-react'

function statusColor(status: string) {
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

export default function LoansPageClient({ loans }: { loans: any[] }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      if (statusFilter !== 'all' && loan.status !== statusFilter) return false
      if (!searchTerm) return true
      return `${loan.borrower?.first_name} ${loan.borrower?.last_name}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    })
  }, [loans, searchTerm, statusFilter])

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-pretty">Loans</h1>
        <TransitionLink href="/loans/new" className="w-full sm:w-auto">
          <Button className="gap-2 w-full sm:w-auto min-h-11">
            <Plus className="w-4 h-4" aria-hidden="true" /> New Loan
          </Button>
        </TransitionLink>
      </div>

      <Card className="p-4 sm:p-6 mb-6">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Search by borrower name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 min-h-11"
              name="loan-search"
              autoComplete="off"
              aria-label="Search loans by borrower name"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'active', 'completed'] as const).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                onClick={() => setStatusFilter(status)}
                className="min-h-11 capitalize"
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <div className="space-y-3 sm:space-y-4 stagger-in">
        {filteredLoans.length > 0 ? (
          filteredLoans.map((loan) => (
            <TransitionLink key={loan.id} href={`/loans/${loan.id}`} className="block group">
              <Card className="p-4 sm:p-6 transition-[box-shadow,border-color] duration-200 hover:shadow-md hover:border-primary/40">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {loan.borrower?.first_name} {loan.borrower?.last_name}
                    </h2>
                    <p className="text-sm text-muted-foreground truncate">{loan.borrower?.email}</p>
                  </div>
                  <Badge className={`${statusColor(loan.status)} shrink-0`}>
                    {loan.status?.charAt(0).toUpperCase() + loan.status?.slice(1)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-semibold uppercase">Loan Amount</p>
                    <p className="text-lg sm:text-xl font-bold text-foreground mt-1 tabular-nums truncate">
                      ₱{Number(loan.loan_amount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-semibold uppercase">Balance</p>
                    <p className="text-lg sm:text-xl font-bold text-foreground mt-1 tabular-nums truncate">
                      ₱{Number(loan.balance || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-semibold uppercase">Annual Rate</p>
                    <p className="text-lg sm:text-xl font-bold text-foreground mt-1 tabular-nums">{loan.interest_rate}%</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-semibold uppercase">Term</p>
                    <p className="text-lg sm:text-xl font-bold text-foreground mt-1 tabular-nums">
                      {loan.loan_term_months} months
                    </p>
                  </div>
                </div>
              </Card>
            </TransitionLink>
          ))
        ) : (
          <Card className="p-10 sm:p-12 text-center">
            <p className="text-muted-foreground mb-4">No loans found</p>
            <TransitionLink href="/loans/new">
              <Button className="min-h-11">Create First Loan</Button>
            </TransitionLink>
          </Card>
        )}
      </div>
    </div>
  )
}

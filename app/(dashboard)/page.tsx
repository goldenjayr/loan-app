import { Suspense } from 'react'
import DashboardMetrics from '@/components/dashboard-metrics'
import BorrowersList from '@/components/borrowers-list'
import LoansList from '@/components/loans-list'
import { listBorrowers, listLoans } from '@/lib/data'
import { PageTransition, ViewTransition } from '@/lib/view-transition'

async function DashboardBody() {
  const [loans, borrowers] = await Promise.all([listLoans(), listBorrowers()])

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 stagger-in">
      <ViewTransition enter="slide-up" default="none">
        <DashboardMetrics loans={loans} borrowers={borrowers} />
      </ViewTransition>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <LoansList loans={loans} />
        </div>
        <div>
          <BorrowersList borrowers={borrowers} />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <PageTransition>
      <Suspense
        fallback={
          <div className="container mx-auto px-4 py-8 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-muted/70 animate-pulse" />
              ))}
            </div>
            <div className="h-72 rounded-xl bg-muted/50 animate-pulse" />
          </div>
        }
      >
        <ViewTransition enter="slide-up" exit="slide-down" default="none">
          <DashboardBody />
        </ViewTransition>
      </Suspense>
    </PageTransition>
  )
}

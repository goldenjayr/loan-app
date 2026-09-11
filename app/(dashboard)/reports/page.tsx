import { listLoans } from '@/lib/data'
import { PageTransition } from '@/lib/view-transition'
import ReportsClient from './reports-client'

export default async function ReportsPage() {
  const loans = await listLoans()
  return (
    <PageTransition>
      <ReportsClient loans={loans} />
    </PageTransition>
  )
}

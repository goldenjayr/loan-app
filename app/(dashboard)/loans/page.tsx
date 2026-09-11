import { listLoans } from '@/lib/data'
import { PageTransition } from '@/lib/view-transition'
import LoansPageClient from './loans-page-client'

export default async function LoansPage() {
  const loans = await listLoans()
  return (
    <PageTransition>
      <LoansPageClient loans={loans} />
    </PageTransition>
  )
}

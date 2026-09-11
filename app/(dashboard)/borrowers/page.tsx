import { listBorrowers } from '@/lib/data'
import { PageTransition } from '@/lib/view-transition'
import BorrowersPageClient from './borrowers-page-client'

export default async function BorrowersPage() {
  const borrowers = await listBorrowers()
  return (
    <PageTransition>
      <BorrowersPageClient borrowers={borrowers} />
    </PageTransition>
  )
}

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, Plus } from 'lucide-react'

interface BorrowersListProps {
  borrowers: any[]
}

export default function BorrowersList({ borrowers }: BorrowersListProps) {
  const recentBorrowers = borrowers.slice(0, 8)

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">Borrowers</h2>
        <Link href="/borrowers/new">
          <Button variant="ghost" size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      <div className="space-y-2">
        {recentBorrowers.length > 0 ? (
          <>
            {recentBorrowers.map((borrower) => (
              <Link
                key={borrower.id}
                href={`/borrowers/${borrower.id}`}
                className="block p-3 rounded-lg hover:bg-muted transition"
              >
                <p className="font-medium text-foreground text-sm">
                  {borrower.first_name} {borrower.last_name}
                </p>
                <p className="text-xs text-muted-foreground">{borrower.email}</p>
              </Link>
            ))}
            {borrowers.length > 8 && (
              <Link href="/borrowers">
                <Button variant="ghost" size="sm" className="w-full gap-2 mt-2">
                  View All <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No borrowers yet</p>
            <Link href="/borrowers/new">
              <Button size="sm" className="mt-3">Add Borrower</Button>
            </Link>
          </div>
        )}
      </div>
    </Card>
  )
}

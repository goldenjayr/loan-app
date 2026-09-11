import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, Plus } from 'lucide-react'
import { TransitionLink } from '@/components/transition-link'

interface BorrowersListProps {
  borrowers: any[]
}

export default function BorrowersList({ borrowers }: BorrowersListProps) {
  const recentBorrowers = borrowers.slice(0, 8)

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center justify-between mb-6 gap-2">
        <h2 className="text-lg font-semibold text-foreground">Borrowers</h2>
        <TransitionLink href="/borrowers/new" aria-label="Add borrower">
          <Button variant="ghost" size="sm" className="gap-2 min-h-10 min-w-10">
            <Plus className="w-4 h-4" aria-hidden="true" />
          </Button>
        </TransitionLink>
      </div>

      <div className="space-y-1 stagger-in">
        {recentBorrowers.length > 0 ? (
          <>
            {recentBorrowers.map((borrower) => (
              <TransitionLink
                key={borrower.id}
                href={`/borrowers/${borrower.id}`}
                className="block p-3 rounded-lg hover:bg-muted transition-colors duration-200"
              >
                <p className="font-medium text-foreground text-sm truncate">
                  {borrower.first_name} {borrower.last_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">{borrower.email}</p>
              </TransitionLink>
            ))}
            {borrowers.length > 8 && (
              <TransitionLink href="/borrowers" className="block mt-2">
                <Button variant="ghost" size="sm" className="w-full gap-2 min-h-10">
                  View All <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Button>
              </TransitionLink>
            )}
          </>
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No borrowers yet</p>
            <TransitionLink href="/borrowers/new">
              <Button size="sm" className="mt-3 min-h-10">
                Add Borrower
              </Button>
            </TransitionLink>
          </div>
        )}
      </div>
    </Card>
  )
}

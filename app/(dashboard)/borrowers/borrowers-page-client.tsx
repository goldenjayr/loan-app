'use client'

import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TransitionLink } from '@/components/transition-link'
import { Search, Plus } from 'lucide-react'

export default function BorrowersPageClient({ borrowers }: { borrowers: any[] }) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredBorrowers = useMemo(() => {
    if (!searchTerm) return borrowers
    const q = searchTerm.toLowerCase()
    return borrowers.filter((b) =>
      `${b.first_name} ${b.last_name} ${b.email}`.toLowerCase().includes(q)
    )
  }, [borrowers, searchTerm])

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground text-pretty">Borrowers</h1>
        <TransitionLink href="/borrowers/new" className="w-full sm:w-auto">
          <Button className="gap-2 w-full sm:w-auto min-h-11">
            <Plus className="w-4 h-4" aria-hidden="true" /> New Borrower
          </Button>
        </TransitionLink>
      </div>

      <Card className="p-4 sm:p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search borrowers by name or email…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 min-h-11"
            name="borrower-search"
            autoComplete="off"
            aria-label="Search borrowers"
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 stagger-in">
        {filteredBorrowers.length > 0 ? (
          filteredBorrowers.map((borrower) => (
            <TransitionLink key={borrower.id} href={`/borrowers/${borrower.id}`} className="block h-full group">
              <Card className="p-5 sm:p-6 h-full transition-[box-shadow,border-color] duration-200 hover:shadow-md hover:border-primary/40">
                <div className="mb-4 min-w-0">
                  <h2 className="text-lg font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {borrower.first_name} {borrower.last_name}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 truncate">{borrower.email}</p>
                </div>

                <div className="space-y-2 text-sm">
                  {borrower.phone && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Phone</p>
                      <p className="text-foreground">{borrower.phone}</p>
                    </div>
                  )}
                  {(borrower.city || borrower.province) && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Location</p>
                      <p className="text-foreground truncate">
                        {[borrower.city, borrower.province].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </TransitionLink>
          ))
        ) : (
          <Card className="p-10 sm:p-12 text-center md:col-span-2 lg:col-span-3">
            <p className="text-muted-foreground mb-4">No borrowers found</p>
            <TransitionLink href="/borrowers/new">
              <Button className="min-h-11">Add First Borrower</Button>
            </TransitionLink>
          </Card>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardHeader from '@/components/dashboard-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { Search, Plus } from 'lucide-react'

export default function BorrowersPage() {
  const [user, setUser] = useState<any>(null)
  const [borrowers, setBorrowers] = useState<any[]>([])
  const [filteredBorrowers, setFilteredBorrowers] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        redirect('/auth/login')
      }

      setUser(user)

      const response = await fetch('/api/borrowers')
      if (response.ok) {
        const data = await response.json()
        setBorrowers(data)
        setFilteredBorrowers(data)
      }

      setLoading(false)
    }

    checkAuth()
  }, [])

  useEffect(() => {
    if (searchTerm) {
      const filtered = borrowers.filter(borrower =>
        `${borrower.first_name} ${borrower.last_name} ${borrower.email}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      )
      setFilteredBorrowers(filtered)
    } else {
      setFilteredBorrowers(borrowers)
    }
  }, [searchTerm, borrowers])

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
          <h1 className="text-3xl font-bold text-foreground">Borrowers</h1>
          <Link href="/borrowers/new">
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> New Borrower
            </Button>
          </Link>
        </div>

        <Card className="p-6 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search borrowers by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBorrowers.length > 0 ? (
            filteredBorrowers.map(borrower => (
              <Link key={borrower.id} href={`/borrowers/${borrower.id}`}>
                <Card className="p-6 hover:shadow-lg transition cursor-pointer h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {borrower.first_name} {borrower.last_name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">{borrower.email}</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    {borrower.phone && (
                      <div>
                        <p className="text-muted-foreground">Phone</p>
                        <p className="text-foreground">{borrower.phone}</p>
                      </div>
                    )}
                    {borrower.city && (
                      <div>
                        <p className="text-muted-foreground">Location</p>
                        <p className="text-foreground">{borrower.city}, {borrower.province}</p>
                      </div>
                    )}
                    {borrower.id_number && (
                      <div>
                        <p className="text-muted-foreground">ID</p>
                        <p className="text-foreground text-xs font-mono">{borrower.id_number}</p>
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            ))
          ) : (
            <Card className="col-span-full p-12 text-center">
              <p className="text-muted-foreground mb-4">No borrowers found</p>
              <Link href="/borrowers/new">
                <Button>Add First Borrower</Button>
              </Link>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}

'use client'

import { useEffect, useState } from 'react'
import DashboardHeader from '@/components/dashboard-header'
import DashboardMetrics from '@/components/dashboard-metrics'
import BorrowersList from '@/components/borrowers-list'
import LoansList from '@/components/loans-list'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const [loans, setLoans] = useState<any[]>([])
  const [borrowers, setBorrowers] = useState<any[]>([])
  const [user, setUser] = useState<{ email?: string | null } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getUser()
        setUser(data.user)
      } catch (error) {
        console.error('Failed to fetch user:', error)
      }

      try {
        const loansResponse = await fetch('/api/loans')
        if (loansResponse.ok) {
          setLoans(await loansResponse.json())
        }
      } catch (error) {
        console.error('Failed to fetch loans:', error)
      }

      try {
        const borrowersResponse = await fetch('/api/borrowers')
        if (borrowersResponse.ok) {
          setBorrowers(await borrowersResponse.json())
        }
      } catch (error) {
        console.error('Failed to fetch borrowers:', error)
      }

      setLoading(false)
    }

    loadData()
  }, [])

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

      <div className="container mx-auto px-4 py-8 space-y-8">
        <DashboardMetrics loans={loans} borrowers={borrowers} />

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <LoansList loans={loans} />
          </div>
          <div>
            <BorrowersList borrowers={borrowers} />
          </div>
        </div>
      </div>
    </main>
  )
}

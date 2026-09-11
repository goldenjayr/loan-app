import DashboardHeader from '@/components/dashboard-header'
import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={user} />
      <main id="main-content">
        <Suspense
          fallback={
            <div className="container mx-auto px-4 py-8 space-y-4">
              <div className="h-8 w-48 rounded-md bg-muted animate-pulse" />
              <div className="h-40 rounded-xl bg-muted/70 animate-pulse" />
              <div className="h-64 rounded-xl bg-muted/50 animate-pulse" />
            </div>
          }
        >
          {children}
        </Suspense>
      </main>
    </div>
  )
}

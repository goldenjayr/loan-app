'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface DashboardHeaderProps {
  user?: { email?: string | null } | null
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.replace('/auth/login')
      router.refresh()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
            LMS
          </div>
          <h1 className="text-2xl font-bold text-foreground">Loan Manager</h1>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-sm font-medium text-foreground hover:text-primary transition">
            Dashboard
          </Link>
          <Link href="/loans" className="text-sm font-medium text-foreground hover:text-primary transition">
            Loans
          </Link>
          <Link href="/borrowers" className="text-sm font-medium text-foreground hover:text-primary transition">
            Borrowers
          </Link>
          <Link href="/reports" className="text-sm font-medium text-foreground hover:text-primary transition">
            Reports
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          {user?.email && (
            <div className="text-sm text-muted-foreground hidden md:block">{user.email}</div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="hidden md:inline-flex"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2">
            <Menu className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border px-4 py-4 space-y-3 bg-muted">
          <Link href="/" className="block text-sm font-medium text-foreground hover:text-primary">
            Dashboard
          </Link>
          <Link href="/loans" className="block text-sm font-medium text-foreground hover:text-primary">
            Loans
          </Link>
          <Link href="/borrowers" className="block text-sm font-medium text-foreground hover:text-primary">
            Borrowers
          </Link>
          <Link href="/reports" className="block text-sm font-medium text-foreground hover:text-primary">
            Reports
          </Link>
          <button
            className="block text-sm font-medium text-foreground hover:text-primary"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </header>
  )
}

'use client'

import Link from 'next/link'
import { Menu } from 'lucide-react'
import { useState } from 'react'

interface DashboardHeaderProps {
  user?: any
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
          {user && (
            <div className="text-sm text-muted-foreground hidden md:block">
              {user.email}
            </div>
          )}
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
        </div>
      )}
    </header>
  )
}

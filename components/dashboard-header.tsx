'use client'

import { TransitionLink } from '@/components/transition-link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Menu } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { addTransitionType } from '@/lib/view-transition'

interface DashboardHeaderProps {
  user?: { email?: string | null } | null
}

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/loans', label: 'Loans' },
  { href: '/borrowers', label: 'Borrowers' },
  { href: '/reports', label: 'Reports' },
]

export default function DashboardHeader({ user }: DashboardHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [signingOut, startSignOut] = useTransition()
  const menuId = useId()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuPanelRef = useRef<HTMLDivElement>(null)

  function handleSignOut() {
    startSignOut(async () => {
      const supabase = createClient()
      await supabase.auth.signOut()
      addTransitionType('nav-back')
      router.replace('/auth/login')
      router.refresh()
    })
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  useEffect(() => {
    if (!mobileMenuOpen) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const firstLink = menuPanelRef.current?.querySelector<HTMLElement>('a, button')
    firstLink?.focus()

    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileMenuOpen])

  return (
    <header
      className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md"
      style={{ viewTransitionName: 'site-header' }}
    >
      <div className="container mx-auto px-4 py-3.5 flex items-center justify-between">
        <TransitionLink href="/" transition="back" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm shadow-sm">
            LMS
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Loan Manager</h1>
        </TransitionLink>

        <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
          {NAV.map((item) => (
            <TransitionLink
              key={item.href}
              href={item.href}
              transition="none"
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/80 hover:text-primary hover:bg-muted'
              }`}
            >
              {item.label}
            </TransitionLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {user?.email && (
            <div className="text-sm text-muted-foreground hidden md:block truncate max-w-[180px]">
              {user.email}
            </div>
          )}
          <ThemeToggle className="hidden md:inline-flex" />
          <TransitionLink
            href="/settings/password"
            transition="none"
            className="hidden md:inline-flex items-center min-h-11 px-3 rounded-md text-sm font-medium text-foreground/80 hover:text-primary hover:bg-muted transition-colors"
          >
            Change password
          </TransitionLink>
          <Button
            variant="outline"
            size="sm"
            className="hidden md:inline-flex min-h-11"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden min-h-11 min-w-11 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls={menuId}
          >
            <Menu className="w-5 h-5 text-foreground" aria-hidden="true" />
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          id={menuId}
          ref={menuPanelRef}
          className="md:hidden border-t border-border px-4 py-3 space-y-1 bg-card"
        >
          {NAV.map((item) => (
            <TransitionLink
              key={item.href}
              href={item.href}
              transition="none"
              className="block px-2 py-2 min-h-11 rounded-md text-sm font-medium text-foreground hover:bg-muted"
              onClick={() => setMobileMenuOpen(false)}
            >
              {item.label}
            </TransitionLink>
          ))}
          <ThemeToggle showLabel className="md:hidden" />
          <TransitionLink
            href="/settings/password"
            transition="none"
            className="block px-2 py-2 min-h-11 rounded-md text-sm font-medium text-foreground hover:bg-muted"
            onClick={() => setMobileMenuOpen(false)}
          >
            Change password
          </TransitionLink>
          <button
            type="button"
            className="block w-full text-left px-2 py-2 min-h-11 rounded-md text-sm font-medium text-foreground hover:bg-muted"
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

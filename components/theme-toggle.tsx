'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
  showLabel?: boolean
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function ThemeToggle({ className, showLabel = false }: Props) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === 'dark'

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    const next = isDark ? 'light' : 'dark'
    const reduceMotion = prefersReducedMotion()

    const apply = () => {
      flushSync(() => {
        setTheme(next)
      })
    }

    if (
      reduceMotion ||
      typeof document === 'undefined' ||
      !('startViewTransition' in document)
    ) {
      apply()
      return
    }

    const x = event.clientX
    const y = event.clientY
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    const root = document.documentElement
    root.classList.add('theme-transitioning')

    const transition = (
      document as Document & {
        startViewTransition: (cb: () => void) => {
          ready: Promise<void>
          finished: Promise<void>
        }
      }
    ).startViewTransition(apply)

    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 480,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-new(root)',
          }
        )
      })
      .catch(() => {})

    transition.finished.finally(() => {
      root.classList.remove('theme-transitioning')
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 min-h-11 min-w-11 rounded-md text-sm font-medium text-foreground/80 hover:text-primary hover:bg-muted transition-colors',
        showLabel && 'w-full justify-start px-2',
        className
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={mounted ? isDark : undefined}
    >
      <span className="relative size-5 shrink-0">
        <Sun
          className={cn(
            'absolute inset-0 size-5 transition-all duration-300',
            isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
          )}
          aria-hidden="true"
        />
        <Moon
          className={cn(
            'absolute inset-0 size-5 transition-all duration-300',
            isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
          )}
          aria-hidden="true"
        />
      </span>
      {showLabel && <span>{isDark ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  )
}

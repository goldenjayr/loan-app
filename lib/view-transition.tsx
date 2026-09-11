'use client'

/**
 * View Transition helpers. Next.js bundles React canary with ViewTransition /
 * addTransitionType even when @types/react doesn't declare them yet.
 */
import * as React from 'react'
import type { ReactNode } from 'react'

type VTProps = {
  children?: ReactNode
  name?: string
  default?: unknown
  enter?: unknown
  exit?: unknown
  share?: unknown
}

const ReactAny = React as any

export const ViewTransition = (ReactAny.ViewTransition ||
  function Fallback({ children }: { children?: ReactNode }) {
    return children
  }) as (props: VTProps) => React.ReactElement | null

export function addTransitionType(type: string) {
  if (typeof ReactAny.addTransitionType === 'function') {
    ReactAny.addTransitionType(type)
  }
}

/** Hierarchical list → detail / detail → list transitions. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'fade-in' }}
      exit={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'fade-out' }}
      default="none"
    >
      {children}
    </ViewTransition>
  )
}

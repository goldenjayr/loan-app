'use client'

/**
 * View Transition helpers.
 * React's experimental <ViewTransition> has crashed Chromium in production
 * when combined with Next navigations, so we keep a safe no-op wrapper and
 * only use addTransitionType when the runtime supports it without mounting VT trees.
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

/** Stable no-op: avoids Chromium tab crashes from experimental ViewTransition. */
export function ViewTransition({ children }: VTProps) {
  return <>{children}</>
}

export function addTransitionType(type: string) {
  // Intentionally no-op for now — pairing with experimental VT crashed tabs.
  void type
  void ReactAny.addTransitionType
}

/** Hierarchical list → detail / detail → list transitions (CSS-only stagger remains). */
export function PageTransition({ children }: { children: ReactNode }) {
  return <>{children}</>
}

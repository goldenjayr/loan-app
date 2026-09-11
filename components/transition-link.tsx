'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startTransition, type ComponentProps, type MouseEvent } from 'react'
import { addTransitionType } from '@/lib/view-transition'

type Props = ComponentProps<typeof Link> & {
  /** Hierarchical direction for view transitions */
  transition?: 'forward' | 'back' | 'none'
}

/**
 * Link that tags navigation direction so page ViewTransitions can slide.
 */
export function TransitionLink({ transition = 'forward', onClick, href, ...rest }: Props) {
  const router = useRouter()

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e)
    if (e.defaultPrevented) return
    if (transition === 'none') return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    if (typeof href !== 'string') return

    e.preventDefault()
    startTransition(() => {
      addTransitionType(transition === 'back' ? 'nav-back' : 'nav-forward')
      router.push(href)
    })
  }

  return <Link href={href} onClick={handleClick} prefetch {...rest} />
}

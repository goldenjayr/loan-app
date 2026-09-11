'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Copy, Link2, Loader2, RefreshCw, Ban } from 'lucide-react'
import { toast } from 'sonner'

type ShareState = {
  active: boolean
  url: string | null
  token: string | null
}

export function LoanShareControls({ loanId }: { loanId: string }) {
  const [share, setShare] = useState<ShareState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch(`/api/loans/${loanId}/share`)
      if (!res.ok) throw new Error('Failed to load share link')
      const data = await res.json()
      setShare({ active: !!data.active, url: data.url ?? null, token: data.token ?? null })
    } catch {
      toast.error('Could not load share link')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanId])

  async function createOrRotate() {
    setBusy(true)
    try {
      const res = await fetch(`/api/loans/${loanId}/share`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setShare({ active: true, url: data.url, token: data.token })
      if (data.url && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(data.url)
        toast.success('Share link created and copied')
      } else {
        toast.success('Share link created')
      }
    } catch {
      toast.error('Failed to create share link')
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!share?.url) return
    try {
      await navigator.clipboard.writeText(share.url)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy — select the link manually')
    }
  }

  async function revoke() {
    setBusy(true)
    try {
      const res = await fetch(`/api/loans/${loanId}/share`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed')
      setShare({ active: false, url: null, token: null })
      toast.success('Share link revoked')
    } catch {
      toast.error('Failed to revoke share link')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
          <Link2 className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="font-semibold text-foreground">Share with borrower</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Read-only page with statement and PDF. No login required. Revoke anytime.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading…
            </div>
          ) : share?.active && share.url ? (
            <>
              <p className="text-xs sm:text-sm font-mono break-all rounded-md bg-muted px-3 py-2 text-foreground">
                {share.url}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="min-h-11 gap-2" onClick={copy} disabled={busy}>
                  <Copy className="size-4" aria-hidden="true" /> Copy link
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 gap-2"
                  onClick={createOrRotate}
                  disabled={busy}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" aria-hidden="true" />}
                  New link
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 gap-2 text-destructive border-destructive/40 hover:bg-destructive hover:text-white"
                  onClick={revoke}
                  disabled={busy}
                >
                  <Ban className="size-4" aria-hidden="true" /> Revoke
                </Button>
              </div>
            </>
          ) : (
            <Button type="button" className="min-h-11 gap-2" onClick={createOrRotate} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" aria-hidden="true" />}
              Create &amp; copy share link
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

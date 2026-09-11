import { Suspense } from 'react'
import { loadSharedLoanDetail } from '@/lib/data'
import ShareLoanClient from './share-loan-client'
import { Card } from '@/components/ui/card'
import { ShareLoadingScreen } from './share-loading-screen'

export const dynamic = 'force-dynamic'

async function ShareLoanContent({ token }: { token: string }) {
  const detail = await loadSharedLoanDetail(token)

  if (!detail) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-background">
        <Card className="p-8 max-w-md text-center space-y-2">
          <h1 className="text-xl font-bold text-foreground">Link unavailable</h1>
          <p className="text-sm text-muted-foreground">
            This share link was revoked or does not exist. Ask your lender for a new link.
          </p>
        </Card>
      </div>
    )
  }

  return <ShareLoanClient token={token} loan={detail.loan} summary={detail.summary} />
}

export default async function ShareLoanPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <Suspense fallback={<ShareLoadingScreen />}>
      <ShareLoanContent token={token} />
    </Suspense>
  )
}

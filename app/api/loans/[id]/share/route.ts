import { requireUser } from '@/lib/auth'
import {
  createOrRotateShareLink,
  getActiveShareLink,
  revokeShareLink,
  shareUrlForToken,
} from '@/lib/share-links'
import { getLoan } from '@/lib/data'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function originFromRequest(request: NextRequest) {
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  if (host) return `${proto}://${host}`
  return process.env.NEXT_PUBLIC_APP_URL || ''
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser()
  if (errorResponse) return errorResponse

  const loanId = Number((await params).id)
  if (!Number.isInteger(loanId) || loanId <= 0) {
    return NextResponse.json({ error: 'Invalid loan ID' }, { status: 400 })
  }

  const loan = await getLoan(loanId)
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })

  const link = await getActiveShareLink(loanId)
  if (!link) {
    return NextResponse.json({ active: false, url: null, token: null })
  }

  return NextResponse.json({
    active: true,
    token: link.token,
    url: shareUrlForToken(link.token, originFromRequest(request)),
    createdAt: link.created_at,
    createdBy: link.created_by,
  })
}

/** Create or rotate share link */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser()
  if (errorResponse) return errorResponse

  const loanId = Number((await params).id)
  if (!Number.isInteger(loanId) || loanId <= 0) {
    return NextResponse.json({ error: 'Invalid loan ID' }, { status: 400 })
  }

  const loan = await getLoan(loanId)
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })

  const link = await createOrRotateShareLink(loanId, user?.email ?? null)
  return NextResponse.json({
    active: true,
    token: link.token,
    url: shareUrlForToken(link.token, originFromRequest(request)),
    createdAt: link.created_at,
  })
}

/** Revoke active share link */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireUser()
  if (errorResponse) return errorResponse

  const loanId = Number((await params).id)
  if (!Number.isInteger(loanId) || loanId <= 0) {
    return NextResponse.json({ error: 'Invalid loan ID' }, { status: 400 })
  }

  const revoked = await revokeShareLink(loanId)
  return NextResponse.json({ active: false, revoked })
}

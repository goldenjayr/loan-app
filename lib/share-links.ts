import { randomBytes } from 'crypto'
import { sql } from '@/lib/db'

export type ShareLinkRow = {
  id: number
  loan_id: number
  token: string
  created_at: string | Date
  revoked_at: string | Date | null
  created_by: string | null
}

export function generateShareToken(): string {
  return randomBytes(24).toString('base64url')
}

export async function getActiveShareLink(loanId: number): Promise<ShareLinkRow | null> {
  const [row] = await sql`
    SELECT id, loan_id, token, created_at, revoked_at, created_by
    FROM loan_share_links
    WHERE loan_id = ${loanId} AND revoked_at IS NULL
    LIMIT 1
  `
  return (row as ShareLinkRow) ?? null
}

export async function resolveShareToken(token: string): Promise<ShareLinkRow | null> {
  if (!token || token.length < 16) return null
  const [row] = await sql`
    SELECT id, loan_id, token, created_at, revoked_at, created_by
    FROM loan_share_links
    WHERE token = ${token} AND revoked_at IS NULL
    LIMIT 1
  `
  return (row as ShareLinkRow) ?? null
}

/** Revoke any active link, then create a new one. Returns the active link. */
export async function createOrRotateShareLink(
  loanId: number,
  createdBy?: string | null
): Promise<ShareLinkRow> {
  await sql`
    UPDATE loan_share_links
    SET revoked_at = NOW()
    WHERE loan_id = ${loanId} AND revoked_at IS NULL
  `

  const token = generateShareToken()
  const [row] = await sql`
    INSERT INTO loan_share_links (loan_id, token, created_by)
    VALUES (${loanId}, ${token}, ${createdBy || null})
    RETURNING id, loan_id, token, created_at, revoked_at, created_by
  `
  return row as ShareLinkRow
}

export async function revokeShareLink(loanId: number): Promise<boolean> {
  const result = await sql`
    UPDATE loan_share_links
    SET revoked_at = NOW()
    WHERE loan_id = ${loanId} AND revoked_at IS NULL
    RETURNING id
  `
  return result.length > 0
}

export function shareUrlForToken(token: string, origin?: string): string {
  const base = origin || process.env.NEXT_PUBLIC_APP_URL || ''
  const path = `/share/${token}`
  return base ? `${base.replace(/\/$/, '')}${path}` : path
}

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { buildLoanReportData, renderLoanReportPdf } = vi.hoisted(() => ({
  buildLoanReportData: vi.fn(),
  renderLoanReportPdf: vi.fn(),
}))

vi.mock('@/lib/loan-report/data', () => ({
  buildLoanReportData,
  slugifyBorrowerName: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
  LoanReportNotFoundError: class LoanReportNotFoundError extends Error {},
}))

vi.mock('@/lib/loan-report/pdf', () => ({ renderLoanReportPdf }))

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => ({ user: { id: 'admin' }, errorResponse: null })),
}))

import { LoanReportNotFoundError } from '@/lib/loan-report/data'
import { GET } from './route'

const request = new NextRequest('http://localhost/api/loans/3/report')

describe('loan report route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    buildLoanReportData.mockResolvedValue({
      borrower: { firstName: 'Julie Ann', lastName: 'Campugan' },
    })
    renderLoanReportPdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70, 45]))
  })

  it('returns a no-store PDF attachment with a borrower filename', async () => {
    const response = await GET(request, { params: Promise.resolve({ id: '3' }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="loan-3-julie-ann-campugan-report.pdf"'
    )
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('rejects an invalid loan id', async () => {
    const response = await GET(request, { params: Promise.resolve({ id: 'invalid' }) })
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid loan ID' })
  })

  it('returns 404 when the loan does not exist', async () => {
    buildLoanReportData.mockImplementation(() => { throw new LoanReportNotFoundError(99) })
    const response = await GET(request, { params: Promise.resolve({ id: '99' }) })
    expect(response.status).toBe(404)
  })

  it('returns a safe 500 response when rendering fails', async () => {
    renderLoanReportPdf.mockRejectedValue(new Error('render failed'))
    const response = await GET(request, { params: Promise.resolve({ id: '3' }) })
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({ error: 'Failed to export PDF' })
  })
})

import { describe, expect, it, vi } from 'vitest'
import { downloadLoanReport } from './download-report'

describe('downloadLoanReport', () => {
  it('downloads the PDF using the server filename and revokes the object URL', async () => {
    const click = vi.fn()
    const anchor = { href: '', download: '', click }
    const createObjectURL = vi.fn(() => 'blob:loan-report')
    const revokeObjectURL = vi.fn()
    const fetcher = vi.fn(async () => new Response(new Blob(['%PDF-1.7']), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="loan-3-julie-ann-campugan-report.pdf"',
      },
    }))

    await downloadLoanReport('3', {
      fetcher,
      createAnchor: () => anchor,
      createObjectURL,
      revokeObjectURL,
    })

    expect(fetcher).toHaveBeenCalledWith('/api/loans/3/report')
    expect(anchor).toMatchObject({
      href: 'blob:loan-report',
      download: 'loan-3-julie-ann-campugan-report.pdf',
    })
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:loan-report')
  })

  it('surfaces the server error and does not create a download', async () => {
    const createObjectURL = vi.fn()
    const fetcher = vi.fn(async () => new Response(
      JSON.stringify({ error: 'Loan not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    ))

    await expect(downloadLoanReport('99', {
      fetcher,
      createAnchor: vi.fn(),
      createObjectURL,
      revokeObjectURL: vi.fn(),
    })).rejects.toThrow('Loan not found')

    expect(createObjectURL).not.toHaveBeenCalled()
  })
})

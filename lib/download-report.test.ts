import { describe, expect, it, vi } from 'vitest'
import { downloadLoanReport } from './download-report'

describe('downloadLoanReport', () => {
  it('uses a browser-native link to the report endpoint', () => {
    const click = vi.fn()
    const anchor = { href: '', download: '', click }
    const appendAnchor = vi.fn()
    const removeAnchor = vi.fn()

    downloadLoanReport('3', {
      createAnchor: () => anchor,
      appendAnchor,
      removeAnchor,
    })

    expect(anchor).toMatchObject({
      href: '/api/loans/3/report',
      download: 'loan-3-report.pdf',
    })
    expect(appendAnchor).toHaveBeenCalledWith(anchor)
    expect(click).toHaveBeenCalledOnce()
    expect(removeAnchor).toHaveBeenCalledWith(anchor)
  })
})

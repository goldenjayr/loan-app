import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { buildLoanReportData } from './data'
import { renderLoanReportPdf } from './pdf'

describe('loan PDF renderer', () => {
  it('creates a readable multi-page A4 PDF from current account data', async () => {
    const report = buildLoanReportData(3, new Date('2026-07-15T00:00:00+08:00'))
    const bytes = await renderLoanReportPdf(report)

    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-')
    expect(bytes.byteLength).toBeGreaterThan(5_000)

    const document = await PDFDocument.load(bytes)
    expect(document.getPageCount()).toBeGreaterThanOrEqual(3)
    for (const page of document.getPages()) {
      expect(page.getWidth()).toBeCloseTo(595.28, 1)
      expect(page.getHeight()).toBeCloseTo(841.89, 1)
    }
  })
})

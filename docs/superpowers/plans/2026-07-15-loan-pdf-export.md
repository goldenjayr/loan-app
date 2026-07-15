# Loan PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click `Export PDF` button to every loan detail page that downloads a polished, current account report.

**Architecture:** A server-only report module maps existing loan-service data into a typed report model and renders it with `pdf-lib`. A Next.js route loads fresh account data and returns the PDF as an attachment. A small client helper owns blob download behavior while the existing loan page owns loading and toast feedback.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, better-sqlite3, pdf-lib, Vitest, existing shadcn `Button`, Lucide icons, Sonner.

## Global Constraints

- Preserve existing uncommitted changes in `app/loans/[id]/page.tsx` and `lib/loan-service.ts`.
- The filename is `loan-{id}-{borrower-slug}-report.pdf`.
- The response is `application/pdf`, `attachment`, and `Cache-Control: no-store`.
- The report contains account overview, full interest timeline, payment allocation, financial summary, reconciliation, headers, footers, and page numbers.
- Use the existing button primitive with a visible label, `aria-busy`, disabled loading state, and a spinner.
- Follow red-green-refactor for every production change.

---

### Task 1: Test Harness and Report Data Model

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `vitest.config.ts`
- Create: `lib/loan-report/types.ts`
- Create: `lib/loan-report/data.ts`
- Test: `lib/loan-report/data.test.ts`

**Interfaces:**
- Consumes: `getLoanSummary(loanId: number)` and the existing SQLite loan/borrower query.
- Produces: `buildLoanReportData(loanId: number): LoanReportData` and `slugifyBorrowerName(name: string): string`.

- [ ] **Step 1: Install test and PDF dependencies**

Run: `pnpm add pdf-lib && pnpm add -D vitest`

Add scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Add Vitest configuration**

```ts
import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node' },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
```

- [ ] **Step 3: Write failing data-mapping tests**

Test `slugifyBorrowerName('Julie Ann Campugan') === 'julie-ann-campugan'` and mock the database/service boundaries to assert that `buildLoanReportData(3)` exposes borrower, loan terms, statement timeline, payment breakdown, and the filename components without recomputing balances.

Run: `pnpm test lib/loan-report/data.test.ts`

Expected: FAIL because `lib/loan-report/data.ts` does not exist.

- [ ] **Step 4: Add exact report types**

Define `LoanReportData` with `loanId`, `borrower`, `status`, `terms`, `summary`, `statement`, `payments`, and `generatedAt`. Timeline and payment rows must retain all numbers from `getLoanSummary` rather than formatted strings.

- [ ] **Step 5: Implement the minimal mapper**

Query the joined loan and borrower row using `getDb()`, throw `LoanReportNotFoundError` when absent, call `getLoanSummary(loanId)`, and return the typed model. Export the error class so the route can distinguish 404 from generation failure.

- [ ] **Step 6: Verify the mapper tests pass**

Run: `pnpm test lib/loan-report/data.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the task**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts lib/loan-report
git commit -m "test: add loan report data model"
```

---

### Task 2: Server-Side PDF Renderer

**Files:**
- Create: `lib/loan-report/pdf.ts`
- Test: `lib/loan-report/pdf.test.ts`

**Interfaces:**
- Consumes: `LoanReportData` from Task 1.
- Produces: `renderLoanReportPdf(data: LoanReportData): Promise<Uint8Array>`.

- [ ] **Step 1: Write a failing PDF contract test**

Use a complete fixed `LoanReportData` fixture and assert:

```ts
const bytes = await renderLoanReportPdf(fixture)
expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe('%PDF-')
expect(bytes.byteLength).toBeGreaterThan(5_000)
```

Load the bytes with `PDFDocument.load(bytes)` and assert the document has at least three pages with A4 dimensions.

Run: `pnpm test lib/loan-report/pdf.test.ts`

Expected: FAIL because `renderLoanReportPdf` is missing.

- [ ] **Step 2: Implement shared drawing primitives**

In `pdf.ts`, create private helpers for A4 pages, text wrapping, cells, tables, page headers, page footers, peso/date formatting, and overflow page creation. Use built-in Helvetica fonts so no external font file is required. Represent the peso sign as `PHP` in the PDF if the built-in font cannot encode `₱`.

- [ ] **Step 3: Render account overview**

Draw borrower identity, active/overdue status, four headline metrics, due-now alert, three repayment options, and the full loan-terms table. Use fixed semantic colors matching the approved navy/indigo/red/green palette.

- [ ] **Step 4: Render the complete interest statement**

Iterate over `data.statement.timeline`, render payment and interest rows with status, opening/allocation values, charged/paid values, and remaining balance/due. Use repeating table headers and create overflow pages before a row crosses the footer margin.

- [ ] **Step 5: Render payment allocation and reconciliation**

Render every payment row, totals to penalties/interest/principal, financial summary, principal-cleared percentage, and payoff equation. Add source timestamp, stable footers, and page numbers to all pages.

- [ ] **Step 6: Verify PDF tests pass**

Run: `pnpm test lib/loan-report/pdf.test.ts`

Expected: PASS with a loadable PDF and no thrown font/layout errors.

- [ ] **Step 7: Commit the task**

```bash
git add lib/loan-report/pdf.ts lib/loan-report/pdf.test.ts
git commit -m "feat: render polished loan PDF reports"
```

---

### Task 3: PDF Download API Route

**Files:**
- Create: `app/api/loans/[id]/report/route.ts`
- Test: `app/api/loans/[id]/report/route.test.ts`

**Interfaces:**
- Consumes: `buildLoanReportData`, `LoanReportNotFoundError`, `slugifyBorrowerName`, and `renderLoanReportPdf`.
- Produces: `GET(request, { params })` returning a PDF attachment or JSON error.

- [ ] **Step 1: Write failing route tests**

Mock report data and renderer boundaries and assert:

```ts
expect(response.status).toBe(200)
expect(response.headers.get('content-type')).toBe('application/pdf')
expect(response.headers.get('content-disposition')).toContain(
  'attachment; filename="loan-3-julie-ann-campugan-report.pdf"'
)
expect(response.headers.get('cache-control')).toBe('no-store')
```

Add cases for invalid ID (`400`), `LoanReportNotFoundError` (`404`), and an unexpected renderer error (`500`).

Run: `pnpm test 'app/api/loans/[id]/report/route.test.ts'`

Expected: FAIL because the route is missing.

- [ ] **Step 2: Implement the route**

```ts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const loanId = Number(id)
  if (!Number.isInteger(loanId) || loanId <= 0) {
    return NextResponse.json({ error: 'Invalid loan ID' }, { status: 400 })
  }
  try {
    const data = buildLoanReportData(loanId)
    const bytes = await renderLoanReportPdf(data)
    const borrower = slugifyBorrowerName(`${data.borrower.firstName} ${data.borrower.lastName}`)
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="loan-${loanId}-${borrower}-report.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    if (error instanceof LoanReportNotFoundError) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    }
    console.error('Error exporting loan report:', error)
    return NextResponse.json({ error: 'Failed to export PDF' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify route tests pass**

Run: `pnpm test 'app/api/loans/[id]/report/route.test.ts'`

Expected: PASS for all four response paths.

- [ ] **Step 4: Commit the task**

```bash
git add 'app/api/loans/[id]/report/route.ts' 'app/api/loans/[id]/report/route.test.ts'
git commit -m "feat: add loan PDF report endpoint"
```

---

### Task 4: One-Click Export Button

**Files:**
- Create: `lib/download-report.ts`
- Test: `lib/download-report.test.ts`
- Modify: `app/loans/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /api/loans/${loanId}/report`.
- Produces: `downloadLoanReport(loanId: string): Promise<void>` and the visible `Export PDF` action.

- [ ] **Step 1: Write failing download-helper tests**

Mock `fetch`, `URL.createObjectURL`, `URL.revokeObjectURL`, and a temporary anchor. Assert a successful request downloads the response blob using the `Content-Disposition` filename and always revokes the object URL. Assert a non-OK JSON response rejects with its `error` value.

Run: `pnpm test lib/download-report.test.ts`

Expected: FAIL because the helper is missing.

- [ ] **Step 2: Implement the download helper**

```ts
export async function downloadLoanReport(loanId: string) {
  const response = await fetch(`/api/loans/${loanId}/report`)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error || 'Failed to export PDF')
  }
  const disposition = response.headers.get('content-disposition') || ''
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `loan-${loanId}-report.pdf`
  const url = URL.createObjectURL(await response.blob())
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
```

- [ ] **Step 3: Verify helper tests pass**

Run: `pnpm test lib/download-report.test.ts`

Expected: PASS.

- [ ] **Step 4: Add the button without disturbing current page changes**

Add `Download` and `Loader2` imports, an `exporting` state, and:

```ts
const handleExport = async () => {
  setExporting(true)
  try {
    await downloadLoanReport(loanId)
    toast.success('PDF report downloaded')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to export PDF')
  } finally {
    setExporting(false)
  }
}
```

Place this existing-primitive control before the edit icon:

```tsx
<Button
  variant="outline"
  onClick={handleExport}
  disabled={exporting}
  aria-busy={exporting}
  className="shadow-none"
>
  {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
  {exporting ? 'Exporting...' : 'Export PDF'}
</Button>
```

- [ ] **Step 5: Run focused and full tests**

Run: `pnpm test lib/download-report.test.ts`

Expected: PASS.

Run: `pnpm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit the task**

```bash
git add lib/download-report.ts lib/download-report.test.ts 'app/loans/[id]/page.tsx'
git commit -m "feat: add one-click loan PDF export"
```

---

### Task 5: End-to-End Verification

**Files:**
- Modify only if verification reveals a defect in files from Tasks 1-4.

**Interfaces:**
- Consumes: completed endpoint and button.
- Produces: verified browser download and visually inspected PDF.

- [ ] **Step 1: Run static checks**

Run: `pnpm lint`

Expected: exit 0 with no new lint errors.

Run: `pnpm exec tsc --noEmit --incremental false`

Expected: exit 0 with no type errors.

- [ ] **Step 2: Run the production build**

Run: `pnpm build`

Expected: exit 0 and the report route appears in the route list.

- [ ] **Step 3: Verify the browser interaction**

Open `http://localhost:3003/loans/3`, confirm `Export PDF` is visible and keyboard-focusable, click it once, verify the button becomes disabled with `Exporting...`, and verify exactly one PDF downloads with the expected filename.

- [ ] **Step 4: Verify the downloaded PDF**

Run `pdfinfo` and confirm a valid multi-page A4 PDF. Render every page with `pdftoppm -png`, inspect the PNGs, and confirm no clipped text, overlapping rows, unreadable headers, missing sections, or footer defects.

- [ ] **Step 5: Reconcile report values**

Compare the downloaded report to the visible loan page for borrower identity, `₱87,850.00` outstanding principal, `₱2,906.50` accrued interest, `₱90,756.50` payoff, four payments totaling `₱20,000.00`, and the complete interest timeline.

- [ ] **Step 6: Commit verification fixes if required**

If verification required code changes, rerun the failing check and all tests, then commit only those fixes with `fix: correct loan PDF export verification defects`.

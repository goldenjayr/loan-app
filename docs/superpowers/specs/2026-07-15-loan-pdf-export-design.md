# Loan PDF Export Design

## Goal

Add a one-click PDF export to each loan detail page. The downloaded document must present the current loan account in the polished report format approved for loan #3, using live data rather than a page screenshot.

## User Experience

- Place a labeled `Export PDF` button beside the existing edit and delete controls on `/loans/[id]`.
- Clicking the button requests a fresh report for the current loan and downloads it immediately.
- While the report is being prepared, disable the button and show a spinner with `Exporting...`.
- On failure, restore the button and show an error toast beside the existing page feedback system.
- Name the file `loan-{id}-{borrower-slug}-report.pdf`.

## Architecture

### Report endpoint

Add `GET /api/loans/[id]/report`. The endpoint will:

1. Validate the loan ID and return `400` for an invalid ID.
2. Load the current loan, its borrower, payment history, statement, payment allocation, and financial summary through the existing database and loan-service layer.
3. Return `404` when the loan does not exist.
4. Generate the PDF on the server so output is consistent and the browser bundle stays small.
5. Return `application/pdf` with an attachment filename and `no-store` caching so every export reflects current account data.

The report generator will be a separate server-only module with a narrow input model. This keeps layout concerns out of the API route and makes report generation testable without HTTP.

### Report contents

The PDF will contain:

1. Account overview: borrower name and email, status, outstanding principal, accrued interest, payoff amount, next due date, amount needed to become current, repayment options, and loan terms.
2. Interest statement: all payment and interest events, period status, opening balance, allocation, amount charged or paid, remaining due, and explanatory notes.
3. Payment and financial summary: complete payment allocation, totals applied to interest and principal, penalties, payoff reconciliation, and repayment progress.

The design will use the same restrained navy, indigo, red, green, and neutral palette as the approved sample. It will include consistent headers, footers, page numbers, table headers, and Philippine peso formatting.

### Loan page integration

The loan detail page will call the report endpoint with `fetch`, convert the successful response to a blob, and trigger a browser download using the filename supplied by `Content-Disposition`. It will revoke the temporary object URL afterward. Existing uncommitted changes in the loan page and loan service must be preserved.

## Error Handling

- Invalid IDs return a JSON `400` response.
- Missing loans return a JSON `404` response.
- Unexpected generation failures return a JSON `500` response without exposing internal details.
- The client reads an error message when available and otherwise displays `Failed to export PDF`.
- Multiple exports cannot run concurrently from the same button.

## Accessibility and UI Constraints

- Use the existing `Button` component and a Lucide download icon.
- Keep a visible text label; the control will not be icon-only.
- Use `aria-busy` during generation and preserve normal keyboard behavior.
- Use tabular numerals in report-oriented numeric UI where applicable.
- Do not add animation beyond the existing spinner feedback.

## Testing

Follow test-driven development:

- Unit-test the report data mapping and generated PDF signature/content.
- Route-test successful PDF headers and body, invalid IDs, and missing loans.
- Component-test the export button's loading state, successful download, filename handling, and failure toast where the existing test environment supports DOM tests.
- Run the relevant focused tests first, followed by lint, type checking, and a production build.
- Verify the finished flow in the local browser and inspect a downloaded PDF rendering for clipping, overlap, and legibility.

## Out of Scope

- Emailing or storing generated reports.
- Custom date ranges or report templates.
- CSV or DOCX export from the loan detail page.
- Editing the account from inside the report.

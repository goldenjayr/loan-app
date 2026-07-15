import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from 'pdf-lib'
import type { LoanReportData } from './types'

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 44
const CONTENT_WIDTH = A4[0] - MARGIN * 2
const NAVY = rgb(0.09, 0.15, 0.33)
const INDIGO = rgb(0.31, 0.27, 0.9)
const RED = rgb(0.73, 0.11, 0.11)
const RED_BG = rgb(1, 0.95, 0.95)
const GREEN_BG = rgb(0.94, 0.99, 0.96)
const BLUE_BG = rgb(0.93, 0.95, 1)
const LIGHT = rgb(0.97, 0.98, 0.99)
const BORDER = rgb(0.85, 0.88, 0.92)
const GRAY = rgb(0.38, 0.45, 0.56)
const INK = rgb(0.15, 0.22, 0.34)

type Fonts = { regular: PDFFont; bold: PDFFont }

function safe(text: unknown): string {
  return String(text ?? '')
    .replaceAll('₱', 'PHP ')
    .replace(/[–—]/g, '-')
    .replaceAll('→', 'to')
    .replace(/[^ -~]/g, '')
}

function money(value: number): string {
  return `PHP ${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function reportDate(value: string | Date | null | undefined): string {
  if (!value) return 'N/A'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', year: 'numeric', timeZone: 'Asia/Manila',
  }).format(new Date(value))
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safe(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) line = candidate
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function text(
  page: PDFPage, value: unknown, x: number, y: number, font: PDFFont,
  size = 9, color = INK, maxWidth?: number, lineHeight = size * 1.3
): number {
  const lines = maxWidth ? wrap(safe(value), font, size, maxWidth) : [safe(value)]
  lines.forEach((line, index) => page.drawText(line, { x, y: y - index * lineHeight, font, size, color }))
  return y - lines.length * lineHeight
}

function rect(page: PDFPage, x: number, y: number, width: number, height: number, color: ReturnType<typeof rgb>, border = BORDER) {
  page.drawRectangle({ x, y: y - height, width, height, color, borderColor: border, borderWidth: 0.6 })
}

function footer(page: PDFPage, index: number, total: number, fonts: Fonts, generatedAt: Date) {
  page.drawLine({ start: { x: MARGIN, y: 30 }, end: { x: A4[0] - MARGIN, y: 30 }, thickness: 0.5, color: BORDER })
  text(page, `Loan Management System | Generated ${reportDate(generatedAt)}`, MARGIN, 17, fonts.regular, 7, GRAY)
  const label = `Page ${index + 1} of ${total}`
  page.drawText(label, { x: A4[0] - MARGIN - fonts.regular.widthOfTextAtSize(label, 7), y: 17, font: fonts.regular, size: 7, color: GRAY })
}

function title(page: PDFPage, heading: string, subtitle: string, fonts: Fonts) {
  text(page, heading, MARGIN, 790, fonts.bold, 23, NAVY)
  text(page, subtitle, MARGIN, 766, fonts.regular, 10, GRAY)
}

function section(page: PDFPage, label: string, y: number, fonts: Fonts): number {
  text(page, label, MARGIN, y, fonts.bold, 14, NAVY)
  return y - 22
}

function drawCells(
  page: PDFPage, cells: Array<{ label: string; value: string }>, y: number,
  fonts: Fonts, widths?: number[]
): number {
  const rowHeight = 55
  const cellWidths = widths || cells.map(() => CONTENT_WIDTH / cells.length)
  let x = MARGIN
  cells.forEach((cell, index) => {
    rect(page, x, y, cellWidths[index], rowHeight, LIGHT)
    text(page, cell.label.toUpperCase(), x + 10, y - 16, fonts.bold, 7, GRAY, cellWidths[index] - 20)
    text(page, cell.value, x + 10, y - 36, fonts.bold, 13, NAVY, cellWidths[index] - 20)
    x += cellWidths[index]
  })
  return y - rowHeight
}

function table(
  page: PDFPage, headers: string[], rows: string[][], y: number, widths: number[],
  fonts: Fonts, options: { overdueRows?: number[]; totalRow?: number } = {}
): number {
  const headerHeight = 31
  let x = MARGIN
  headers.forEach((header, i) => {
    rect(page, x, y, widths[i], headerHeight, NAVY, NAVY)
    text(page, header, x + 6, y - 19, fonts.regular, 7.4, rgb(1, 1, 1), widths[i] - 12)
    x += widths[i]
  })
  y -= headerHeight
  rows.forEach((row, rowIndex) => {
    const lineCounts = row.map((cell, i) => wrap(cell, fonts.regular, 7.2, widths[i] - 12).length)
    const rowHeight = Math.max(28, Math.max(...lineCounts) * 9 + 12)
    const fill = rowIndex === options.totalRow ? GREEN_BG : options.overdueRows?.includes(rowIndex) ? RED_BG : rgb(1, 1, 1)
    x = MARGIN
    row.forEach((cell, i) => {
      rect(page, x, y, widths[i], rowHeight, fill)
      text(page, cell, x + 6, y - 13, rowIndex === options.totalRow ? fonts.bold : fonts.regular, 7.2, INK, widths[i] - 12, 9)
      x += widths[i]
    })
    y -= rowHeight
  })
  return y
}

export async function renderLoanReportPdf(data: LoanReportData): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  document.setTitle(`Loan ${data.loanId} - ${data.borrower.firstName} ${data.borrower.lastName}`)
  document.setAuthor('Loan Management System')
  document.setCreationDate(data.generatedAt)
  const fonts: Fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  }
  const pages = [document.addPage(A4), document.addPage(A4), document.addPage(A4)]
  pages.forEach((page) => {
    page.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: rgb(1, 1, 1) })
  })
  const statement = data.summary.statement
  const breakdown = data.summary.paymentBreakdown

  // Page 1: account overview.
  const p1 = pages[0]
  title(p1, 'Loan Account Report', `Complete account snapshot - Loan #${data.loanId}`, fonts)
  rect(p1, MARGIN, 735, CONTENT_WIDTH * 0.64, 72, NAVY, NAVY)
  rect(p1, MARGIN + CONTENT_WIDTH * 0.64, 735, CONTENT_WIDTH * 0.36, 72, statement.isOverdue ? RED : INDIGO, statement.isOverdue ? RED : INDIGO)
  text(p1, `${data.borrower.firstName} ${data.borrower.lastName}`.toUpperCase(), MARGIN + 16, 714, fonts.regular, 8, rgb(1, 1, 1))
  text(p1, data.borrower.email || 'No email', MARGIN + 16, 686, fonts.bold, 16, rgb(1, 1, 1))
  text(p1, 'ACCOUNT STATUS', MARGIN + CONTENT_WIDTH * 0.64 + 16, 714, fonts.regular, 8, rgb(1, 1, 1))
  text(p1, statement.isOverdue ? 'ACTIVE - OVERDUE' : data.status.toUpperCase(), MARGIN + CONTENT_WIDTH * 0.64 + 16, 688, fonts.bold, 13, rgb(1, 1, 1), CONTENT_WIDTH * 0.36 - 28)

  let y = drawCells(p1, [
    { label: 'Outstanding principal', value: money(statement.outstandingBalance) },
    { label: 'Accrued interest', value: money(statement.accruedInterest) },
    { label: 'Payoff today', value: money(statement.payoffToday) },
    { label: 'Next due date', value: reportDate(statement.nextDueDate) },
  ], 645, fonts)
  y -= 12
  rect(p1, MARGIN, y, CONTENT_WIDTH, 56, RED_BG, rgb(0.98, 0.55, 0.55))
  text(p1, `Amount due to stay current: ${money(statement.amountDueToStayCurrent)}`, MARGIN + 12, y - 19, fonts.bold, 9, RED)
  text(p1, `Paying this settles unpaid interest and penalties but does not reduce the ${money(statement.outstandingBalance)} principal.`, MARGIN + 12, y - 36, fonts.regular, 8, INK, CONTENT_WIDTH - 24)
  y -= 76
  y = section(p1, 'Payment Options', y, fonts)
  y = table(p1, ['OPTION', 'AMOUNT', 'WHAT IT DOES'], [
    ['Minimum - interest only', `${money(statement.monthlyInterest)} / month`, "Covers this period's interest; principal remains unchanged."],
    ['Recommended installment', `${money(statement.scheduledInstallment)} / month`, `Estimated payment to clear the loan over ${statement.termMonths} months.`],
    ['Pay off in full today', money(statement.payoffToday), 'Clears principal, accrued interest, and penalties.'],
  ], y, [145, 135, 227], fonts)
  y -= 20
  y = section(p1, 'Loan Terms', y, fonts)
  table(p1, ['FIELD', 'VALUE', 'FIELD', 'VALUE'], [
    ['Original loan amount', money(data.terms.originalPrincipal), 'Interest rate', `${data.terms.interestRate}% annual`],
    ['Outstanding balance', money(data.terms.outstandingPrincipal), 'Interest type', data.terms.interestType],
    ['Loan term', `${data.terms.termMonths} months`, 'Payment frequency', data.terms.paymentFrequency],
    ['Disbursement date', reportDate(data.terms.disbursementDate), 'Penalty per day', `${data.terms.penaltyPerDay}%`],
  ], y, [120, 134, 120, 133], fonts)

  // Page 2: complete chronological statement.
  const p2 = pages[1]
  title(p2, 'Interest Statement', `Reducing-balance schedule - ${statement.periods.length} periods`, fonts)
  text(p2, 'Interest is charged on the remaining principal. Paid periods are settled; overdue periods remain outstanding.', MARGIN, 738, fonts.regular, 9, INK, CONTENT_WIDTH)
  const timelineRows = statement.timeline.map((item: any) => item.kind === 'payment'
    ? [reportDate(item.date), 'PAYMENT', `Interest ${money(item.toInterest)} | Principal ${money(item.toPrincipal)}`, `Paid ${money(item.amount)}`, `Balance ${money(item.balanceAfter)}`]
    : [reportDate(item.date), String(item.status).toUpperCase(), `Opening ${money(item.openingBalance)} | ${reportDate(item.periodStart)}-${reportDate(item.date)}`, `Charged ${money(item.interestCharged)} | Paid ${money(item.interestPaid)}`, money(item.interestRemaining)])
  y = table(p2, ['DATE / EVENT', 'STATUS', 'OPENING / ALLOCATION', 'CHARGED / PAID', 'DUE / BALANCE'], timelineRows, 708, [93, 65, 142, 115, 92], fonts, {
    overdueRows: statement.timeline.map((item: any, index: number) => item.status === 'overdue' ? index : -1).filter((index: number) => index >= 0),
  })
  y -= 14
  rect(p2, MARGIN, y, CONTENT_WIDTH, 56, BLUE_BG, rgb(0.58, 0.64, 0.98))
  const consumed = breakdown.items.find((item: any) => item.fullyConsumedByInterest)
  const note = consumed
    ? `Why the ${reportDate(consumed.date)} payment did not reduce principal: accumulated interest consumed the entire ${money(consumed.amount)} payment.`
    : 'Payments are allocated to penalties first, then interest, then principal.'
  text(p2, note, MARGIN + 12, y - 20, fonts.regular, 8.5, INK, CONTENT_WIDTH - 24)

  // Page 3: allocation and financial reconciliation.
  const p3 = pages[2]
  title(p3, 'Payment Allocation', 'How all received payments were applied', fonts)
  const allocationRows = breakdown.items.map((item: any) => [
    reportDate(item.date), money(item.amount), money(item.toPenalty), money(item.toInterest), money(item.toPrincipal), money(item.balanceAfter),
  ])
  allocationRows.push(['TOTAL', money(breakdown.totalPaid), money(breakdown.totalToPenalty), money(breakdown.totalToInterest), money(breakdown.totalToPrincipal), '-'])
  y = table(p3, ['DATE', 'PAID', 'PENALTY', 'INTEREST', 'PRINCIPAL', 'BALANCE AFTER'], allocationRows, 730, [92, 83, 77, 82, 84, 89], fonts, { totalRow: allocationRows.length - 1 })
  y -= 20
  y = section(p3, 'Financial Summary', y, fonts)
  const repaymentProgress = data.terms.originalPrincipal > 0
    ? (data.summary.totalPaid / data.terms.originalPrincipal) * 100
    : 0
  y = table(p3, ['ITEM', 'VALUE', 'DESCRIPTION'], [
    ['Loan principal', money(data.terms.originalPrincipal), 'Amount originally borrowed'],
    ['Amount paid', money(data.summary.totalPaid), 'Total cash received'],
    ['Accrued interest', money(statement.accruedInterest), 'Unpaid interest carried forward'],
    ['Total penalties', money(statement.penalties), 'Late fees, if any'],
    ['Total due / payoff', money(statement.payoffToday), 'Principal + interest + penalties'],
    ['Repayment progress', `${repaymentProgress.toFixed(1)}%`, 'Total payments / original principal'],
  ], y, [142, 128, 237], fonts)
  y -= 18
  rect(p3, MARGIN, y, CONTENT_WIDTH / 2, 72, INDIGO, INDIGO)
  rect(p3, MARGIN + CONTENT_WIDTH / 2, y, CONTENT_WIDTH / 2, 72, INDIGO, INDIGO)
  text(p3, 'ACCOUNT RECONCILIATION', MARGIN + 12, y - 18, fonts.regular, 8, rgb(1, 1, 1))
  text(p3, `${money(data.terms.originalPrincipal)} original - ${money(breakdown.totalToPrincipal)} principal repaid = ${money(statement.outstandingBalance)} outstanding`, MARGIN + 12, y - 38, fonts.regular, 8, rgb(1, 1, 1), CONTENT_WIDTH / 2 - 24)
  text(p3, 'CURRENT POSITION', MARGIN + CONTENT_WIDTH / 2 + 12, y - 18, fonts.regular, 8, rgb(1, 1, 1))
  text(p3, `${money(statement.outstandingBalance)} principal + ${money(statement.accruedInterest)} interest + ${money(statement.penalties)} penalties = ${money(statement.payoffToday)} payoff`, MARGIN + CONTENT_WIDTH / 2 + 12, y - 38, fonts.regular, 8, rgb(1, 1, 1), CONTENT_WIDTH / 2 - 24)

  pages.forEach((page, index) => footer(page, index, pages.length, fonts, data.generatedAt))
  return document.save()
}

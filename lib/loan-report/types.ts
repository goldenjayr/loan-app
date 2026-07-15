export interface LoanReportBorrower {
  firstName: string
  lastName: string
  email: string | null
}

export interface LoanReportTerms {
  originalPrincipal: number
  outstandingPrincipal: number
  interestRate: number
  interestType: string
  termMonths: number
  paymentFrequency: string
  disbursementDate: string
  maturityDate: string
  penaltyPerDay: number
}

export interface LoanReportData {
  loanId: number
  borrower: LoanReportBorrower
  status: string
  terms: LoanReportTerms
  summary: any
  generatedAt: Date
}

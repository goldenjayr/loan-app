import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface LoanSummaryProps {
  loanId: string
  loan: any
  summary: any
}

export default function LoanSummary({ loan, summary }: LoanSummaryProps) {
  if (!summary) return null

  const peso = (n: number) =>
    `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const percentPaid = Math.min(
    100,
    Number(((summary.totalPaid / (summary.loanAmount || 1)) * 100).toFixed(1))
  )

  return (
    <Card className="p-5 sm:p-6 space-y-6 overflow-hidden">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground text-pretty">Financial Summary</h3>
        <Badge variant="outline" className="bg-primary/5 text-primary text-xs uppercase tracking-wider shrink-0">
          Live Status
        </Badge>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-tight mb-1">Loan Principal</p>
            <p className="text-lg sm:text-xl font-bold text-foreground tabular-nums truncate">{peso(summary.loanAmount)}</p>
            <p className="text-[10px] text-muted-foreground opacity-70 mt-0.5">Amount originally borrowed</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-tight mb-1">Amount Paid</p>
            <p className="text-lg sm:text-xl font-bold text-green-600 tabular-nums truncate">{peso(summary.totalPaid)}</p>
            <p className="text-[10px] text-muted-foreground opacity-70 mt-0.5">Total received so far</p>
          </div>
        </div>

        <div className="space-y-3 pb-4 border-b border-border">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Accrued Interest</p>
              <p className="text-[10px] text-muted-foreground opacity-70">
                {summary.calculationNotes?.interestFormula || 'Interest charged but not yet paid'}
              </p>
            </div>
            <p className="font-semibold text-foreground tabular-nums shrink-0">{peso(summary.accruredInterest)}</p>
          </div>
          <div className="flex justify-between items-start gap-3 text-sm">
            <div className="min-w-0">
              <p className="text-muted-foreground">Total Penalties</p>
              <p className="text-[10px] text-muted-foreground opacity-70">Late fees, if any</p>
            </div>
            <p className="font-semibold text-red-600 tabular-nums shrink-0">{peso(summary.penalties)}</p>
          </div>
          <div className="flex justify-between items-start gap-3 pt-1">
            <div className="min-w-0">
              <p className="font-bold text-foreground text-base">Total Due Amount</p>
              <p className="text-[10px] text-muted-foreground opacity-70">
                Full payoff today = balance + interest + penalties
              </p>
            </div>
            <p className="font-bold text-orange-600 text-lg tabular-nums shrink-0">{peso(summary.totalDue)}</p>
          </div>
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-semibold text-foreground">Repayment Progress</p>
              <p className="text-xs text-muted-foreground">{percentPaid}% of principal cleared</p>
            </div>
            <p className="text-lg font-bold text-primary tabular-nums shrink-0">{percentPaid}%</p>
          </div>
          <div
            className="w-full bg-muted rounded-full h-2.5 overflow-hidden shadow-inner"
            role="progressbar"
            aria-valuenow={percentPaid}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Repayment progress"
          >
            <div
              className="bg-gradient-to-r from-primary to-blue-500 h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${percentPaid}%` }}
            />
          </div>
        </div>

        <div className="p-3 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-center justify-between text-xs mb-1 gap-2">
            <span className="text-muted-foreground uppercase font-bold">Standard Term</span>
            <span className="text-foreground font-semibold tabular-nums">
              {summary.loanTermMonths || loan.loan_term_months} Months
            </span>
          </div>
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="text-muted-foreground uppercase font-bold">Rate Type</span>
            <span className="text-foreground font-semibold capitalize">{loan.interest_type}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

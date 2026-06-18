import { Card } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'

interface LoanSummaryProps {
  loanId: string
  loan: any
}

export default function LoanSummary({ loanId, loan }: LoanSummaryProps) {
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch(`/api/loans/${loanId}/summary`)
        if (response.ok) {
          const data = await response.json()
          setSummary(data)
        }
      } catch (error) {
        console.error('Error fetching loan summary:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [loanId])

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground animate-pulse">Calculating summary...</p>
      </Card>
    )
  }

  if (!summary) return null

  const peso = (n: number) =>
    `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const percentPaid = ((summary.totalPaid / (summary.loanAmount || 1)) * 100).toFixed(1)

  return (
    <Card className="p-6 space-y-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Financial Summary</h3>
        <Badge variant="outline" className="bg-primary/5 text-primary text-xs uppercase tracking-wider">
          Live Status
        </Badge>
      </div>

      <div className="space-y-6">
        {/* Principal Overview */}
        <div className="grid grid-cols-2 gap-4 pb-4 border-b border-border">
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-tight mb-1">Loan Principal</p>
            <p className="text-xl font-bold text-foreground">{peso(summary.loanAmount)}</p>
            <p className="text-[10px] text-muted-foreground opacity-70 mt-0.5">Amount originally borrowed</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-tight mb-1">Amount Paid</p>
            <p className="text-xl font-bold text-green-600">{peso(summary.totalPaid)}</p>
            <p className="text-[10px] text-muted-foreground opacity-70 mt-0.5">Total received so far</p>
          </div>
        </div>

        {/* Accruals & Penalties */}
        <div className="space-y-3 pb-4 border-b border-border">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Accrued Interest</p>
                <p className="text-[10px] text-muted-foreground opacity-70">
                  {summary.calculationNotes?.interestFormula || 'Interest charged but not yet paid'}
                </p>
              </div>
              <p className="font-semibold text-foreground">{peso(summary.accruredInterest)}</p>
            </div>
          <div className="flex justify-between items-center text-sm">
            <div>
              <p className="text-muted-foreground">Total Penalties</p>
              <p className="text-[10px] text-muted-foreground opacity-70">Late fees, if any</p>
            </div>
            <p className="font-semibold text-red-600">{peso(summary.penalties)}</p>
          </div>
          <div className="flex justify-between items-center pt-1">
            <div>
              <p className="font-bold text-foreground text-base">Total Due Amount</p>
              <p className="text-[10px] text-muted-foreground opacity-70">Full payoff today = balance + interest + penalties</p>
            </div>
            <p className="font-bold text-orange-600 text-lg">{peso(summary.totalDue)}</p>
          </div>
        </div>

        {/* Repayment Progress */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col">
              <p className="text-sm font-semibold text-foreground">Repayment Progress</p>
              <p className="text-xs text-muted-foreground">{percentPaid}% of principal cleared</p>
            </div>
            <p className="text-lg font-bold text-primary">{percentPaid}%</p>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-primary to-blue-500 h-full transition-all duration-1000 ease-out rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"
              style={{ width: `${percentPaid}%` }}
            ></div>
          </div>
        </div>

        {/* Additional Status Context */}
        <div className="p-3 bg-muted/30 rounded-lg border border-border">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground uppercase font-bold">Standard Term</span>
            <span className="text-foreground font-semibold">{summary.loanTermMonths || loan.loan_term_months} Months</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground uppercase font-bold">Rate Type</span>
            <span className="text-foreground font-semibold capitalize">{loan.interest_type}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

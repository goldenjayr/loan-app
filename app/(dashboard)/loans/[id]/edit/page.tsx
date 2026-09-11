'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function EditLoanPage() {
  const router = useRouter()
  const params = useParams()
  const loanId = params.id as string
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [hasActivity, setHasActivity] = useState(false)
  const [formData, setFormData] = useState({
    loan_amount: '',
    interest_rate: '',
    interest_type: 'simple',
    loan_term_months: '',
    disbursement_date: '',
    payment_frequency: 'monthly',
    penalty_per_day: '0',
    status: 'active',
    notes: '',
  })

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/loans/${loanId}`)
      if (res.ok) {
        const loan = await res.json()
        setFormData({
          loan_amount: String(loan.loan_amount ?? ''),
          // Stored rate is annual; the form edits the monthly rate.
          interest_rate: String((loan.interest_rate ?? 0) / 12),
          interest_type: loan.interest_type || 'simple',
          loan_term_months: String(loan.loan_term_months ?? ''),
          disbursement_date: loan.disbursement_date || '',
          payment_frequency: loan.payment_frequency || 'monthly',
          penalty_per_day: String(loan.penalty_per_day ?? 0),
          status: loan.status || 'active',
          notes: loan.notes || '',
        })

        // Determine whether core financial fields are locked.
        const paymentsRes = await fetch(`/api/payments?loan_id=${loanId}`)
        const payments = paymentsRes.ok ? await paymentsRes.json() : []
        setHasActivity((payments?.length ?? 0) > 0 || loan.balance !== loan.loan_amount)
      } else {
        toast.error('Loan not found')
        router.push('/loans')
      }

      setLoading(false)
    }
    load()
  }, [loanId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    // Only send core financial fields when they are still editable.
    const payload: Record<string, any> = {
      interest_rate: parseFloat(formData.interest_rate) * 12,
      payment_frequency: formData.payment_frequency,
      penalty_per_day: parseFloat(formData.penalty_per_day),
      status: formData.status,
      notes: formData.notes,
    }
    if (!hasActivity) {
      payload.loan_amount = parseFloat(formData.loan_amount)
      payload.interest_type = formData.interest_type
      payload.loan_term_months = parseInt(formData.loan_term_months)
      payload.disbursement_date = formData.disbursement_date
    }

    try {
      const response = await fetch(`/api/loans/${loanId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        toast.success('Loan updated')
        router.push(`/loans/${loanId}`)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update loan')
      }
    } catch (error) {
      console.error('Error updating loan:', error)
      toast.error('Failed to update loan')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" aria-label="Loading" /></div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
        <Link href={`/loans/${loanId}`} className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6 min-h-11">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to Loan
        </Link>

        <Card className="max-w-2xl p-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">Edit Loan</h1>
          {hasActivity && (
            <p className="text-sm text-muted-foreground mb-6">
              This loan already has payments or accrued interest, so its amount, term, disbursement date and
              interest type are locked. You can still update the rate, penalty, frequency, status and notes.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="loan_amount">Loan Amount (₱)</Label>
              <Input
                id="loan_amount"
                type="number"
                name="loan_amount"
                className="min-h-11"
                value={formData.loan_amount}
                onChange={handleChange}
                step="0.01"
                disabled={hasActivity}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="interest_rate">Monthly Interest Rate (%)</Label>
                <Input
                  id="interest_rate"
                  type="number"
                  name="interest_rate"
                  className="min-h-11"
                  value={formData.interest_rate}
                  onChange={handleChange}
                  step="0.01"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interest_type">Interest Type</Label>
                <Select
                  value={formData.interest_type}
                  onValueChange={(value) => handleSelectChange('interest_type', value)}
                  disabled={hasActivity}
                >
                  <SelectTrigger id="interest_type" className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple</SelectItem>
                    <SelectItem value="compound">Compound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loan_term_months">Loan Term (months)</Label>
                <Input
                  id="loan_term_months"
                  type="number"
                  name="loan_term_months"
                  className="min-h-11"
                  value={formData.loan_term_months}
                  onChange={handleChange}
                  disabled={hasActivity}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_frequency">Payment Frequency</Label>
                <Select value={formData.payment_frequency} onValueChange={(value) => handleSelectChange('payment_frequency', value)}>
                  <SelectTrigger id="payment_frequency" className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="disbursement_date">Disbursement Date</Label>
                <Input
                  id="disbursement_date"
                  type="date"
                  name="disbursement_date"
                  className="min-h-11"
                  value={formData.disbursement_date}
                  onChange={handleChange}
                  disabled={hasActivity}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="penalty_per_day">Penalty per Day (%)</Label>
                <Input
                  id="penalty_per_day"
                  type="number"
                  name="penalty_per_day"
                  className="min-h-11"
                  value={formData.penalty_per_day}
                  onChange={handleChange}
                  step="0.01"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleSelectChange('status', value)}>
                <SelectTrigger id="status" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="defaulted">Defaulted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                rows={4}
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6">
              <Button type="submit" disabled={submitting} className="flex-1 gap-2 min-h-11">
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
              <Link href={`/loans/${loanId}`} className="flex-1">
                <Button variant="outline" className="w-full min-h-11" type="button">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </Card>
    </div>
  )
}

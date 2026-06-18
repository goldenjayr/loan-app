'use client'

import { useEffect, useState } from 'react'
import { redirect, useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardHeader from '@/components/dashboard-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const [user, setUser] = useState<any>(null)
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
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        redirect('/auth/login')
      }
      setUser(user)

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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <div className="container mx-auto px-4 py-8">
        <Link href={`/loans/${loanId}`} className="flex items-center gap-2 text-primary hover:text-primary/80 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Loan
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
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Loan Amount (₱)</label>
              <Input
                type="number"
                name="loan_amount"
                value={formData.loan_amount}
                onChange={handleChange}
                step="0.01"
                disabled={hasActivity}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Monthly Interest Rate (%)</label>
                <Input
                  type="number"
                  name="interest_rate"
                  value={formData.interest_rate}
                  onChange={handleChange}
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Interest Type</label>
                <Select
                  value={formData.interest_type}
                  onValueChange={(value) => handleSelectChange('interest_type', value)}
                  disabled={hasActivity}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple</SelectItem>
                    <SelectItem value="compound">Compound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Loan Term (months)</label>
                <Input
                  type="number"
                  name="loan_term_months"
                  value={formData.loan_term_months}
                  onChange={handleChange}
                  disabled={hasActivity}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Payment Frequency</label>
                <Select value={formData.payment_frequency} onValueChange={(value) => handleSelectChange('payment_frequency', value)}>
                  <SelectTrigger>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Disbursement Date</label>
                <Input
                  type="date"
                  name="disbursement_date"
                  value={formData.disbursement_date}
                  onChange={handleChange}
                  disabled={hasActivity}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Penalty per Day (%)</label>
                <Input
                  type="number"
                  name="penalty_per_day"
                  value={formData.penalty_per_day}
                  onChange={handleChange}
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Status</label>
              <Select value={formData.status} onValueChange={(value) => handleSelectChange('status', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="defaulted">Defaulted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Notes (optional)</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                rows={4}
              />
            </div>

            <div className="flex gap-4 pt-6">
              <Button type="submit" disabled={submitting} className="flex-1 gap-2">
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
                <Button variant="outline" className="w-full" type="button">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </main>
  )
}

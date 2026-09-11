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
import { TransitionLink } from '@/components/transition-link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function EditPaymentPage() {
  const router = useRouter()
  const params = useParams()
  const loanId = params.id as string
  const paymentId = params.paymentId as string
  const [loan, setLoan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    amount: '',
    payment_date: '',
    payment_method: 'cash',
    reference_number: '',
    notes: '',
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [loanRes, paymentRes] = await Promise.all([
          fetch(`/api/loans/${loanId}`),
          fetch(`/api/payments/${paymentId}`),
        ])

        if (loanRes.ok) setLoan(await loanRes.json())

        if (paymentRes.ok) {
          const payment = await paymentRes.json()
          setFormData({
            amount: String(payment.amount),
            payment_date: new Date(payment.payment_date).toISOString().split('T')[0],
            payment_method: payment.payment_method || 'cash',
            reference_number: payment.reference_number || '',
            notes: payment.notes || '',
          })
        } else {
          toast.error('Payment not found')
          router.push(`/loans/${loanId}`)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load payment details')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [loanId, paymentId, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const response = await fetch(`/api/payments/${paymentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      })
      if (response.ok) {
        toast.success('Payment updated')
        router.push(`/loans/${loanId}`)
        router.refresh()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update payment')
      }
    } catch (error) {
      console.error('Error updating payment:', error)
      toast.error('Failed to update payment')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" aria-label="Loading" />
      </div>
    )
  }

  if (!loan) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Loan not found</p>
        <TransitionLink href="/loans" transition="back">
          <Button className="mt-4 min-h-11">Back to Loans</Button>
        </TransitionLink>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <TransitionLink
        href={`/loans/${loanId}`}
        transition="back"
        className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6 min-h-11"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to Loan
      </TransitionLink>

      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="p-5 sm:p-8">
          <h1 className="text-2xl font-bold text-foreground mb-2 text-pretty">Edit Payment Record</h1>
          <p className="text-muted-foreground truncate">
            Updating payment for {loan.borrower?.first_name} {loan.borrower?.last_name}
          </p>
        </Card>

        <Card className="p-5 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
            <div className="space-y-2">
              <Label htmlFor="amount">Payment Amount (₱)</Label>
              <Input
                id="amount"
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
                required
                min="0"
                className="min-h-11 tabular-nums"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date</Label>
              <Input
                id="payment_date"
                type="date"
                name="payment_date"
                value={formData.payment_date}
                onChange={handleChange}
                required
                className="min-h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, payment_method: v }))}
              >
                <SelectTrigger id="payment_method" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference_number">Reference Number (optional)</Label>
              <Input
                id="reference_number"
                name="reference_number"
                value={formData.reference_number}
                onChange={handleChange}
                placeholder="Check #, transaction ID…"
                className="min-h-11"
                spellCheck={false}
              />
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <span className="font-semibold">Re-balancing notice:</span> Changing the amount
                recalculates the loan balance and payment distribution.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <TransitionLink href={`/loans/${loanId}`} transition="back" className="flex-1">
                <Button type="button" variant="outline" className="w-full min-h-11">
                  Cancel
                </Button>
              </TransitionLink>
              <Button type="submit" disabled={submitting} className="flex-1 gap-2 min-h-11">
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    Updating…
                  </>
                ) : (
                  'Update Payment'
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}

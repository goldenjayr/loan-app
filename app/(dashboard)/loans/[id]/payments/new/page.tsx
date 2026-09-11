'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
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

export default function NewPaymentPage() {
  const router = useRouter()
  const params = useParams()
  const loanId = params.id as string
  const [loan, setLoan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    payment_amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    reference_number: '',
  })

  useEffect(() => {
    const checkAuth = async () => {

      const response = await fetch('/api/loans')
      if (response.ok) {
        const data = await response.json()
        const selectedLoan = data.find((l: any) => l.id === Number(loanId))
        setLoan(selectedLoan)
      }

      setLoading(false)
    }

    checkAuth()
  }, [loanId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loan_id: Number(loanId),
          payment_amount: parseFloat(formData.payment_amount),
          payment_date: formData.payment_date,
          payment_method: formData.payment_method,
          reference_number: formData.reference_number || null,
        }),
      })

      if (response.ok) {
        router.push(`/loans/${loanId}`)
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error recording payment:', error)
      alert('Failed to record payment')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" aria-label="Loading" /></div>
    )
  }

  if (!loan) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Loan not found</p>
          <Link href="/loans">
            <Button className="mt-4 min-h-11">Back to Loans</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
        <Link href={`/loans/${loanId}`} className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6 min-h-11">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to Loan
        </Link>

        <div className="max-w-2xl">
          <Card className="p-8 mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">Record Payment</h1>
            <p className="text-muted-foreground">
              {loan.borrower?.first_name} {loan.borrower?.last_name}
            </p>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Outstanding Balance</p>
              <p className="text-2xl font-bold text-foreground">₱{loan.balance?.toLocaleString()}</p>
            </div>
          </Card>

          <Card className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="payment_amount">Payment Amount (₱)</Label>
                <Input
                  id="payment_amount"
                  type="number"
                  name="payment_amount"
                  className="min-h-11"
                  value={formData.payment_amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  required
                  min="0"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Maximum amount available: ₱{loan.balance?.toLocaleString()}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_date">Payment Date</Label>
                <Input
                  id="payment_date"
                  type="date"
                  name="payment_date"
                  className="min-h-11"
                  value={formData.payment_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method">Payment Method</Label>
                <Select value={formData.payment_method} onValueChange={(value) => handleSelectChange('payment_method', value)}>
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
                  type="text"
                  name="reference_number"
                  className="min-h-11"
                  value={formData.reference_number}
                  onChange={handleChange}
                  placeholder="Check #, Transaction ID, etc."
                />
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <span className="font-semibold">Payment Allocation:</span> Payments are automatically allocated to penalties first, then interest accruals, then principal balance.
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 gap-2 min-h-11"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Recording...
                    </>
                  ) : (
                    'Record Payment'
                  )}
                </Button>
                <Link href={`/loans/${loanId}`} className="flex-1">
                  <Button variant="outline" className="w-full min-h-11">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </Card>
        </div>
    </div>
  )
}

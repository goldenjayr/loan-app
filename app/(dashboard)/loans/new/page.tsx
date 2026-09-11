'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function NewLoanPage() {
  const router = useRouter()
  const [borrowers, setBorrowers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    borrower_id: '',
    loan_amount: '',
    interest_rate: '',
    interest_type: 'simple',
    loan_term_months: '',
    disbursement_date: new Date().toISOString().split('T')[0],
    payment_frequency: 'monthly',
    penalty_per_day: '0',
    description: '',
  })

  useEffect(() => {
    const checkAuth = async () => {

      const response = await fetch('/api/borrowers')
      if (response.ok) {
        const data = await response.json()
        setBorrowers(data)
      }

      setLoading(false)
    }

    checkAuth()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
      const response = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          loan_amount: parseFloat(formData.loan_amount),
          interest_rate: parseFloat(formData.interest_rate) * 12,
          loan_term_months: parseInt(formData.loan_term_months),
          penalty_per_day: parseFloat(formData.penalty_per_day),
        }),
      })

      if (response.ok) {
        const newLoan = await response.json()
        router.push(`/loans/${newLoan.id}`)
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating loan:', error)
      alert('Failed to create loan')
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
        <Link href="/loans" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6 min-h-11">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to Loans
        </Link>

        <Card className="max-w-2xl p-8">
          <h1 className="text-2xl font-bold text-foreground mb-6">Create New Loan</h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="borrower_id">Borrower</Label>
              <Select value={formData.borrower_id} onValueChange={(value) => handleSelectChange('borrower_id', value)}>
                <SelectTrigger id="borrower_id" className="min-h-11">
                  <SelectValue placeholder="Select a borrower" />
                </SelectTrigger>
                <SelectContent>
                  {borrowers.map(borrower => (
                    <SelectItem key={borrower.id} value={String(borrower.id)}>
                      {borrower.first_name} {borrower.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="loan_amount">Loan Amount (₱)</Label>
              <Input
                id="loan_amount"
                type="number"
                name="loan_amount"
                className="min-h-11"
                value={formData.loan_amount}
                onChange={handleChange}
                placeholder="0.00"
                step="0.01"
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
                  placeholder="0.00"
                  step="0.01"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="interest_type">Interest Type</Label>
                <Select value={formData.interest_type} onValueChange={(value) => handleSelectChange('interest_type', value)}>
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
                  placeholder="0"
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
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Add any notes about this loan..."
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                rows={4}
              />
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
                    Creating...
                  </>
                ) : (
                  'Create Loan'
                )}
              </Button>
              <Link href="/loans" className="flex-1">
                <Button variant="outline" className="w-full min-h-11">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </Card>
    </div>
  )
}

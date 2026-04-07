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

export default function EditPaymentPage() {
  const router = useRouter()
  const params = useParams()
  const loanId = params.id as string
  const paymentId = params.paymentId as string
  
  const [user, setUser] = useState<any>(null)
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
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          redirect('/auth/login')
          return
        }
        setUser(user)

        // Fetch loan
        const loanRes = await fetch(`/api/loans`)
        if (loanRes.ok) {
          const loans = await loanRes.json()
          const selectedLoan = loans.find((l: any) => l.id === Number(loanId))
          setLoan(selectedLoan)
        }

        // Fetch payment
        const paymentRes = await fetch(`/api/payments/${paymentId}`)
        if (paymentRes.ok) {
          const payment = await paymentRes.json()
          setFormData({
            amount: payment.amount.toString(),
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
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
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
        toast.success('Payment updated successfully')
        router.push(`/loans/${loanId}`)
        router.refresh()
      } else {
        const error = await response.json()
        toast.error(`Error: ${error.error}`)
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!loan) {
    return (
      <main className="min-h-screen bg-background p-8 text-center">
        <p className="text-muted-foreground">Loan not found</p>
        <Link href="/loans"><Button className="mt-4">Back to Loans</Button></Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <div className="container mx-auto px-4 py-8">
        <Link href={`/loans/${loanId}`} className="flex items-center gap-2 text-primary hover:text-primary/80 mb-6 w-fit">
          <ArrowLeft className="w-4 h-4" /> Back to Loan
        </Link>

        <div className="max-w-2xl mx-auto">
          <Card className="p-8 mb-6">
            <h1 className="text-2xl font-bold text-foreground mb-2">Edit Payment Record</h1>
            <p className="text-muted-foreground">
              Updating payment for {loan.borrower?.first_name} {loan.borrower?.last_name}
            </p>
          </Card>

          <Card className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Payment Amount (₱)</label>
                <Input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  required
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Payment Date</label>
                <Input
                  type="date"
                  name="payment_date"
                  value={formData.payment_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Payment Method</label>
                <Select value={formData.payment_method} onValueChange={(v) => handleSelectChange('payment_method', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Reference Number (optional)</label>
                <Input
                  type="text"
                  name="reference_number"
                  value={formData.reference_number}
                  onChange={handleChange}
                  placeholder="Check #, Transaction ID, etc."
                />
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <span className="font-semibold">Re-balancing Notice:</span> Changing the amount will automatically recalculate the loan balance and historical distribution.
                </p>
              </div>

              <div className="flex gap-4 pt-6">
                <Button type="submit" disabled={submitting} className="flex-1 gap-2">
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</> : 'Update Payment'}
                </Button>
                <Link href={`/loans/${loanId}`} className="flex-1">
                  <Button variant="outline" className="w-full">Cancel</Button>
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </main>
  )
}

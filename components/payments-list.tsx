'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface PaymentsListProps {
  loanId: string
  payments: any[]
}

function PaymentActions({
  loanId,
  paymentId,
  isDeleting,
  onDelete,
}: {
  loanId: string
  paymentId: number
  isDeleting: number | null
  onDelete: (id: number) => void
}) {
  return (
    <div className="flex shrink-0 justify-end">
      <Link href={`/loans/${loanId}/payments/${paymentId}/edit`}>
        <Button
          variant="ghost"
          size="icon"
          className="min-h-11 min-w-11 text-muted-foreground hover:text-blue-600 transition-colors"
          aria-label="Edit payment"
        >
          <Pencil className="w-4 h-4" aria-hidden="true" />
        </Button>
      </Link>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 text-muted-foreground hover:text-red-600 transition-colors"
            aria-label="Delete payment"
          >
            {isDeleting === paymentId ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the payment and recalculates the loan balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(paymentId)} className="bg-red-600 hover:bg-red-700">
              Delete Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function PaymentsList({ loanId, payments }: PaymentsListProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState<number | null>(null)

  const handleDelete = async (paymentId: number) => {
    try {
      setIsDeleting(paymentId)
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete payment')

      toast.success('Payment deleted successfully')
      router.refresh()
    } catch (error) {
      console.error('Error deleting payment:', error)
      toast.error('Failed to delete payment')
    } finally {
      setIsDeleting(null)
    }
  }

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">Payment History</h2>
        <Link href={`/loans/${loanId}/payments/new`} className="w-full sm:w-auto">
          <Button className="gap-2 w-full sm:w-auto min-h-11">
            <Plus className="w-4 h-4" aria-hidden="true" /> Record Payment
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        {payments.length > 0 ? (
          <>
            <div className="space-y-3 md:hidden">
              {payments.map((payment) => (
                <div key={payment.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">
                        {new Date(payment.payment_date).toLocaleDateString('en-PH')}
                      </p>
                      <p className="text-lg font-bold tabular-nums">
                        ₱{Number(payment.amount || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize mt-1 truncate">
                        {payment.payment_method}
                        {payment.reference_number ? ` · ${payment.reference_number}` : ''}
                      </p>
                    </div>
                    <PaymentActions
                      loanId={loanId}
                      paymentId={payment.id}
                      isDeleting={isDeleting}
                      onDelete={handleDelete}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto hidden md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-2 text-muted-foreground font-semibold">Date</th>
                    <th className="text-left py-2 text-muted-foreground font-semibold">Amount</th>
                    <th className="text-left py-2 text-muted-foreground font-semibold">Method</th>
                    <th className="text-left py-2 text-muted-foreground font-semibold">Reference</th>
                    <th className="text-right py-2 text-muted-foreground font-semibold pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-border hover:bg-muted transition-colors">
                      <td className="py-3 text-foreground">
                        {new Date(payment.payment_date).toLocaleDateString('en-PH')}
                      </td>
                      <td className="py-3 font-semibold text-foreground tabular-nums">
                        ₱{payment.amount?.toLocaleString()}
                      </td>
                      <td className="py-3 text-foreground capitalize">{payment.payment_method}</td>
                      <td className="py-3 text-muted-foreground text-xs">{payment.reference_number || '-'}</td>
                      <td className="py-3 text-right">
                        <PaymentActions
                          loanId={loanId}
                          paymentId={payment.id}
                          isDeleting={isDeleting}
                          onDelete={handleDelete}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="py-8 text-center">
            <p className="text-muted-foreground mb-4">No payments recorded yet</p>
            <Link href={`/loans/${loanId}/payments/new`}>
              <Button className="min-h-11">Record First Payment</Button>
            </Link>
          </div>
        )}
      </div>

      {payments.length > 0 && (
        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex justify-between items-center gap-3">
            <p className="text-sm text-muted-foreground">Total Payments</p>
            <p className="text-lg font-bold text-foreground tabular-nums">
              ₱{payments.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

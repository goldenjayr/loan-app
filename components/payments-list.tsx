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
} from "@/components/ui/alert-dialog"

interface PaymentsListProps {
  loanId: string
  payments: any[]
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
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">Payment History</h2>
        <Link href={`/loans/${loanId}/payments/new`}>
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Record Payment
          </Button>
        </Link>
      </div>

      <div className="space-y-3">
        {payments.length > 0 ? (
          <div className="overflow-x-auto">
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
                  <tr key={payment.id} className="border-b border-border hover:bg-muted transition">
                    <td className="py-3 text-foreground">
                      {new Date(payment.payment_date).toLocaleDateString('en-PH')}
                    </td>
                    <td className="py-3 font-semibold text-foreground">
                      ₱{payment.amount?.toLocaleString()}
                    </td>
                    <td className="py-3 text-foreground capitalize">{payment.payment_method}</td>
                    <td className="py-3 text-muted-foreground text-xs">{payment.reference_number || '-'}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/loans/${loanId}/payments/${payment.id}/edit`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </Link>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600 transition-colors">
                              {isDeleting === payment.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the payment record and revert the balance impact on the loan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(payment.id)} className="bg-red-600 hover:bg-red-700">
                                Delete Payment
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="text-muted-foreground mb-4">No payments recorded yet</p>
            <Link href={`/loans/${loanId}/payments/new`}>
              <Button size="sm">Record First Payment</Button>
            </Link>
          </div>
        )}
      </div>

      {payments.length > 0 && (
        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Total Payments</p>
            <p className="text-lg font-bold text-foreground">
              ₱{payments.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

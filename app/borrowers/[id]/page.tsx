'use client'

import { useEffect, useState } from 'react'
import { redirect } from 'next/navigation'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DashboardHeader from '@/components/dashboard-header'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Trash2, Plus } from 'lucide-react'
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
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function BorrowerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const borrowerId = params.id as string
  const [user, setUser] = useState<any>(null)
  const [borrower, setBorrower] = useState<any>(null)
  const [loans, setLoans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        redirect('/auth/login')
      }

      setUser(user)

      // Fetch borrower
      const borrowersResponse = await fetch('/api/borrowers')
      if (borrowersResponse.ok) {
        const borrowersData = await borrowersResponse.json()
        const selectedBorrower = borrowersData.find((b: any) => b.id === Number(borrowerId))
        setBorrower(selectedBorrower)
      }

      // Fetch all loans
      const loansResponse = await fetch('/api/loans')
      if (loansResponse.ok) {
        const loansData = await loansResponse.json()
        const borrowerLoans = loansData.filter((l: any) => l.borrower_id === Number(borrowerId))
        setLoans(borrowerLoans)
      }

      setLoading(false)
    }

    checkAuth()
  }, [borrowerId])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/borrowers/${borrowerId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Borrower deleted successfully')
        router.push('/borrowers')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete borrower')
      }
    } catch (error) {
      console.error('Error deleting borrower:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div>
      </div>
    )
  }

  if (!borrower) {
    return (
      <main className="min-h-screen bg-background">
        <DashboardHeader user={user} />
        <div className="container mx-auto px-4 py-8">
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Borrower not found</p>
            <Link href="/borrowers">
              <Button className="mt-4">Back to Borrowers</Button>
            </Link>
          </Card>
        </div>
      </main>
    )
  }

  const totalLoans = loans.length
  const totalBorrowed = loans.reduce((sum, l) => sum + (l.loan_amount || 0), 0)
  const totalOutstanding = loans.reduce((sum, l) => sum + (l.balance || 0), 0)
  const totalRepaid = totalBorrowed - totalOutstanding
  const activeLoans = loans.filter(l => l.status === 'active').length

  return (
    <main className="min-h-screen bg-background">
      <DashboardHeader user={user} />

      <div className="container mx-auto px-4 py-8">
        <Link href="/borrowers" className="flex items-center gap-2 text-primary hover:text-primary/80 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Borrowers
        </Link>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {borrower.first_name} {borrower.last_name}
            </h1>
          </div>
          <div className="flex gap-2 items-center">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="text-destructive border-destructive hover:bg-destructive shadow-none bg-transparent hover:text-white group">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Borrower?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {loans.length > 0 
                      ? `This borrower has ${loans.length} associated loans. You must delete all loans first before you can delete the borrower.`
                      : "Are you sure you want to delete this borrower? This action cannot be undone."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleting || loans.length > 0}
                  >
                    {deleting ? 'Deleting...' : 'Delete Borrower'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Link href="/loans/new">
              <Button className="gap-2">
                <Plus className="w-4 h-4" /> Create Loan
              </Button>
            </Link>
          </div>
        </div>

        {/* Contact Information */}
        <div className="grid lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Contact Information</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-foreground font-medium mt-1">{borrower.email}</p>
                </div>
                {borrower.phone && (
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="text-foreground font-medium mt-1">{borrower.phone}</p>
                  </div>
                )}
                {borrower.address && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="text-foreground font-medium mt-1">
                      {borrower.address}, {borrower.city}, {borrower.province} {borrower.postal_code}
                    </p>
                  </div>
                )}
                {borrower.id_number && (
                  <div>
                    <p className="text-sm text-muted-foreground">ID</p>
                    <p className="text-foreground font-medium mt-1 font-mono text-sm">{borrower.id_number}</p>
                  </div>
                )}
                {borrower.id_type && (
                  <div>
                    <p className="text-sm text-muted-foreground">ID Type</p>
                    <p className="text-foreground font-medium mt-1">{borrower.id_type}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Summary Stats */}
          <div className="space-y-4">
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-2">Total Loans</p>
              <p className="text-3xl font-bold text-foreground">{totalLoans}</p>
              <p className="text-xs text-muted-foreground mt-2">{activeLoans} active</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-2">Total Borrowed</p>
              <p className="text-3xl font-bold text-foreground">₱{totalBorrowed.toLocaleString()}</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-2">Total Repaid</p>
              <p className="text-3xl font-bold text-green-600">₱{totalRepaid.toLocaleString()}</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground mb-2">Outstanding</p>
              <p className="text-3xl font-bold text-orange-600">₱{totalOutstanding.toLocaleString()}</p>
            </Card>
          </div>
        </div>

        {/* Loans History */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Loan History</h2>
          {loans.length > 0 ? (
            <div className="space-y-4">
              {loans.map(loan => (
                <Link key={loan.id} href={`/loans/${loan.id}`}>
                  <div className="p-4 border border-border rounded-lg hover:border-primary hover:bg-muted transition cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-foreground">Loan #{loan.id}</h3>
                      <Badge className={
                        loan.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        loan.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }>
                        {loan.status?.charAt(0).toUpperCase() + loan.status?.slice(1)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Loan Amount</p>
                        <p className="font-semibold text-foreground">₱{loan.loan_amount?.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Balance</p>
                        <p className="font-semibold text-foreground">₱{loan.balance?.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Rate</p>
                        <p className="font-semibold text-foreground">{loan.interest_rate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Created</p>
                        <p className="font-semibold text-foreground">
                          {new Date(loan.created_at).toLocaleDateString('en-PH')}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-muted-foreground mb-4">No loans for this borrower yet</p>
              <Link href="/loans/new">
                <Button>Create First Loan</Button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </main>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
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
import { toast } from 'sonner'

type Props = {
  borrowerId: string
  loanCount: number
}

export default function BorrowerActions({ borrowerId, loanCount }: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const response = await fetch(`/api/borrowers/${borrowerId}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('Borrower deleted successfully')
        router.push('/borrowers')
        router.refresh()
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

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="min-h-11 min-w-11 text-destructive border-destructive hover:bg-destructive shadow-none bg-transparent hover:text-white"
          aria-label="Delete borrower"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Borrower?</AlertDialogTitle>
          <AlertDialogDescription>
            {loanCount > 0
              ? `This borrower has ${loanCount} associated loans. You must delete all loans first before you can delete the borrower.`
              : 'Are you sure you want to delete this borrower? This action cannot be undone.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleting || loanCount > 0}
          >
            {deleting ? 'Deleting…' : 'Delete Borrower'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TransitionLink } from '@/components/transition-link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function NewBorrowerPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    province: '',
    zip_code: '',
    id_type: '',
    id_number: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const response = await fetch('/api/borrowers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (response.ok) {
        const newBorrower = await response.json()
        toast.success('Borrower created')
        router.push(`/borrowers/${newBorrower.id}`)
        router.refresh()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create borrower')
      }
    } catch (error) {
      console.error('Error creating borrower:', error)
      toast.error('Failed to create borrower')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <TransitionLink
        href="/borrowers"
        transition="back"
        className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-6 min-h-11"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to Borrowers
      </TransitionLink>

      <Card className="max-w-2xl p-5 sm:p-8">
        <h1 className="text-2xl font-bold text-foreground mb-6 text-pretty">Add New Borrower</h1>

        <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                placeholder="Juan…"
                required
                className="min-h-11"
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                placeholder="Dela Cruz…"
                required
                className="min-h-11"
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="juan@example.com"
              required
              className="min-h-11"
              autoComplete="email"
              spellCheck={false}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+63 900 000 0000"
              className="min-h-11"
              autoComplete="tel"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Street Address</Label>
            <Input
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="123 Main Street…"
              className="min-h-11"
              autoComplete="street-address"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" value={formData.city} onChange={handleChange} placeholder="Manila…" className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="province">Province</Label>
              <Input id="province" name="province" value={formData.province} onChange={handleChange} placeholder="Metro Manila…" className="min-h-11" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="zip_code">Postal Code</Label>
            <Input id="zip_code" name="zip_code" value={formData.zip_code} onChange={handleChange} placeholder="1000…" className="min-h-11" />
          </div>

          <div className="border-t border-border pt-6 space-y-4">
            <h2 className="font-semibold text-foreground">Identification</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="id_type">ID Type</Label>
                <Input id="id_type" name="id_type" value={formData.id_type} onChange={handleChange} placeholder="SSS, TIN, Passport…" className="min-h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="id_number">ID Number</Label>
                <Input id="id_number" name="id_number" value={formData.id_number} onChange={handleChange} placeholder="ID number…" className="min-h-11" spellCheck={false} />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
            <TransitionLink href="/borrowers" transition="back" className="flex-1">
              <Button type="button" variant="outline" className="w-full min-h-11">
                Cancel
              </Button>
            </TransitionLink>
            <Button type="submit" disabled={submitting} className="flex-1 gap-2 min-h-11">
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Creating…
                </>
              ) : (
                'Create Borrower'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

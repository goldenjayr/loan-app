import getDb from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const db = getDb()
    const data = db.prepare('SELECT * FROM borrowers ORDER BY created_at DESC').all()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching borrowers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch borrowers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      first_name,
      last_name,
      email,
      phone,
      address,
      city,
      province,
      zip_code,
      id_number,
      id_type,
    } = body

    // Validation
    if (!first_name || !last_name || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO borrowers (
        first_name, last_name, email, phone, address, city, province, 
        zip_code, id_number, id_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const now = new Date().toISOString()
    const result = stmt.run(
      first_name,
      last_name,
      email,
      phone || null,
      address || null,
      city || null,
      province || null,
      zip_code || null,
      id_number || null,
      id_type || null,
      now,
      now
    )

    const newBorrower = db.prepare('SELECT * FROM borrowers WHERE id = ?').get(result.lastInsertRowid)

    return NextResponse.json(newBorrower, { status: 201 })
  } catch (error) {
    console.error('Error creating borrower:', error)
    return NextResponse.json(
      { error: 'Failed to create borrower' },
      { status: 500 }
    )
  }
}

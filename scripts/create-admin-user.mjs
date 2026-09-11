#!/usr/bin/env node
/**
 * Create the placeholder admin user (admin@example.com).
 * Reset the password in Supabase Dashboard → Authentication → Users before production use.
 *
 * Usage: node --env-file=.env.development.local scripts/create-admin-user.mjs
 */
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const dbUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL

const EMAIL = 'admin@example.com'
const TEMP_PASSWORD = 'ChangeMe-Admin-2026!'

if (!url || !serviceKey || !dbUrl) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / POSTGRES_URL_NON_POOLING')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data: listed, error: listError } = await admin.auth.admin.listUsers({ perPage: 200 })
if (listError) {
  console.error(listError)
  process.exit(1)
}

let user = listed.users.find((u) => u.email === EMAIL)

if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: TEMP_PASSWORD,
    email_confirm: true,
    app_metadata: { role: 'admin' },
  })
  if (error) {
    console.error(error)
    process.exit(1)
  }
  user = data.user
  console.log(`Created admin user ${EMAIL}`)
  console.log(`Temporary password: ${TEMP_PASSWORD}`)
  console.log('Reset this password in the Supabase dashboard before production use.')
} else {
  console.log(`Admin user already exists: ${EMAIL} (${user.id})`)
}

const sql = postgres(dbUrl, { max: 1, ssl: 'require' })
try {
  await sql`
    INSERT INTO profiles (id, email, full_name, role, is_active)
    VALUES (${user.id}, ${EMAIL}, ${'Admin'}, ${'admin'}, ${true})
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, role = 'admin', is_active = true, updated_at = NOW()
  `
  console.log('Profile row upserted.')
} finally {
  await sql.end({ timeout: 5 })
}

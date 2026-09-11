import postgres from 'postgres'

/**
 * Server-only Postgres client for Supabase.
 * Prefer POSTGRES_URL (pooler) at runtime; migrations use NON_POOLING separately.
 * Lazily created so `next build` can import route modules without env vars present.
 */
function connectionString() {
  const url = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING
  if (!url) {
    throw new Error('Missing POSTGRES_URL (or POSTGRES_URL_NON_POOLING)')
  }
  return url
}

const globalForSql = globalThis as unknown as { __loanSql?: ReturnType<typeof postgres> }

function createSql() {
  return postgres(connectionString(), {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: 'require',
    prepare: false, // required with PgBouncer transaction pooling
  })
}

function getSql(): ReturnType<typeof postgres> {
  if (!globalForSql.__loanSql) {
    globalForSql.__loanSql = createSql()
  }
  return globalForSql.__loanSql
}

type Sql = ReturnType<typeof postgres>

/** Tagged-template / method proxy that defers connecting until first use. */
export const sql: Sql = new Proxy(function sqlTag() {} as unknown as Sql, {
  apply(_target, _thisArg, argArray) {
    const client = getSql()
    return (client as any)(...argArray)
  },
  get(_target, prop, _receiver) {
    const client = getSql()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})

/** Coerce Postgres NUMERIC / unknown values to finite numbers. */
export function num(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** Normalize DATE columns to YYYY-MM-DD strings. */
export function dateStr(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

export default sql

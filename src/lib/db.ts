import { neon } from '@neondatabase/serverless'

// Cliente Neon (Postgres serverless) — uso exclusivo em route handlers (server-side).
// Acesso por SQL direto via connection string DATABASE_URL.
export function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL não configurada')
  return neon(url)
}

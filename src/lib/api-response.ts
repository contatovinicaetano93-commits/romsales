import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { formatDatabaseError, isDatabaseQuotaError } from '@/lib/db-errors'

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json({ data, meta: meta ?? null }, { status })
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function handleError(e: unknown) {
  if (e instanceof ZodError) {
    return err(e.issues.map((i) => i.message).join(', '), 422)
  }
  if (isDatabaseQuotaError(e) || (e instanceof Error && /DATABASE_URL/i.test(e.message))) {
    const mapped = formatDatabaseError(e)
    return err(mapped.message, mapped.status)
  }
  if (e instanceof Error) {
    return err(e.message, 500)
  }
  return err('Erro desconhecido', 500)
}

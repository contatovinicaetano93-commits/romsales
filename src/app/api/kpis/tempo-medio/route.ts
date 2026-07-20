import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import { requireSession } from '@/lib/auth'
import { fetchTmComparison } from '@/lib/salon/tm-metrics'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSession(req)
    if (!auth.ok) return err(auth.message, auth.status)

    const data = await fetchTmComparison()
    return ok(data)
  } catch (e) {
    return handleError(e)
  }
}

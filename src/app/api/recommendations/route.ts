import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import { requireSession } from '@/lib/auth'
import { listActionItems } from '@/lib/salon/recommendations'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSession(req)
    if (!auth.ok) return err(auth.message, auth.status)

    const items = await listActionItems()
    return ok(items)
  } catch (e) {
    return handleError(e)
  }
}

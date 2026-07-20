import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import { requireSession } from '@/lib/auth'
import { listUpcomingSchedules } from '@/lib/services'

// GET /api/schedule — próximos agendamentos (lembrete visual no painel).
export async function GET(req: NextRequest) {
  try {
    const auth = await requireSession(req)
    if (!auth.ok) return err(auth.message, auth.status)

    const items = await listUpcomingSchedules(7, 20)
    return ok(items)
  } catch (e) {
    return handleError(e)
  }
}

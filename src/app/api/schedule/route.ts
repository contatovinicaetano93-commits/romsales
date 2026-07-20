import { ok, handleError } from '@/lib/api-response'
import { listUpcomingSchedules } from '@/lib/services'

// GET /api/schedule — próximos agendamentos (lembrete visual no painel).
export async function GET() {
  try {
    const items = await listUpcomingSchedules(7, 20)
    return ok(items)
  } catch (e) {
    return handleError(e)
  }
}

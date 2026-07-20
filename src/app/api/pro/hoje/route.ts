import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import { requireProSession } from '@/lib/pro/auth'
import { getProDaySummary } from '@/lib/pro/data-plane'
import { getProUserById } from '@/lib/pro/store'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireProSession(req)
    if (!auth.ok) return err(auth.message, auth.status)

    const user = await getProUserById(auth.session.userId)
    if (!user?.professional_name || !user.connected_at) {
      return err('Conecte sua agenda Avec para ver o Hoje', 409)
    }

    const summary = await getProDaySummary(
      user.professional_name,
      { daily: user.daily_goal, weekly: user.weekly_goal },
      user.panel,
    )
    return ok(summary)
  } catch (e) {
    return handleError(e)
  }
}

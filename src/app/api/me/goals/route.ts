import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import { requireProSession } from '@/lib/pro/auth'
import { buildConnectorStatus, getProUserById, saveProGoals } from '@/lib/pro/store'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireProSession(req)
    if (!auth.ok) return err(auth.message, auth.status)

    const body = await req.json().catch(() => null)
    const daily = Number(body?.daily ?? body?.dailyGoal)
    const weekly = Number(body?.weekly ?? body?.weeklyGoal)
    await saveProGoals(auth.session.userId, daily, weekly)

    const user = await getProUserById(auth.session.userId)
    if (!user) return err('Conta não encontrada', 404)
    return ok({ connectors: buildConnectorStatus(user) })
  } catch (e) {
    if (e instanceof Error && /Meta/i.test(e.message)) return err(e.message, 400)
    return handleError(e)
  }
}

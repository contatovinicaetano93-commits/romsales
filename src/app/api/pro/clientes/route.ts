import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import { requireProSession } from '@/lib/pro/auth'
import { getProClients, getProDataPlaneMode } from '@/lib/pro/data-plane'
import { getProUserById } from '@/lib/pro/store'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireProSession(req)
    if (!auth.ok) return err(auth.message, auth.status)

    const user = await getProUserById(auth.session.userId)
    if (!user?.professional_name || !user.connected_at) {
      return err('Conecte sua agenda Avec para ver seus clientes', 409)
    }

    return ok({
      clients: await getProClients(user.professional_name, user.panel),
      dataSource: getProDataPlaneMode(),
    })
  } catch (e) {
    return handleError(e)
  }
}

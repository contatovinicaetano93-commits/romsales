import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import { requireProSession } from '@/lib/pro/auth'
import { getProClients, getProDataPlaneMode } from '@/lib/pro/data-plane'
import { getProUserById } from '@/lib/pro/store'
import { hitUserRateLimit } from '@/lib/pro/rate-limit'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireProSession(req)
    if (!auth.ok) return err(auth.message, auth.status)

    const rl = await hitUserRateLimit({
      userId: auth.session.userId,
      route: 'pro-clientes',
      limit: 60,
      windowMs: 5 * 60 * 1000,
    })
    if (!rl.ok) return err('Muitas requisições. Aguarde um pouco.', 429)

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

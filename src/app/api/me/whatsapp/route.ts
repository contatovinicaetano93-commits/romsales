import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import { requireProSession } from '@/lib/pro/auth'
import { buildConnectorStatus, connectWhatsapp, getProUserById } from '@/lib/pro/store'
import { hitUserRateLimit } from '@/lib/pro/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireProSession(req)
    if (!auth.ok) return err(auth.message, auth.status)

    const rl = await hitUserRateLimit({
      userId: auth.session.userId,
      route: 'me-whatsapp',
      limit: 15,
      windowMs: 15 * 60 * 1000,
    })
    if (!rl.ok) return err('Muitas tentativas. Aguarde alguns minutos.', 429)

    const body = await req.json().catch(() => null)
    await connectWhatsapp(auth.session.userId, {
      phoneNumberId: typeof body?.phoneNumberId === 'string' ? body.phoneNumberId : '',
      accessToken: typeof body?.accessToken === 'string' ? body.accessToken : '',
      displayNumber: typeof body?.displayNumber === 'string' ? body.displayNumber : '',
    })

    const user = await getProUserById(auth.session.userId)
    if (!user) return err('Conta não encontrada', 404)
    return ok({ connectors: buildConnectorStatus(user) })
  } catch (e) {
    if (e instanceof Error && /Informe/i.test(e.message)) return err(e.message, 400)
    return handleError(e)
  }
}

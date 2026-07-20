import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import { requireProSession } from '@/lib/pro/auth'
import { buildConnectorStatus, connectWhatsapp, getProUserById } from '@/lib/pro/store'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireProSession(req)
    if (!auth.ok) return err(auth.message, auth.status)

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

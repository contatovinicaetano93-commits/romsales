import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import {
  PRO_AUTH_COOKIE,
  createProSessionToken,
  proCookieOptions,
  requireProSession,
} from '@/lib/pro/auth'
import {
  buildConnectorStatus,
  connectAgenda,
  disconnectAgenda,
  getProUserById,
} from '@/lib/pro/store'
import { isValidRomPanelId, getRomPanelId } from '@/lib/brand'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireProSession(req)
    if (!auth.ok) return err(auth.message, auth.status)
    const user = await getProUserById(auth.session.userId)
    if (!user) return err('Conta não encontrada', 404)
    return ok({
      connectors: buildConnectorStatus(user),
      // formulário sempre vazio no GET — não devolvemos token/nome pré-preenchido
      formDefaults: {
        source: 'avec',
        professionalName: '',
        apiToken: '',
        unitId: '',
      },
    })
  } catch (e) {
    return handleError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireProSession(req)
    if (!auth.ok) return err(auth.message, auth.status)

    const body = await req.json().catch(() => null)
    const action = typeof body?.action === 'string' ? body.action : 'connect'

    if (action === 'disconnect') {
      await disconnectAgenda(auth.session.userId)
      const user = await getProUserById(auth.session.userId)
      if (!user) return err('Conta não encontrada', 404)
      const token = await createProSessionToken({
        userId: user.id,
        email: user.email,
        fullName: user.full_name,
        professionalName: null,
        panel: isValidRomPanelId(user.panel) ? user.panel : getRomPanelId(),
      })
      const res = ok({ connectors: buildConnectorStatus(user), next: '/pro/conectar' })
      res.cookies.set(PRO_AUTH_COOKIE, token, proCookieOptions())
      return res
    }

    const professionalName =
      typeof body?.professionalName === 'string'
        ? body.professionalName
        : typeof body?.subscriberName === 'string'
          ? body.subscriberName
          : ''
    const source = typeof body?.source === 'string' ? body.source : 'avec'
    const apiToken = typeof body?.apiToken === 'string' ? body.apiToken : ''
    const unitId = typeof body?.unitId === 'string' ? body.unitId : ''

    await connectAgenda(auth.session.userId, {
      professionalName,
      source,
      apiToken,
      unitId,
    })

    const user = await getProUserById(auth.session.userId)
    if (!user) return err('Conta não encontrada', 404)

    const token = await createProSessionToken({
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
      professionalName: user.professional_name,
      panel: isValidRomPanelId(user.panel) ? user.panel : getRomPanelId(),
    })

    const res = ok({
      connectors: buildConnectorStatus(user),
      professionalName: user.professional_name,
      next: '/pro/hoje',
    })
    res.cookies.set(PRO_AUTH_COOKIE, token, proCookieOptions())
    return res
  } catch (e) {
    if (
      e instanceof Error &&
      /Informe|Fonte|token|mock|vinculado|Trinks|agenda|Avec|validar|permissão|inválido/i.test(
        e.message,
      )
    ) {
      return err(e.message, 400)
    }
    return handleError(e)
  }
}

import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import { requireProSession } from '@/lib/pro/auth'
import { buildConnectorStatus, getProUserById } from '@/lib/pro/store'
import { getRomsalesProduct } from '@/lib/pro/product'
import { isValidRomPanelId } from '@/lib/brand'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireProSession(req)
    if (!auth.ok) return err(auth.message, auth.status)

    const user = await getProUserById(auth.session.userId)
    if (!user) return err('Conta não encontrada', 404)

    const product = getRomsalesProduct(isValidRomPanelId(user.panel) ? user.panel : undefined)
    const connectors = buildConnectorStatus(user)
    return ok({
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
      professionalName: user.professional_name,
      panel: user.panel,
      connectedAt: user.connected_at,
      telegramLinked: user.telegram_linked,
      product,
      plan: 'free',
      connectors,
      features: ['hoje', 'assistente', 'clientes', 'acoes', 'conectar', 'telegram', 'whatsapp'],
    })
  } catch (e) {
    return handleError(e)
  }
}

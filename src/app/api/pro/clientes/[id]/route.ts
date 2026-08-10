import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import { requireProSession } from '@/lib/pro/auth'
import { getProClientDossier } from '@/lib/pro/dossier'
import { getProDataPlaneMode } from '@/lib/pro/data-plane'
import { getProUserById } from '@/lib/pro/store'
import { hitUserRateLimit } from '@/lib/pro/rate-limit'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireProSession(req)
    if (!auth.ok) return err(auth.message, auth.status)

    const rl = await hitUserRateLimit({
      userId: auth.session.userId,
      route: 'pro-cliente-dossier',
      limit: 60,
      windowMs: 5 * 60 * 1000,
    })
    if (!rl.ok) return err('Muitas requisições. Aguarde um pouco.', 429)

    const user = await getProUserById(auth.session.userId)
    if (!user?.professional_name || !user.connected_at) {
      return err('Conecte sua agenda Avec para ver o dossiê do cliente', 409)
    }

    const { id } = await ctx.params
    if (!id?.trim()) return err('Cliente inválido', 400)

    const dossier = await getProClientDossier(id.trim(), user.panel)
    if (!dossier) return err('Cliente não encontrado', 404)

    return ok({
      dossier,
      dataSource: getProDataPlaneMode(),
    })
  } catch (e) {
    return handleError(e)
  }
}

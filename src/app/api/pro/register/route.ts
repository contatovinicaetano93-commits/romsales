import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import {
  PRO_AUTH_COOKIE,
  createProSessionToken,
  proCookieOptions,
} from '@/lib/pro/auth'
import { registerProUser } from '@/lib/pro/store'
import { isValidRomPanelId } from '@/lib/brand'
import { clientKey, hitRateLimit } from '@/lib/pro/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const rl = await hitRateLimit({
      key: clientKey(req, 'pro-register'),
      limit: 10,
      windowMs: 15 * 60 * 1000,
    })
    if (!rl.ok) return err('Muitas tentativas. Aguarde alguns minutos.', 429)

    const body = await req.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const fullName = typeof body?.fullName === 'string' ? body.fullName : ''
    const panel = typeof body?.panel === 'string' ? body.panel : undefined
    if (panel !== undefined && !isValidRomPanelId(panel)) {
      return err('Unidade inválida', 400)
    }

    const user = await registerProUser({ email, password, fullName, panel })
    const token = await createProSessionToken({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      professionalName: null,
      panel: user.panel,
    })

    const res = ok({
      auth: 'ok',
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      next: '/pro/conectar',
    })
    res.cookies.set(PRO_AUTH_COOKIE, token, proCookieOptions())
    return res
  } catch (e) {
    if (e instanceof Error && e.message.includes('Já existe')) {
      return err(e.message, 409)
    }
    if (e instanceof Error && (e.message.includes('Preencha') || e.message.includes('E-mail'))) {
      return err(e.message, 400)
    }
    return handleError(e)
  }
}

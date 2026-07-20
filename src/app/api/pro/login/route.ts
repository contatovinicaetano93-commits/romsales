import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import {
  PRO_AUTH_COOKIE,
  createProSessionToken,
  proCookieOptions,
} from '@/lib/pro/auth'
import { authenticateProUser } from '@/lib/pro/store'
import { clientKey, hitRateLimit } from '@/lib/pro/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const rl = await hitRateLimit({
      key: clientKey(req, 'pro-login'),
      limit: 20,
      windowMs: 15 * 60 * 1000,
    })
    if (!rl.ok) return err('Muitas tentativas. Aguarde alguns minutos.', 429)

    const body = await req.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!email || !password) return err('Informe e-mail e senha', 400)

    const user = await authenticateProUser(email, password)
    if (!user) return err('E-mail ou senha incorretos', 401)

    const token = await createProSessionToken({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      professionalName: user.professionalName,
      panel: user.panel,
    })

    const next = user.professionalName ? '/pro/hoje' : '/pro/conectar'
    const res = ok({
      auth: 'ok',
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      professionalName: user.professionalName,
      next,
    })
    res.cookies.set(PRO_AUTH_COOKIE, token, proCookieOptions())
    return res
  } catch (e) {
    return handleError(e)
  }
}

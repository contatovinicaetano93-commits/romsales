import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getRomPanelId, isMultiUnitDeploy } from '@/lib/brand'
import { isCronAuthorized } from '@/lib/cron-auth'
import { isProduction } from '@/lib/env'
import { parseProSessionToken, PRO_AUTH_COOKIE } from '@/lib/pro/auth'
import {
  getInfrastructureApiAccess,
  isAllowedInfrastructureApi,
  isProApiPath,
  isProPagePath,
  isPublicProSurface,
  isRomsalesProOnly,
  isTeamApiPath,
  isTeamUiPath,
} from '@/lib/pro/product-boundary'

const TEAM_API_BLOCKED_MESSAGE =
  'Este endpoint não faz parte do Romsales pro-only. Use o painel da unidade (ROM Club).'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const proOnly = isRomsalesProOnly()

  if (isPublicProSurface(pathname)) {
    return NextResponse.next()
  }

  if (proOnly && isTeamUiPath(pathname)) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  if (isProPagePath(pathname) || isProApiPath(pathname)) {
    const session = await parseProSessionToken(req.cookies.get(PRO_AUTH_COOKIE)?.value)
    const panelMismatch =
      !isMultiUnitDeploy() && Boolean(session?.panel && session.panel !== getRomPanelId())
    if (!session || panelMismatch) {
      if (isProApiPath(pathname)) {
        return NextResponse.json(
          {
            error: panelMismatch
              ? 'Sessão de outra unidade — entre de novo neste Romsales'
              : 'Faça login no Romsales',
          },
          { status: 401 },
        )
      }
      const login = new URL('/login', req.url)
      login.searchParams.set('next', pathname)
      const res = NextResponse.redirect(login)
      // limpa cookie inválido/expirado/outra unidade com os mesmos atributos do set
      res.cookies.set(PRO_AUTH_COOKIE, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction(),
        path: '/',
        maxAge: 0,
      })
      return res
    }
    return NextResponse.next()
  }

  if (isAllowedInfrastructureApi(pathname)) {
    const access = getInfrastructureApiAccess(pathname)
    if (access === 'public') return NextResponse.next()
    if (access === 'cron' && isCronAuthorized(req)) return NextResponse.next()
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  if (proOnly && pathname.startsWith('/api/')) {
    const error = isTeamApiPath(pathname)
      ? TEAM_API_BLOCKED_MESSAGE
      : 'Endpoint não publicado no Romsales pro-only.'
    return NextResponse.json({ error }, { status: 404 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/hoje',
    '/dashboard',
    '/contatos',
    '/contatos/:path*',
    '/admin',
    '/admin/:path*',
    '/financeiro',
    '/financeiro/:path*',
    '/estoque',
    '/estoque/:path*',
    '/onboarding',
    '/onboarding/:path*',
    '/observability',
    '/observability/:path*',
    '/pro',
    '/pro/:path*',
    '/api/:path*',
  ],
}

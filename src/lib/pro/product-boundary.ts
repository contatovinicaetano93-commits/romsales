type InfrastructureApiAccess = 'public' | 'cron'

const TEAM_UI_PREFIXES = [
  '/hoje',
  '/dashboard',
  '/contatos',
  '/admin',
  '/financeiro',
  '/estoque',
  '/onboarding',
  '/observability',
]

const TEAM_API_PREFIXES = [
  '/api/auth',
  '/api/contacts',
  '/api/financeiro',
  '/api/estoque',
  '/api/kpis',
  '/api/hoje',
  '/api/schedule',
  '/api/recommendations',
  '/api/observability',
  '/api/onboarding',
  '/api/services',
  '/api/seed',
  '/api/docs',
]

/** Só infra necessária ao produto pro — não publicar webhooks/cron da equipe. */
const PUBLIC_INFRASTRUCTURE_API_PREFIXES = [
  '/api/health',
  '/api/webhooks/avec',
  '/api/webhooks/telegram-pro',
]

const CRON_INFRASTRUCTURE_API_PREFIXES = [
  '/api/avec/sync',
  '/api/lgpd/purge',
  '/api/admin/migrations',
]

const PUBLIC_PRO_API_PREFIXES = ['/api/pro/login', '/api/pro/register', '/api/pro/logout']

function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function matchesAnyPathPrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => matchesPathPrefix(pathname, prefix))
}

export function isRomsalesProOnly() {
  const value = process.env.ROMSALES_PRO_ONLY?.trim().toLowerCase()
  if (!value) return true
  return !['0', 'false', 'no', 'off'].includes(value)
}

export function isTeamUiPath(pathname: string) {
  return matchesAnyPathPrefix(pathname, TEAM_UI_PREFIXES)
}

export function isTeamApiPath(pathname: string) {
  return matchesAnyPathPrefix(pathname, TEAM_API_PREFIXES)
}

export function isProPagePath(pathname: string) {
  return pathname === '/pro' || pathname.startsWith('/pro/')
}

export function isProApiPath(pathname: string) {
  return pathname === '/api/pro' || pathname.startsWith('/api/pro/') || pathname.startsWith('/api/me/')
}

export function isPublicProSurface(pathname: string) {
  return (
    pathname === '/' ||
    pathname === '/login' ||
    matchesPathPrefix(pathname, '/pro/login') ||
    matchesAnyPathPrefix(pathname, PUBLIC_PRO_API_PREFIXES)
  )
}

export function isProSurface(pathname: string) {
  return isPublicProSurface(pathname) || isProPagePath(pathname) || isProApiPath(pathname)
}

export function getInfrastructureApiAccess(pathname: string): InfrastructureApiAccess | null {
  if (matchesAnyPathPrefix(pathname, PUBLIC_INFRASTRUCTURE_API_PREFIXES)) return 'public'
  if (matchesAnyPathPrefix(pathname, CRON_INFRASTRUCTURE_API_PREFIXES)) return 'cron'
  return null
}

export function isAllowedInfrastructureApi(pathname: string) {
  return getInfrastructureApiAccess(pathname) !== null
}

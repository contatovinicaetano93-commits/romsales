/** Rotas públicas — única fonte para middleware e documentação. */
export function isPublicPath(pathname: string, method: string) {
  if (pathname === '/' || pathname === '/login') return true
  if (pathname === '/pro/login' || pathname.startsWith('/pro/login/')) return true
  if (pathname.startsWith('/api/pro/login') || pathname.startsWith('/api/pro/register')) return true
  if (pathname.startsWith('/api/webhooks/')) return true
  if (pathname === '/api/health' && method === 'GET') return true
  return false
}

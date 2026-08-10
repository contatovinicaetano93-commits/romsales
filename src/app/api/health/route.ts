import { NextRequest } from 'next/server'
import { ok, handleError } from '@/lib/api-response'
import { getHealthStatus, getPublicHealthStatus } from '@/lib/health'
import { isAuthorized } from '@/lib/auth'
import { isRomsalesProOnly } from '@/lib/pro/product-boundary'

export async function GET(req: NextRequest) {
  try {
    // Pro-only: só status público (sem sessão de equipe).
    if (!isRomsalesProOnly() && (await isAuthorized(req))) {
      return ok(await getHealthStatus())
    }
    return ok(await getPublicHealthStatus())
  } catch (e) {
    return handleError(e)
  }
}

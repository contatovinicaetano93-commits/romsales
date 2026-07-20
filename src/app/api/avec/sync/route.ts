import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import { isAvecConfigured, isAvecMock, getAvecBaseUrl, testAvecConnection } from '@/lib/avec/client'
import { runAvecSync, getLastAvecSync, type AvecSyncMode } from '@/lib/avec/sync'
import { getAvecUnits, isAvecUnitConfigured, withUnitEnv, type AvecUnitEnv } from '@/lib/avec/units'
import { isAuthorized } from '@/lib/auth'
import { isCronAuthorized } from '@/lib/cron-auth'
import { isProduction } from '@/lib/env'
import { getDeploymentContext } from '@/lib/deployment'
import { isSyncLockBusyError } from '@/lib/sync-lock'

/** Sync Avec pode demorar (vários relatórios). */
export const maxDuration = 300

async function authorize(req: NextRequest) {
  if (isCronAuthorized(req)) return true
  if (await isAuthorized(req)) return true
  if (!process.env.CRON_SECRET?.trim() && !isProduction()) return true
  return false
}

function parseMode(req: NextRequest, cronFallback: AvecSyncMode = 'fast'): AvecSyncMode {
  const mode = req.nextUrl.searchParams.get('mode')
  if (mode === 'fast' || mode === 'full') return mode
  return cronFallback
}

const FAST_MIN_GAP_MS = 45_000
const FULL_MIN_GAP_MS = 120_000

/** Sync de uma unidade só — roda com DATABASE_URL/AVEC_* já apontando pra ela (ver withUnitEnv). */
async function executeUnitSync(mode: AvecSyncMode, opts?: { force?: boolean; cron?: boolean }) {
  const minGap = mode === 'full' ? FULL_MIN_GAP_MS : FAST_MIN_GAP_MS

  if (!opts?.force) {
    const last = await getLastAvecSync(mode)
    if (last?.created_at) {
      const age = Date.now() - new Date(last.created_at).getTime()
      if (age >= 0 && age < minGap) {
        return {
          skipped: true,
          reason: 'sync_recente',
          mode,
          last,
          schedule: mode === 'fast' ? 'intraday' : 'full',
          note: `Último sync ${mode} há ${Math.round(age / 1000)}s — aguardando janela de ${minGap / 1000}s`,
        }
      }
    }
  }

  try {
    const run = await runAvecSync(mode)
    return {
      ...run,
      skipped: false,
      mode,
      schedule: mode === 'fast' ? 'intraday' : 'full',
      note:
        mode === 'fast'
          ? 'Sync fast — agenda/caixa do dia (sem P1–P3)'
          : 'Sync full — catálogo + P1/P2/P3',
    }
  } catch (e) {
    if (isSyncLockBusyError(e)) {
      // Cron/webhook: skip silencioso — outro sync ainda está no Neon.
      return {
        skipped: true,
        reason: 'sync_em_andamento',
        mode,
        holder: e.holder,
        expires_at: e.expiresAt,
        note: 'Outro sync Avec já está em execução (lock distribuído)',
      }
    }
    throw e
  }
}

/**
 * Roda o sync pra cada unidade configurada (AVEC_API_TOKEN + DATABASE_URL próprios).
 * Unidade sem token configurado é pulada em silêncio — mesmo skip que já existia pra
 * "aguardando token", só que agora por unidade em vez de global.
 */
async function executeSync(
  req: NextRequest,
  opts?: { force?: boolean; defaultMode?: AvecSyncMode; cron?: boolean },
) {
  const mode = parseMode(req, opts?.defaultMode ?? 'fast')
  const units = getAvecUnits()
  const configured = units.filter(isAvecUnitConfigured)

  if (configured.length === 0) {
    if (opts?.cron) {
      return ok({
        skipped: true,
        reason: 'aguardando_avec_token',
        mode,
        note: 'Nenhuma unidade com AVEC_API_TOKEN configurado — cron ignorado',
      })
    }
    return err('Avec não configurado (AVEC_API_TOKEN)', 503)
  }

  const results: Record<string, unknown> = {}
  for (const unit of units) {
    if (!isAvecUnitConfigured(unit)) {
      results[unit.panel] = { skipped: true, reason: 'aguardando_avec_token' }
      continue
    }
    results[unit.panel] = await withUnitEnv(unit as AvecUnitEnv, () => executeUnitSync(mode, opts))
  }

  // Deploy de unidade única (só Brasil configurado): resposta plana, igual ao formato anterior.
  if (configured.length === 1) {
    return ok(results[configured[0]!.panel])
  }
  return ok({ mode, units: results })
}

export async function POST(req: NextRequest) {
  try {
    if (!(await authorize(req))) return err('Não autorizado', 401)
    const cron = isCronAuthorized(req)
    return await executeSync(req, { force: !cron, defaultMode: 'full', cron })
  } catch (e) {
    return handleError(e)
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!(await authorize(req))) return err('Não autorizado', 401)

    const cron = isCronAuthorized(req)
    if (cron) {
      return await executeSync(req, { defaultMode: parseMode(req, 'fast'), cron: true })
    }

    const test = req.nextUrl.searchParams.get('test') === '1'
    const last = await getLastAvecSync()
    const units = getAvecUnits().map((u) => ({
      panel: u.panel,
      configured: isAvecUnitConfigured(u),
      database: u.databaseUrl ? 'configurado' : 'ausente',
    }))
    return ok({
      configured: isAvecConfigured(),
      mock: isAvecMock(),
      base_url: getAvecBaseUrl(),
      deployment: getDeploymentContext(),
      units,
      cron: {
        fast: { schedule: '*/5 * * * *', mode: 'fast', path: '/api/avec/sync' },
        full: { schedule: '*/10 * * * *', mode: 'full', path: '/api/avec/sync?mode=full' },
        cadence:
          'fast a cada 5 min + full a cada 10 min (backup) — tempo real via webhook Avec',
      },
      last,
      ...(test ? { connection: await testAvecConnection() } : {}),
    })
  } catch (e) {
    return handleError(e)
  }
}

import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import { requireAdmin } from '@/lib/auth'
import { isCronAuthorized } from '@/lib/cron-auth'
import { getMigrationStatus, runPendingMigrations } from '@/lib/migrations'
import { MissingMigrationFileError } from '@/lib/schema-migrations/registry'
import { isValidRomPanelId, type RomPanelId } from '@/lib/brand'

async function authorize(req: NextRequest) {
  if (isCronAuthorized(req)) return { ok: true as const }
  const auth = await requireAdmin(req)
  if (!auth.ok) return auth
  return { ok: true as const }
}

/**
 * Resolve o banco alvo pelo `?panel=` da query — sem isso, deploy multi-unidade
 * (sem ROM_PANEL fixo) sempre caía no default (Brasil) e não tinha como aplicar
 * migration no banco da Iguatemi.
 */
function resolvePanelTarget(req: NextRequest): { panel?: RomPanelId; databaseUrl?: string } {
  const raw = req.nextUrl.searchParams.get('panel')
  if (!isValidRomPanelId(raw)) return {}
  const databaseUrl =
    raw === 'iguatemi' ? process.env.DATABASE_URL_IGUATEMI?.trim() : process.env.DATABASE_URL?.trim()
  return { panel: raw, databaseUrl }
}

/** GET — status das migrations (admin ou cron). `?panel=iguatemi` mira o banco daquela unidade. */
export async function GET(req: NextRequest) {
  try {
    const auth = await authorize(req)
    if (!auth.ok) return err(auth.message, auth.status)

    const { panel } = resolvePanelTarget(req)
    const status = await getMigrationStatus({ panel })
    return ok(status)
  } catch (e) {
    if (e instanceof MissingMigrationFileError) {
      return err(e.message, 500)
    }
    return handleError(e)
  }
}

/** POST — aplica migrations pendentes (admin ou cron). `?panel=iguatemi` mira o banco daquela unidade. */
export async function POST(req: NextRequest) {
  try {
    const auth = await authorize(req)
    if (!auth.ok) return err(auth.message, auth.status)

    const { panel, databaseUrl } = resolvePanelTarget(req)
    const summary = await runPendingMigrations({ panel, databaseUrl })
    if (summary.lockBusy) {
      return err(summary.failed?.error ?? 'Migration em andamento', 409)
    }
    if (summary.failed) {
      return err(
        `Migration falhou: ${summary.failed.id} — ${summary.failed.error ?? 'erro'}`,
        500,
      )
    }
    return ok(summary)
  } catch (e) {
    if (e instanceof MissingMigrationFileError) {
      return err(e.message, 500)
    }
    return handleError(e)
  }
}

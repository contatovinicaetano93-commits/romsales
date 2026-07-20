import { getSql } from '@/lib/db'
import { todayIso } from '@/lib/salon/format'

// Future mode: 'personal-avec' once personal tokens feed a dedicated read-model.
export type ProDataPlaneMode = 'unit-sync'

export interface ProClient {
  name: string
  service?: string
  time?: string
}

export interface ProHojeSummary {
  professionalName: string
  day: string
  appointments: number
  attended: number
  revenue: number
  dailyGoal: number | null
  weeklyGoal: number | null
  goalPct: number | null
  clients: ProClient[]
  note: string
  connected: true
  /** True se os dados vêm do sync da unidade (não do token pessoal). */
  dataSource: ProDataPlaneMode
}

export function getProDataPlaneMode(): ProDataPlaneMode {
  const configured = process.env.ROMSALES_DATA_PLANE?.trim()
  const supportedModes: ProDataPlaneMode[] = ['unit-sync']
  return supportedModes.includes(configured as ProDataPlaneMode)
    ? (configured as ProDataPlaneMode)
    : 'unit-sync'
}

export async function getProClients(professionalName: string): Promise<ProClient[]> {
  const sql = getSql()
  const pro = professionalName.trim()
  const clients: ProClient[] = []

  try {
    const prefs = (await sql`
      select name
      from contacts
      where anonymized_at is null
        and (
          lower(coalesce(preferred_hairstylist, '')) = lower(${pro})
          or lower(coalesce(preferred_manicurist, '')) = lower(${pro})
        )
      order by last_contact_at desc nulls last
      limit 12
    `) as { name: string | null }[]
    for (const c of prefs) {
      clients.push({ name: c.name?.trim() || 'Cliente' })
    }
  } catch {
    // Unit-sync is best-effort for the pro surface; empty state explains missing data.
  }

  return clients
}

/**
 * Resumo do dia — só dados do profissional conectado.
 * Fonte atual: sync da unidade (salon_p1_daily / contacts) filtrado por nome.
 * O token Avec salvo no perfil ainda NÃO alimenta este read-model.
 */
export async function getProDaySummary(
  professionalName: string,
  goals?: { daily?: number | null; weekly?: number | null },
): Promise<ProHojeSummary> {
  const day = todayIso()
  const sql = getSql()
  const pro = professionalName.trim()
  const dataSource = getProDataPlaneMode()

  let appointments = 0
  let attended = 0
  let revenue = 0

  try {
    const rows = (await sql`
      select professionals from salon_p1_daily
      where day = ${day}::date
      limit 1
    `) as { professionals: unknown }[]
    const list = Array.isArray(rows[0]?.professionals) ? rows[0]!.professionals : []
    const mine = (
      list as { name?: string; revenue?: number; attended?: number; appointments?: number }[]
    ).find((p) => (p.name ?? '').trim().toLowerCase() === pro.toLowerCase())
    if (mine) {
      revenue = Number(mine.revenue) || 0
      attended = Number(mine.attended) || 0
      appointments = Number(mine.appointments) || 0
    }
  } catch {
    // Unit-sync is best-effort for the pro surface; empty state explains missing data.
  }

  const clients = await getProClients(pro)
  const dailyGoal =
    goals?.daily != null && Number.isFinite(Number(goals.daily)) ? Number(goals.daily) : null
  const weeklyGoal =
    goals?.weekly != null && Number.isFinite(Number(goals.weekly)) ? Number(goals.weekly) : null
  const goalPct =
    dailyGoal && dailyGoal > 0 ? Math.round((revenue / dailyGoal) * 100) : null

  return {
    professionalName: pro,
    day,
    appointments,
    attended,
    revenue,
    dailyGoal,
    weeklyGoal,
    goalPct,
    clients,
    connected: true,
    dataSource,
    note:
      appointments === 0 && clients.length === 0
        ? 'Agenda conectada. Dados aparecem após o sync Avec da unidade (cron) — o token pessoal ainda não puxa agenda sozinho.'
        : 'Recorte só da sua carteira nesta unidade (via sync da unidade).',
  }
}

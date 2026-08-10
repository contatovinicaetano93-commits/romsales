import { getSql } from '@/lib/db'
import { todayIso } from '@/lib/salon/format'
import { isValidRomPanelId, type RomPanelId } from '@/lib/brand'
import { Observability } from '@/lib/observability'
import {
  avecNameBelongsToConnectedPro,
  collectMatchedAvecNames,
  normalizeProKey,
} from '@/lib/pro/confer-professional'

// Future mode: 'personal-avec' once personal tokens feed a dedicated read-model.
export type ProDataPlaneMode = 'unit-sync'

export interface ProClient {
  id?: string
  name: string
  phone?: string | null
  /** Último serviço (nome) na carteira deste profissional. */
  service?: string
  time?: string
  lastVisitAt?: string | null
  lastPrice?: number | null
  preferredManicurist?: string | null
  preferredHairstylist?: string | null
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

/**
 * Compara nomes de agenda — alinhado à chave de conferência do ROM Central
 * (`normalizeProKey` do relatório de diretoria).
 */
export function normalizeProName(name: string): string {
  return normalizeProKey(name)
}

export async function getProClients(
  professionalName: string,
  panel?: string,
  opts?: { limit?: number },
): Promise<ProClient[]> {
  const sql = getSql(isValidRomPanelId(panel) ? panel : undefined)
  const pro = professionalName.trim()
  const clients: ProClient[] = []
  const limit = Math.min(Math.max(opts?.limit ?? 12, 1), 200)

  try {
    // Conferência roster: variantes Avec que batem no profissional conectado.
    const nameRows = (await sql`
      select distinct professional_name
      from client_services
      where active = true
        and professional_name is not null
    `) as { professional_name: string | null }[]
    const avecNames = nameRows.map((r) => r.professional_name?.trim() || '').filter(Boolean)
    const matchedNames = collectMatchedAvecNames(avecNames, pro, panel)
    if (matchedNames.length === 0) return clients

    // Um contato → linha do serviço mais recente deste pro (prioriza last_done_at).
    const prefs = (await sql`
      select id, name, phone, service_name, last_done_at, last_price,
             preferred_manicurist, preferred_hairstylist
      from (
        select distinct on (c.id)
          c.id,
          c.name,
          c.phone,
          c.preferred_manicurist,
          c.preferred_hairstylist,
          cs.name as service_name,
          cs.last_done_at,
          cs.last_price,
          coalesce(cs.last_done_at, cs.scheduled_at, c.last_contact_at) as sort_at
        from client_services cs
        join contacts c on c.id = cs.contact_id
        where cs.active = true
          and cs.professional_name = any(${matchedNames})
          and c.anonymized_at is null
        order by c.id, cs.last_done_at desc nulls last, cs.scheduled_at desc nulls last
      ) t
      order by sort_at desc nulls last
      limit ${limit}
    `) as {
      id: string
      name: string | null
      phone: string | null
      service_name: string | null
      last_done_at: string | null
      last_price: number | null
      preferred_manicurist: string | null
      preferred_hairstylist: string | null
    }[]
    for (const c of prefs) {
      clients.push({
        id: c.id,
        name: c.name?.trim() || 'Cliente',
        phone: c.phone?.trim() || null,
        service: c.service_name?.trim() || undefined,
        lastVisitAt: c.last_done_at,
        lastPrice:
          c.last_price != null && Number.isFinite(Number(c.last_price))
            ? Number(c.last_price)
            : null,
        preferredManicurist: c.preferred_manicurist,
        preferredHairstylist: c.preferred_hairstylist,
      })
    }
  } catch (e) {
    Observability.captureException(e instanceof Error ? e : new Error(String(e)), {
      scope: 'pro.getProClients',
      panel: panel ?? null,
    })
  }

  return clients
}

async function dayStatsFromClientServices(
  sql: ReturnType<typeof getSql>,
  pro: string,
  day: string,
  panel?: string,
): Promise<{ appointments: number; attended: number; revenue: number }> {
  const apptRows = (await sql`
    select professional_name
    from client_services
    where active = true
      and scheduled_at is not null
      and (scheduled_at at time zone 'America/Sao_Paulo')::date = ${day}::date
  `) as { professional_name: string | null }[]

  const doneRows = (await sql`
    select professional_name, last_price
    from client_services
    where active = true
      and last_done_at is not null
      and (last_done_at at time zone 'America/Sao_Paulo')::date = ${day}::date
  `) as { professional_name: string | null; last_price: number | null }[]

  const dayAvecNames = [
    ...apptRows.map((r) => r.professional_name ?? ''),
    ...doneRows.map((r) => r.professional_name ?? ''),
  ]
  const matchedSet = new Set(collectMatchedAvecNames(dayAvecNames, pro, panel))
  const appointments = apptRows.filter((r) => matchedSet.has(r.professional_name?.trim() || '')).length
  const doneMatched = doneRows.filter((r) => matchedSet.has(r.professional_name?.trim() || ''))
  const attended = doneMatched.length
  const revenue = doneMatched.reduce((sum, r) => sum + (Number(r.last_price) || 0), 0)

  return { appointments, attended, revenue }
}

/**
 * Resumo do dia — só dados do profissional conectado.
 * Fonte: client_services do sync (Lake/REST) por dia; P1 só se o read do dia falhar.
 */
export async function getProDaySummary(
  professionalName: string,
  goals?: { daily?: number | null; weekly?: number | null },
  panel?: string,
): Promise<ProHojeSummary> {
  const day = todayIso()
  const validPanel: RomPanelId | undefined = isValidRomPanelId(panel) ? panel : undefined
  const sql = getSql(validPanel)
  const pro = professionalName.trim()
  const dataSource = getProDataPlaneMode()

  let appointments = 0
  let attended = 0
  let revenue = 0
  let haveLiveDay = false

  // Prefer client_services for Hoje — day-scoped. P1 professionals on
  // salon_p1_daily are a 30-day rolling snapshot and must not override today.
  try {
    const live = await dayStatsFromClientServices(sql, pro, day, validPanel)
    appointments = live.appointments
    attended = live.attended
    revenue = live.revenue
    haveLiveDay = true
  } catch (e) {
    Observability.captureException(e instanceof Error ? e : new Error(String(e)), {
      scope: 'pro.getProDaySummary.client_services',
      panel: validPanel ?? null,
    })
  }

  // P1 only as last resort when day-scoped sync is unavailable.
  if (!haveLiveDay) {
    try {
      const rows = (await sql`
        select professionals from salon_p1_daily
        where day = ${day}::date
        limit 1
      `) as { professionals: unknown }[]
      const list = Array.isArray(rows[0]?.professionals) ? rows[0]!.professionals : []
      const mine = (
        list as { name?: string; revenue?: number; attended?: number; appointments?: number }[]
      ).find((p) => avecNameBelongsToConnectedPro(p.name ?? '', pro, validPanel))
      if (mine) {
        revenue = Number(mine.revenue) || 0
        attended = Number(mine.attended) || 0
        appointments = Number(mine.appointments) || 0
      }
    } catch (e) {
      Observability.captureException(e instanceof Error ? e : new Error(String(e)), {
        scope: 'pro.getProDaySummary',
        panel: validPanel ?? null,
      })
    }
  }

  const clients = await getProClients(pro, validPanel)
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
      appointments === 0 && attended === 0 && clients.length === 0
        ? 'Agenda conectada. Dados aparecem após o sync Avec da unidade (cron) — o token pessoal ainda não puxa agenda sozinho.'
        : 'Recorte só da sua carteira nesta unidade (via sync da unidade).',
  }
}

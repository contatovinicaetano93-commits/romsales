import { getSql } from '@/lib/db'
import { enrichServices, computeRecommendations, type Recommendation } from '@/lib/recommendations'
import type { ClientService, ScheduledServiceRow } from '@/lib/services'
import { isValidRomPanelId, type RomPanelId } from '@/lib/brand'
import { Observability } from '@/lib/observability'
import { collectMatchedAvecNames } from '@/lib/pro/confer-professional'

export interface ProAction extends Recommendation {
  clientName: string
}

/** Mesma ordem de prioridade do painel de equipe — atrasado primeiro, cross-sell por último. */
const PRIORITY: Record<Recommendation['type'], number> = {
  overdue: 0,
  scheduled: 1,
  due_soon: 2,
  upsell: 3,
  crosssell: 4,
}

/** Poucas ações, não a lista inteira — é isso que mantém a tela guiada em vez de um dashboard denso. */
const MAX_ACTIONS = 6

/**
 * Ações do dia pro profissional — reaproveita o motor de recomendação já usado no
 * painel de equipe (src/lib/recommendations.ts), só que escopado pra carteira dele
 * (client_services.professional_name) e no banco da unidade certa.
 */
export async function getProActions(professionalName: string, panel?: string): Promise<ProAction[]> {
  const validPanel: RomPanelId | undefined = isValidRomPanelId(panel) ? panel : undefined
  const sql = getSql(validPanel)
  const pro = professionalName.trim()

  try {
    const nameRows = (await sql`
      select distinct professional_name
      from client_services
      where active = true
        and professional_name is not null
    `) as { professional_name: string | null }[]
    const matchedNames = collectMatchedAvecNames(
      nameRows.map((r) => r.professional_name?.trim() || ''),
      pro,
      validPanel,
    )
    if (matchedNames.length === 0) return []

    const rows = (await sql`
      select cs.*, c.name as contact_name
      from client_services cs
      join contacts c on c.id = cs.contact_id
      where cs.active = true
        and cs.professional_name = any(${matchedNames})
        and c.anonymized_at is null
      order by cs.contact_id
    `) as ScheduledServiceRow[]

    const byContact = new Map<string, { name: string; services: ClientService[] }>()
    for (const row of rows) {
      const entry = byContact.get(row.contact_id) ?? {
        name: row.contact_name?.trim() || 'Cliente',
        services: [],
      }
      entry.services.push(row)
      byContact.set(row.contact_id, entry)
    }

    // Peso extra pra desempatar dentro do mesmo tipo (ex.: dois "overdue") pelo cliente
    // mais atrasado de fato — sem isso o sort cai na ordem arbitrária do banco (por
    // contact_id), e "top 6" vira sorteio em vez de "os que mais precisam de atenção".
    const ranked: { action: ProAction; severity: number }[] = []
    for (const { name, services } of byContact.values()) {
      const enriched = enrichServices(services)
      const severity = enriched.reduce((worst, s) => {
        if (s.state !== 'overdue' && s.state !== 'due_soon') return worst
        return Math.min(worst, s.days_until ?? 0)
      }, Infinity)
      for (const rec of computeRecommendations(enriched)) {
        ranked.push({ action: { ...rec, clientName: name }, severity })
      }
    }

    ranked.sort(
      (a, b) => PRIORITY[a.action.type] - PRIORITY[b.action.type] || a.severity - b.severity,
    )
    return ranked.slice(0, MAX_ACTIONS).map((r) => r.action)
  } catch (e) {
    // Best-effort igual ao resto da superfície pro — cai pro estado vazio, mas o erro
    // real (ex.: banco da unidade fora do ar) é reportado, não desaparece.
    Observability.captureException(e instanceof Error ? e : new Error(String(e)), {
      scope: 'pro.getProActions',
      panel: validPanel ?? null,
    })
    return []
  }
}

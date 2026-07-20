import { getSql } from '@/lib/db'
import { enrichServices, computeRecommendations, type Recommendation } from '@/lib/recommendations'
import type { ClientService, ScheduledServiceRow } from '@/lib/services'
import { isValidRomPanelId, type RomPanelId } from '@/lib/brand'
import { Observability } from '@/lib/observability'

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
    const rows = (await sql`
      select cs.*, c.name as contact_name
      from client_services cs
      join contacts c on c.id = cs.contact_id
      where cs.active = true
        and lower(cs.professional_name) = lower(${pro})
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

    const actions: ProAction[] = []
    for (const { name, services } of byContact.values()) {
      const enriched = enrichServices(services)
      for (const rec of computeRecommendations(enriched)) {
        actions.push({ ...rec, clientName: name })
      }
    }

    actions.sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type])
    return actions.slice(0, MAX_ACTIONS)
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

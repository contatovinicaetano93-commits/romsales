import { getProDaySummary } from '@/lib/pro/data-plane'
import type { ProHojeSummary } from '@/lib/pro/data-plane'

export type { ProHojeSummary } from '@/lib/pro/data-plane'

/**
 * Resumo do dia — só dados do profissional conectado.
 * Fonte atual: sync da unidade (salon_p1_daily / contacts) filtrado por nome.
 * O token Avec salvo no perfil ainda NÃO alimenta este read-model.
 */
export async function buildProHoje(
  professionalName: string,
  goals?: { daily?: number | null; weekly?: number | null },
  panel?: string,
): Promise<ProHojeSummary> {
  return getProDaySummary(professionalName, goals, panel)
}

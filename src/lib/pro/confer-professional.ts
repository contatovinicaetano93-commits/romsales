/**
 * Conferência de profissional — mesmo método do ROM Central (relatório diretoria).
 * Roster BR/IG + matchDirectorProfessional (id → nome normalizado → prefixo único).
 */

import { getRomPanelId, isValidRomPanelId, type RomPanelId } from '@/lib/brand'
import { matchDirectorProfessional, normalizeProKey } from '@/lib/director-report/match-pro'
import { listDirectorProfessionals } from '@/lib/director-report/professionals'
import type { DirectorProfessional } from '@/lib/director-report/types'

export { normalizeProKey, matchDirectorProfessional }

export function rosterForPanel(panel?: string | null): DirectorProfessional[] {
  const p: RomPanelId = isValidRomPanelId(panel) ? panel : getRomPanelId()
  return listDirectorProfessionals(true, p)
}

/**
 * Confere nome digitado / Avec contra o portfólio da unidade.
 * Retorna o profissional canônico do roster ou null (ambíguo / fora da lista).
 */
export function conferProfessional(
  inputName: string,
  panel?: string | null,
): DirectorProfessional | null {
  const roster = rosterForPanel(panel)
  if (roster.length === 0) return null
  return matchDirectorProfessional(inputName, roster)
}

/**
 * True se o nome Avec (sync) pertence ao mesmo profissional do roster
 * já vinculado no perfil (canonicalName = nome do roster).
 */
export function avecNameBelongsToConnectedPro(
  avecName: string,
  connectedRosterName: string,
  panel?: string | null,
): boolean {
  const connected = conferProfessional(connectedRosterName, panel)
  if (!connected) {
    return normalizeProKey(avecName) === normalizeProKey(connectedRosterName)
  }
  const fromAvec = conferProfessional(avecName, panel)
  if (fromAvec) return fromAvec.id === connected.id
  // Nome Avec não bate no roster, mas bate na chave do canônico (ex.: variante).
  return normalizeProKey(avecName) === normalizeProKey(connected.name)
}

export function collectMatchedAvecNames(
  avecNames: string[],
  connectedRosterName: string,
  panel?: string | null,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of avecNames) {
    const name = raw.trim()
    if (!name || seen.has(name)) continue
    if (avecNameBelongsToConnectedPro(name, connectedRosterName, panel)) {
      seen.add(name)
      out.push(name)
    }
  }
  return out
}

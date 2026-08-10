import { getRomPanelId, isValidRomPanelId, type RomPanelId } from '@/lib/brand'
import { BRASIL_DIRECTOR_PROFESSIONALS } from './professionals.brasil'
import { IGUATEMI_DIRECTOR_PROFESSIONALS } from './professionals.iguatemi'
import type { DirectorProfessional } from './types'

const ROSTERS: Record<string, DirectorProfessional[]> = {
  brasil: BRASIL_DIRECTOR_PROFESSIONALS,
  iguatemi: IGUATEMI_DIRECTOR_PROFESSIONALS,
}

export function listDirectorProfessionals(
  activeOnly = true,
  panel?: RomPanelId | string | null,
): DirectorProfessional[] {
  const p: RomPanelId = isValidRomPanelId(panel) ? panel : getRomPanelId()
  const roster = ROSTERS[p] ?? []
  return roster.filter((pro) => (activeOnly ? pro.active : true))
}

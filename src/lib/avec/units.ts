import type { RomPanelId } from '@/lib/brand'
import { runWithUnitEnv, type UnitRuntimeEnv } from '@/lib/unit-context'

/**
 * Config Avec por unidade — mesmo padrão do Cérebro (um banco + um token por unidade),
 * só que aqui o sync roda dentro de UM deploy só, alternando o contexto por iteração.
 *
 * Brasil usa as variáveis originais (sem sufixo).
 * Iguatemi usa sufixo `_IGUATEMI`. Lake keys só herdadas se AVEC_UNIT_ID_IGUATEMI existir
 * (evita sync Iguatemi acidental só porque o Brasil tem AVEC_LAKE_*).
 */
export type AvecUnitEnv = UnitRuntimeEnv

export function getAvecUnits(): AvecUnitEnv[] {
  const iguatemiUnitId = process.env.AVEC_UNIT_ID_IGUATEMI?.trim()
  return [
    {
      panel: 'brasil',
      databaseUrl: process.env.DATABASE_URL,
      avecApiToken: process.env.AVEC_API_TOKEN,
      avecUnitId: process.env.AVEC_UNIT_ID,
      avecBaseUrl: process.env.AVEC_API_URL,
      avecLakeAccessKeyId: process.env.AVEC_LAKE_ACCESS_KEY_ID,
      avecLakeSecretAccessKey: process.env.AVEC_LAKE_SECRET_ACCESS_KEY,
    },
    {
      panel: 'iguatemi',
      databaseUrl: process.env.DATABASE_URL_IGUATEMI,
      avecApiToken: process.env.AVEC_API_TOKEN_IGUATEMI,
      avecUnitId: process.env.AVEC_UNIT_ID_IGUATEMI,
      avecBaseUrl: process.env.AVEC_API_URL_IGUATEMI || process.env.AVEC_API_URL,
      // Só reutiliza Lake keys do Brasil se a unidade Iguatemi estiver explícita.
      avecLakeAccessKeyId: iguatemiUnitId
        ? process.env.AVEC_LAKE_ACCESS_KEY_ID_IGUATEMI || process.env.AVEC_LAKE_ACCESS_KEY_ID
        : process.env.AVEC_LAKE_ACCESS_KEY_ID_IGUATEMI,
      avecLakeSecretAccessKey: iguatemiUnitId
        ? process.env.AVEC_LAKE_SECRET_ACCESS_KEY_IGUATEMI || process.env.AVEC_LAKE_SECRET_ACCESS_KEY
        : process.env.AVEC_LAKE_SECRET_ACCESS_KEY_IGUATEMI,
    },
  ]
}

export function isAvecUnitConfigured(unit: AvecUnitEnv): boolean {
  if (unit.panel === 'brasil' && (process.env.AVEC_MOCK === '1' || process.env.AVEC_MOCK === 'true')) {
    return true
  }
  const mode = (process.env.AVEC_DATA_SOURCE?.trim() || 'auto').toLowerCase()
  const hasRest = Boolean(unit.avecApiToken?.trim())
  const hasLake = Boolean(
    unit.avecLakeAccessKeyId?.trim() && unit.avecLakeSecretAccessKey?.trim()
  )
  const hasDb = Boolean(unit.databaseUrl?.trim())
  const hasUnitId = Boolean(unit.avecUnitId?.trim())

  // Lake exige salao_id + DATABASE_URL da unidade (evita sync cruzado / throw no meio do cron).
  if (mode === 'lake') return hasLake && hasDb && hasUnitId
  if (mode === 'rest') return hasRest
  if (hasLake) return hasDb && hasUnitId
  return hasRest
}

/**
 * Roda `fn` com DATABASE_URL/AVEC_* dessa unidade presos ao contexto assíncrono da
 * chamada (AsyncLocalStorage) — não mutando `process.env` global, então duas execuções
 * concorrentes (ex.: cron sobrepondo um sync anterior ainda em andamento) não podem
 * misturar dado de uma unidade com o banco/token da outra.
 */
export function withUnitEnv<T>(unit: AvecUnitEnv, fn: () => Promise<T>): Promise<T> {
  return runWithUnitEnv(unit, fn)
}

export type { RomPanelId }

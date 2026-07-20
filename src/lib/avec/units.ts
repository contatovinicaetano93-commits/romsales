import type { RomPanelId } from '@/lib/brand'

/**
 * Config Avec por unidade — mesmo padrão do Cérebro (um banco + um token por unidade),
 * só que aqui o sync roda dentro de UM deploy só, alternando o ambiente por iteração.
 *
 * Brasil usa as variáveis originais (sem sufixo) — comportamento idêntico ao de hoje.
 * Iguatemi usa o sufixo `_IGUATEMI`; enquanto AVEC_API_TOKEN_IGUATEMI não existir,
 * essa unidade fica de fora do sync automaticamente (mesmo skip silencioso que já existe).
 */
export interface AvecUnitEnv {
  panel: RomPanelId
  databaseUrl?: string
  avecApiToken?: string
  avecUnitId?: string
  avecBaseUrl?: string
}

export function getAvecUnits(): AvecUnitEnv[] {
  return [
    {
      panel: 'brasil',
      databaseUrl: process.env.DATABASE_URL,
      avecApiToken: process.env.AVEC_API_TOKEN,
      avecUnitId: process.env.AVEC_UNIT_ID,
      avecBaseUrl: process.env.AVEC_API_URL,
    },
    {
      panel: 'iguatemi',
      databaseUrl: process.env.DATABASE_URL_IGUATEMI,
      avecApiToken: process.env.AVEC_API_TOKEN_IGUATEMI,
      avecUnitId: process.env.AVEC_UNIT_ID_IGUATEMI,
      avecBaseUrl: process.env.AVEC_API_URL_IGUATEMI || process.env.AVEC_API_URL,
    },
  ]
}

export function isAvecUnitConfigured(unit: AvecUnitEnv): boolean {
  if (unit.panel === 'brasil' && (process.env.AVEC_MOCK === '1' || process.env.AVEC_MOCK === 'true')) {
    return true
  }
  return Boolean(unit.avecApiToken?.trim())
}

const ENV_KEYS = ['DATABASE_URL', 'AVEC_API_TOKEN', 'AVEC_UNIT_ID', 'AVEC_API_URL'] as const

/**
 * Roda `fn` com DATABASE_URL/AVEC_* apontando pra essa unidade, restaurando o valor
 * original ao final (mesmo em erro). Todo o pipeline de sync já lê esses env vars via
 * getSql()/getConfig() a cada chamada, então isso basta pra rotear sem tocar no resto.
 */
export async function withUnitEnv<T>(unit: AvecUnitEnv, fn: () => Promise<T>): Promise<T> {
  const prev: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}
  for (const key of ENV_KEYS) prev[key] = process.env[key]

  const next: Record<(typeof ENV_KEYS)[number], string | undefined> = {
    DATABASE_URL: unit.databaseUrl,
    AVEC_API_TOKEN: unit.avecApiToken,
    AVEC_UNIT_ID: unit.avecUnitId,
    AVEC_API_URL: unit.avecBaseUrl,
  }

  try {
    for (const key of ENV_KEYS) {
      if (next[key] === undefined) delete process.env[key]
      else process.env[key] = next[key]
    }
    return await fn()
  } finally {
    for (const key of ENV_KEYS) {
      if (prev[key] === undefined) delete process.env[key]
      else process.env[key] = prev[key]
    }
  }
}

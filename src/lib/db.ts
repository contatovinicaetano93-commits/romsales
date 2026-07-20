import { neon } from '@neondatabase/serverless'
import type { RomPanelId } from '@/lib/brand'
import { getUnitEnvOverride } from '@/lib/unit-context'

// Cliente Neon (Postgres serverless) — uso exclusivo em route handlers (server-side).
//
// Identidade do profissional (romsales_pro_users/profiles) vive só em DATABASE_URL —
// login/cadastro continuam centralizados nesse banco em qualquer unidade.
//
// Dado operacional (contacts/salon_p1_daily/...) é por unidade: Brasil usa DATABASE_URL,
// Iguatemi usa DATABASE_URL_IGUATEMI (mesmo padrão do Cérebro, um banco por unidade).
//
// Durante o sync (runWithUnitEnv), a unidade ativa vem do AsyncLocalStorage — preso à
// cadeia assíncrona da requisição, não a uma variável global — então duas execuções
// concorrentes na mesma instância nunca compartilham/pisam no banco uma da outra.
function unitDatabaseUrl(panel?: RomPanelId): string | undefined {
  const override = getUnitEnvOverride()
  if (override) return override.databaseUrl?.trim() || undefined

  if (panel === 'iguatemi') {
    return process.env.DATABASE_URL_IGUATEMI?.trim() || process.env.DATABASE_URL?.trim()
  }
  return process.env.DATABASE_URL?.trim()
}

export function getSql(panel?: RomPanelId) {
  const url = unitDatabaseUrl(panel)
  if (!url) throw new Error('DATABASE_URL não configurada')
  return neon(url)
}

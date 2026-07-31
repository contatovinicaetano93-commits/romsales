import { getAvecBaseUrl } from '@/lib/avec/client'
import {
  getAvecLakeCredentials,
  parseAvecLakeToken,
  verifyAvecLakeCredentials,
  type AvecLakeCredentials,
} from '@/lib/avec/lake'
import { isProduction } from '@/lib/env'

async function pingAvec(token: string) {
  const baseUrl = getAvecBaseUrl()
  const url = `${baseUrl}/reports/0004?page=1&limit=1`
  return fetch(url, {
    headers: { Authorization: token, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
}

async function verifyLakeToken(trimmed: string): Promise<boolean> {
  const parsed = parseAvecLakeToken(trimmed)
  if (!parsed) return false

  const envCreds = getAvecLakeCredentials()
  const secret = parsed.secretAccessKey ?? envCreds?.secretAccessKey
  if (!secret) {
    throw new Error(
      'Credencial AvecLake incompleta — use AKIA…|secret ou configure AVEC_LAKE_SECRET_ACCESS_KEY na Vercel'
    )
  }

  // Access key sozinho: aceita se bater com o da unidade.
  if (!parsed.secretAccessKey && envCreds?.accessKeyId && parsed.accessKeyId === envCreds.accessKeyId) {
    return true
  }

  const creds: AvecLakeCredentials = {
    accessKeyId: parsed.accessKeyId,
    secretAccessKey: secret,
    region: envCreds?.region ?? 'us-west-2',
    database: envCreds?.database ?? 'avec_lake_db',
    workgroup: envCreds?.workgroup ?? 'avec_daas',
  }

  try {
    await verifyAvecLakeCredentials(creds)
  } catch {
    throw new Error('Credenciais AvecLake inválidas ou sem permissão no Athena')
  }
  return true
}

/** Valida token Avec do profissional (REST ping ou AvecLake/Athena). */
export async function verifyProAvecToken(token: string): Promise<void> {
  const trimmed = token.trim()
  if (!trimmed) throw new Error('Informe o token da API')

  if (/^mock$/i.test(trimmed)) {
    if (isProduction()) throw new Error('Token mock não é permitido em produção')
    return
  }

  if (/^lake$/i.test(trimmed)) {
    if (!getAvecLakeCredentials()) {
      throw new Error('AvecLake não configurado na unidade (AVEC_LAKE_*)')
    }
    return
  }

  // Se a unidade tem token REST configurado, aceita o mesmo (uso interno ROM).
  const unitToken = process.env.AVEC_API_TOKEN?.trim()
  if (unitToken && trimmed === unitToken) return

  if (await verifyLakeToken(trimmed)) return

  // Não tenta REST se parece Access Key AWS — evita vazar AKIA no header Authorization.
  if (/^AKIA[0-9A-Z]{16}/.test(trimmed)) {
    throw new Error('Credenciais AvecLake inválidas — confira Access Key e Secret')
  }

  let res: Response
  try {
    res = await pingAvec(trimmed)
  } catch {
    throw new Error('Não foi possível validar o token na Avec — tente de novo')
  }

  // Uma retentativa rápida em 429/5xx (blip da Avec).
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 400))
    try {
      res = await pingAvec(trimmed)
    } catch {
      throw new Error('Avec temporariamente indisponível — tente de novo em instantes')
    }
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error('Token Avec inválido ou sem permissão')
  }
  if (res.status === 429 || res.status >= 500) {
    throw new Error('Avec temporariamente indisponível — tente de novo em instantes')
  }
  if (!res.ok) {
    throw new Error(`Falha ao validar token Avec (HTTP ${res.status})`)
  }
}

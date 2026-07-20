import { getAvecBaseUrl } from '@/lib/avec/client'
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

/** Valida token Avec do profissional (ping leve no relatório 0004). */
export async function verifyProAvecToken(token: string): Promise<void> {
  const trimmed = token.trim()
  if (!trimmed) throw new Error('Informe o token da API')

  if (/^mock$/i.test(trimmed)) {
    if (isProduction()) throw new Error('Token mock não é permitido em produção')
    return
  }

  // Se a unidade tem token configurado, aceita o mesmo (uso interno ROM).
  const unitToken = process.env.AVEC_API_TOKEN?.trim()
  if (unitToken && trimmed === unitToken) return

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

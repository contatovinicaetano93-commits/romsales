/**
 * Erros de infra (Neon/Postgres) → mensagem acionável pro usuário.
 * Neon Free estoura com HTTP 402 "data transfer quota".
 */

export function isDatabaseQuotaError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '')
  const lower = msg.toLowerCase()
  return (
    lower.includes('data transfer quota') ||
    lower.includes('exceeded the data transfer') ||
    lower.includes('quota exceeded') ||
    (/\b402\b/.test(msg) && lower.includes('quota'))
  )
}

export function formatDatabaseError(e: unknown): { message: string; status: number } {
  if (isDatabaseQuotaError(e)) {
    return {
      message:
        'Banco Neon sem cota (HTTP 402). Faça upgrade do plano ou troque DATABASE_URL na Vercel e rode as migrations.',
      status: 503,
    }
  }
  const msg = e instanceof Error ? e.message : String(e ?? 'Erro desconhecido')
  if (/DATABASE_URL não configurada/i.test(msg)) {
    return { message: msg, status: 503 }
  }
  return { message: msg, status: 500 }
}

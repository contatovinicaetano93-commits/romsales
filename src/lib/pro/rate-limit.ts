import { getSql } from '@/lib/db'

let ensurePromise: Promise<void> | null = null

async function ensureRateTable() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const sql = getSql()
      await sql`
        create table if not exists romsales_rate_limits (
          key text primary key,
          hits integer not null default 0,
          window_start timestamptz not null default now()
        )
      `
    })().catch((e) => {
      ensurePromise = null
      throw e
    })
  }
  return ensurePromise
}

/**
 * Rate limit em Neon (janela fixa por chave).
 * Fail-open: se o banco/DDL falhar, não bloqueia login/registro.
 */
export async function hitRateLimit(input: {
  key: string
  limit: number
  windowMs: number
}): Promise<{ ok: boolean; remaining: number }> {
  try {
    await ensureRateTable()
    const sql = getSql()
    const key = input.key.slice(0, 200)
    const windowSec = Math.max(1, Math.floor(input.windowMs / 1000))

    await sql`
      insert into romsales_rate_limits (key, hits, window_start)
      values (${key}, 0, now())
      on conflict (key) do update set
        hits = case
          when romsales_rate_limits.window_start < now() - (${windowSec} * interval '1 second')
            then 0
          else romsales_rate_limits.hits
        end,
        window_start = case
          when romsales_rate_limits.window_start < now() - (${windowSec} * interval '1 second')
            then now()
          else romsales_rate_limits.window_start
        end
    `

    const rows = (await sql`
      update romsales_rate_limits
      set hits = hits + 1
      where key = ${key}
        and hits < ${input.limit}
      returning hits
    `) as { hits: number }[]

    if (!rows[0]) {
      return { ok: false, remaining: 0 }
    }
    return { ok: true, remaining: Math.max(0, input.limit - Number(rows[0].hits)) }
  } catch {
    // Não derruba auth por falha de rate-limit.
    return { ok: true, remaining: input.limit }
  }
}

export function clientKey(req: Request, prefix: string) {
  const xf = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = xf || req.headers.get('x-real-ip') || 'unknown'
  return `${prefix}:${ip}`
}

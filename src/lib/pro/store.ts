import { randomBytes } from 'crypto'
import { getSql } from '@/lib/db'
import { getRomPanelId, isValidRomPanelId, type RomPanelId } from '@/lib/brand'
import { isProduction } from '@/lib/env'
import { hashPassword, verifyPassword } from '@/lib/pro/password'
import { verifyProAvecToken } from '@/lib/pro/avec-verify'
import { lakeTokenForStorage } from '@/lib/avec/lake'
import { encryptSecret } from '@/lib/pro/secrets'
import { normalizeProName } from '@/lib/pro/data-plane'

export { buildConnectorStatus } from '@/lib/pro/connectors'

/** Perfil público do profissional — sem password_hash nem tokens. */
export interface ProUserRow {
  id: string
  email: string
  full_name: string
  professional_name: string | null
  panel: string
  connected_at: string | null
  telegram_linked: boolean
  agenda_source: string | null
  has_avec_token: boolean
  avec_unit_id: string | null
  daily_goal: number | null
  weekly_goal: number | null
  goals_saved_at: string | null
  has_telegram_code: boolean
  has_wa_token: boolean
  wa_display_number: string | null
  ai_used_today: number
  ai_quota_day: string | null
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

let ensurePromise: Promise<void> | null = null

export async function ensureProTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const sql = getSql()
      await sql`
        create table if not exists romsales_pro_users (
          id uuid primary key default gen_random_uuid(),
          email text not null,
          password_hash text not null,
          full_name text not null,
          created_at timestamptz not null default now(),
          constraint romsales_pro_users_email_uniq unique (email)
        )
      `
      await sql`
        create table if not exists romsales_pro_profiles (
          user_id uuid primary key references romsales_pro_users (id) on delete cascade,
          professional_name text,
          panel text not null default 'brasil',
          telegram_chat_id text,
          connected_at timestamptz,
          agenda_source text,
          avec_api_token text,
          avec_unit_id text,
          daily_goal numeric,
          weekly_goal numeric,
          goals_saved_at timestamptz,
          telegram_link_code text,
          wa_phone_number_id text,
          wa_access_token text,
          wa_display_number text,
          ai_used_today integer not null default 0,
          ai_quota_day date,
          updated_at timestamptz not null default now()
        )
      `
      await sql`alter table romsales_pro_profiles add column if not exists agenda_source text`
      await sql`alter table romsales_pro_profiles add column if not exists avec_api_token text`
      await sql`alter table romsales_pro_profiles add column if not exists avec_unit_id text`
      await sql`alter table romsales_pro_profiles add column if not exists daily_goal numeric`
      await sql`alter table romsales_pro_profiles add column if not exists weekly_goal numeric`
      await sql`alter table romsales_pro_profiles add column if not exists goals_saved_at timestamptz`
      await sql`alter table romsales_pro_profiles add column if not exists telegram_link_code text`
      await sql`alter table romsales_pro_profiles add column if not exists wa_phone_number_id text`
      await sql`alter table romsales_pro_profiles add column if not exists wa_access_token text`
      await sql`alter table romsales_pro_profiles add column if not exists wa_display_number text`
      await sql`alter table romsales_pro_profiles add column if not exists ai_used_today integer not null default 0`
      await sql`alter table romsales_pro_profiles add column if not exists ai_quota_day date`
      await sql`
        create unique index if not exists romsales_pro_profiles_panel_name_uniq
          on romsales_pro_profiles (panel, lower(professional_name))
          where professional_name is not null
      `
    })().catch((e) => {
      ensurePromise = null
      throw e
    })
  }
  return ensurePromise
}

export async function registerProUser(input: {
  email: string
  password: string
  fullName: string
  /** Unidade escolhida no cadastro — obrigatória em deploy multi-unidade, ignorada em deploy travado por env. */
  panel?: string
}): Promise<{ id: string; email: string; fullName: string; panel: RomPanelId }> {
  await ensureProTables()
  const sql = getSql()
  const email = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim()
  if (!email || !fullName || input.password.length < 8) {
    throw new Error('Preencha nome, e-mail e senha (mín. 8 caracteres)')
  }
  if (!EMAIL_RE.test(email)) {
    throw new Error('E-mail inválido')
  }
  const passwordHash = hashPassword(input.password)
  const panel = isValidRomPanelId(input.panel) ? input.panel : getRomPanelId()
  try {
    const rows = (await sql`
      insert into romsales_pro_users (email, password_hash, full_name)
      values (${email}, ${passwordHash}, ${fullName})
      returning id, email, full_name
    `) as { id: string; email: string; full_name: string }[]
    const user = rows[0]
    if (!user) throw new Error('Falha ao criar conta')
    await sql`
      insert into romsales_pro_profiles (user_id, panel)
      values (${user.id}, ${panel})
      on conflict (user_id) do nothing
    `
    return { id: user.id, email: user.email, fullName: user.full_name, panel }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('unique') || msg.includes('duplicate')) {
      throw new Error('Já existe uma conta com este e-mail')
    }
    throw e
  }
}

export async function authenticateProUser(
  email: string,
  password: string,
): Promise<{
  id: string
  email: string
  fullName: string
  professionalName: string | null
  panel: RomPanelId
} | null> {
  await ensureProTables()
  const sql = getSql()
  const normalized = email.trim().toLowerCase()
  const rows = (await sql`
    select u.id, u.email, u.password_hash, u.full_name, p.professional_name, p.panel
    from romsales_pro_users u
    left join romsales_pro_profiles p on p.user_id = u.id
    where lower(u.email) = ${normalized}
    limit 1
  `) as {
    id: string
    email: string
    password_hash: string
    full_name: string
    professional_name: string | null
    panel: string | null
  }[]
  const row = rows[0]
  if (!row) return null
  if (!verifyPassword(password, row.password_hash)) return null
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    professionalName: row.professional_name,
    panel: isValidRomPanelId(row.panel) ? row.panel : getRomPanelId(),
  }
}

export async function getProUserById(userId: string): Promise<ProUserRow | null> {
  await ensureProTables()
  const sql = getSql()
  const panel = getRomPanelId()
  const rows = (await sql`
    select u.id, u.email, u.full_name,
           p.professional_name, coalesce(p.panel, ${panel}) as panel,
           p.connected_at,
           (p.telegram_chat_id is not null) as telegram_linked,
           p.agenda_source,
           (p.avec_api_token is not null and length(p.avec_api_token) > 0) as has_avec_token,
           p.avec_unit_id,
           p.daily_goal::float8 as daily_goal,
           p.weekly_goal::float8 as weekly_goal,
           p.goals_saved_at,
           (p.telegram_link_code is not null and length(p.telegram_link_code) > 0) as has_telegram_code,
           (p.wa_access_token is not null and length(p.wa_access_token) > 0) as has_wa_token,
           p.wa_display_number,
           coalesce(p.ai_used_today, 0)::int as ai_used_today,
           p.ai_quota_day::text as ai_quota_day
    from romsales_pro_users u
    left join romsales_pro_profiles p on p.user_id = u.id
    where u.id = ${userId}
    limit 1
  `) as ProUserRow[]
  const row = rows[0]
  if (!row) return null
  return {
    ...row,
    telegram_linked: Boolean(row.telegram_linked),
    has_avec_token: Boolean(row.has_avec_token),
    has_telegram_code: Boolean(row.has_telegram_code),
    has_wa_token: Boolean(row.has_wa_token),
    ai_used_today: Number(row.ai_used_today) || 0,
  }
}

export async function getProByTelegramChatId(chatId: string): Promise<ProUserRow | null> {
  await ensureProTables()
  const chat = chatId.trim()
  if (!chat) return null

  const sql = getSql()
  const panel = getRomPanelId()
  const rows = (await sql`
    select u.id, u.email, u.full_name,
           p.professional_name, coalesce(p.panel, ${panel}) as panel,
           p.connected_at,
           (p.telegram_chat_id is not null) as telegram_linked,
           p.agenda_source,
           (p.avec_api_token is not null and length(p.avec_api_token) > 0) as has_avec_token,
           p.avec_unit_id,
           p.daily_goal::float8 as daily_goal,
           p.weekly_goal::float8 as weekly_goal,
           p.goals_saved_at,
           (p.telegram_link_code is not null and length(p.telegram_link_code) > 0) as has_telegram_code,
           (p.wa_access_token is not null and length(p.wa_access_token) > 0) as has_wa_token,
           p.wa_display_number,
           coalesce(p.ai_used_today, 0)::int as ai_used_today,
           p.ai_quota_day::text as ai_quota_day
    from romsales_pro_profiles p
    join romsales_pro_users u on u.id = p.user_id
    where p.panel = ${panel}
      and p.telegram_chat_id = ${chat}
    limit 1
  `) as ProUserRow[]
  const row = rows[0]
  if (!row) return null
  return {
    ...row,
    telegram_linked: Boolean(row.telegram_linked),
    has_avec_token: Boolean(row.has_avec_token),
    has_telegram_code: Boolean(row.has_telegram_code),
    has_wa_token: Boolean(row.has_wa_token),
    ai_used_today: Number(row.ai_used_today) || 0,
  }
}

function aiQuotaDaySaoPaulo() {
  // Dia de cota no fuso do salão (não UTC).
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** Lê cota do dia (sem consumir). */
export async function readAiQuota(
  userId: string,
  limit = 40,
): Promise<{ used: number; limit: number; remaining: number }> {
  await ensureProTables()
  const sql = getSql()
  const today = aiQuotaDaySaoPaulo()
  const panel = getRomPanelId()
  await sql`
    insert into romsales_pro_profiles (user_id, panel, ai_used_today, ai_quota_day, updated_at)
    values (${userId}, ${panel}, 0, ${today}::date, now())
    on conflict (user_id) do update set
      ai_used_today = case
        when romsales_pro_profiles.ai_quota_day is distinct from ${today}::date then 0
        else romsales_pro_profiles.ai_used_today
      end,
      ai_quota_day = ${today}::date,
      updated_at = now()
  `
  const rows = (await sql`
    select coalesce(ai_used_today, 0)::int as used
    from romsales_pro_profiles
    where user_id = ${userId}
    limit 1
  `) as { used: number }[]
  const used = Number(rows[0]?.used) || 0
  return { used, limit, remaining: Math.max(0, limit - used) }
}

/** Consome 1 crédito atomicamente. */
export async function consumeAiQuota(
  userId: string,
  limit = 40,
): Promise<{ used: number; limit: number; remaining: number; ok: boolean }> {
  await ensureProTables()
  const sql = getSql()
  const today = aiQuotaDaySaoPaulo()
  await readAiQuota(userId, limit) // garante linha + reset do dia
  const rows = (await sql`
    update romsales_pro_profiles
    set ai_used_today = coalesce(ai_used_today, 0) + 1, updated_at = now()
    where user_id = ${userId}
      and ai_quota_day = ${today}::date
      and coalesce(ai_used_today, 0) < ${limit}
    returning coalesce(ai_used_today, 0)::int as used
  `) as { used: number }[]
  if (!rows[0]) {
    const cur = await readAiQuota(userId, limit)
    return { ...cur, ok: false }
  }
  const used = Number(rows[0].used) || 0
  return { used, limit, remaining: Math.max(0, limit - used), ok: true }
}

/** Estorna 1 crédito (ex.: falha da IA após reserva). Usa RETURNING — sem 2ª query. */
export async function refundAiQuota(
  userId: string,
  limit = 40,
): Promise<{ used: number; limit: number; remaining: number }> {
  await ensureProTables()
  const sql = getSql()
  const today = aiQuotaDaySaoPaulo()
  const rows = (await sql`
    update romsales_pro_profiles
    set ai_used_today = greatest(coalesce(ai_used_today, 0) - 1, 0), updated_at = now()
    where user_id = ${userId}
      and ai_quota_day = ${today}::date
    returning coalesce(ai_used_today, 0)::int as used
  `) as { used: number }[]
  const used = Number(rows[0]?.used) || 0
  return { used, limit, remaining: Math.max(0, limit - used) }
}

/** @deprecated prefer readAiQuota / consumeAiQuota */
export async function touchAiQuota(
  userId: string,
  opts: { consume?: boolean; limit: number } = { limit: 40 },
) {
  if (opts.consume) return consumeAiQuota(userId, opts.limit)
  const cur = await readAiQuota(userId, opts.limit)
  return { ...cur, ok: true }
}

export async function connectAgenda(
  userId: string,
  input: {
    professionalName: string
    source?: string
    apiToken?: string
    unitId?: string
  },
) {
  await ensureProTables()
  const sql = getSql()
  const name = input.professionalName.trim()
  if (!name) throw new Error('Informe o nome do profissional na agenda')
  const source = (input.source ?? 'avec').trim().toLowerCase() || 'avec'
  if (source !== 'avec') {
    throw new Error('Por enquanto só Avec está disponível (Trinks em breve)')
  }
  const token = (input.apiToken ?? '').trim()
  await verifyProAvecToken(token)
  // Lake: nunca persiste secret AWS — só marcador/fingerprint criptografado.
  const toStore = lakeTokenForStorage(token) ?? token
  const encryptedToken = encryptSecret(toStore)
  const unitId = (input.unitId ?? '').trim() || null
  const panel = getRomPanelId()

  // Impede dois profissionais da mesma unidade reivindicarem o mesmo nome
  // (case/acentos — alinhado ao match do Hoje/Actions).
  const nameNorm = normalizeProName(name)
  const peers = (await sql`
    select user_id, professional_name
    from romsales_pro_profiles
    where panel = ${panel}
      and professional_name is not null
      and user_id <> ${userId}
  `) as { user_id: string; professional_name: string | null }[]
  if (peers.some((p) => normalizeProName(p.professional_name ?? '') === nameNorm)) {
    throw new Error('Este nome de agenda já está vinculado a outra conta nesta unidade')
  }

  try {
    await sql`
      insert into romsales_pro_profiles (
        user_id, professional_name, panel, connected_at,
        agenda_source, avec_api_token, avec_unit_id, updated_at
      )
      values (
        ${userId}, ${name}, ${panel}, now(),
        ${source}, ${encryptedToken}, ${unitId}, now()
      )
      on conflict (user_id) do update set
        professional_name = excluded.professional_name,
        panel = excluded.panel,
        connected_at = now(),
        agenda_source = excluded.agenda_source,
        avec_api_token = excluded.avec_api_token,
        avec_unit_id = excluded.avec_unit_id,
        updated_at = now()
    `
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('romsales_pro_profiles_panel_name_uniq') || msg.includes('unique')) {
      throw new Error('Este nome de agenda já está vinculado a outra conta nesta unidade')
    }
    throw e
  }
}

export async function disconnectAgenda(userId: string) {
  await ensureProTables()
  const sql = getSql()
  await sql`
    update romsales_pro_profiles
    set
      professional_name = null,
      connected_at = null,
      agenda_source = null,
      avec_api_token = null,
      avec_unit_id = null,
      updated_at = now()
    where user_id = ${userId}
  `
}

export async function saveProGoals(userId: string, daily: number, weekly: number) {
  await ensureProTables()
  if (!Number.isFinite(daily) || daily < 0) throw new Error('Meta diária inválida')
  if (!Number.isFinite(weekly) || weekly < 0) throw new Error('Meta semanal inválida')
  const sql = getSql()
  const panel = getRomPanelId()
  await sql`
    insert into romsales_pro_profiles (user_id, panel, daily_goal, weekly_goal, goals_saved_at, updated_at)
    values (${userId}, ${panel}, ${daily}, ${weekly}, now(), now())
    on conflict (user_id) do update set
      daily_goal = excluded.daily_goal,
      weekly_goal = excluded.weekly_goal,
      goals_saved_at = now(),
      updated_at = now()
  `
}

export async function issueTelegramLinkCode(userId: string): Promise<string> {
  await ensureProTables()
  const code = randomBytes(8).toString('hex') // 16 hex chars
  const sql = getSql()
  const panel = getRomPanelId()
  await sql`
    insert into romsales_pro_profiles (user_id, panel, telegram_link_code, updated_at)
    values (${userId}, ${panel}, ${code}, now())
    on conflict (user_id) do update set
      telegram_link_code = excluded.telegram_link_code,
      updated_at = now()
  `
  return code
}

export async function setProTelegramChatId(userId: string, chatId: string | null) {
  await ensureProTables()
  const sql = getSql()
  await sql`
    update romsales_pro_profiles
    set telegram_chat_id = ${chatId}, updated_at = now()
    where user_id = ${userId}
  `
}

/**
 * Consome o código gerado em /api/me/telegram e grava telegram_chat_id.
 * Escopado ao painel do deploy (ROM_PANEL).
 */
export async function claimTelegramLinkByCode(
  code: string,
  chatId: string,
): Promise<{ ok: true; userId: string } | { ok: false; reason: string }> {
  await ensureProTables()
  const normalized = code.trim().toLowerCase()
  if (!/^[a-f0-9]{16}$/.test(normalized)) {
    return { ok: false, reason: 'Código inválido' }
  }
  const chat = chatId.trim()
  if (!chat) return { ok: false, reason: 'Chat inválido' }

  const sql = getSql()
  const panel = getRomPanelId()
  const rows = (await sql`
    update romsales_pro_profiles
    set
      telegram_chat_id = ${chat},
      telegram_link_code = null,
      updated_at = now()
    where panel = ${panel}
      and lower(coalesce(telegram_link_code, '')) = ${normalized}
    returning user_id
  `) as { user_id: string }[]

  if (!rows[0]?.user_id) {
    return { ok: false, reason: 'Código não encontrado ou já usado' }
  }
  return { ok: true, userId: rows[0].user_id }
}

export async function connectWhatsapp(
  userId: string,
  input: { phoneNumberId: string; accessToken: string; displayNumber?: string },
) {
  await ensureProTables()
  const phoneNumberId = input.phoneNumberId.trim()
  const accessToken = input.accessToken.trim()
  if (!phoneNumberId || !accessToken) {
    throw new Error('Informe Phone number ID e Access token')
  }
  if (isProduction() && /^mock$/i.test(accessToken)) {
    throw new Error('Token mock não é permitido em produção')
  }
  const display = (input.displayNumber ?? '').trim() || null
  const encryptedAccessToken = encryptSecret(accessToken)
  const sql = getSql()
  const panel = getRomPanelId()
  await sql`
    insert into romsales_pro_profiles (
      user_id, panel, wa_phone_number_id, wa_access_token, wa_display_number, updated_at
    )
    values (${userId}, ${panel}, ${phoneNumberId}, ${encryptedAccessToken}, ${display}, now())
    on conflict (user_id) do update set
      wa_phone_number_id = excluded.wa_phone_number_id,
      wa_access_token = excluded.wa_access_token,
      wa_display_number = excluded.wa_display_number,
      updated_at = now()
  `
}

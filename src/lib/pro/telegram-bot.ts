import {
  askProAssistant,
  getAiDailyLimit,
  morningBriefingForUser,
} from '@/lib/pro/assistant'
import { getProDaySummary, type ProHojeSummary } from '@/lib/pro/data-plane'
import { getRomsalesProduct } from '@/lib/pro/product'
import {
  claimTelegramLinkByCode,
  consumeAiQuota,
  getProByTelegramChatId,
  refundAiQuota,
  type ProUserRow,
} from '@/lib/pro/store'
import { sendTelegramMessage } from '@/lib/telegram/bot'

export type ProBotMode =
  | 'ignored'
  | 'start_help'
  | 'link_failed'
  | 'linked'
  | 'hoje'
  | 'hoje_unlinked'
  | 'hoje_not_connected'
  | 'meta'
  | 'clientes'
  | 'briefing'
  | 'ajuda'
  | 'ask'
  | 'quota'
  | 'help'
  | 'error'

export interface ProBotResult {
  replied: boolean
  mode: ProBotMode
  userId?: string
  reason?: string
  error?: string
}

function proBotToken() {
  const pro = process.env.TELEGRAM_PRO_BOT_TOKEN?.trim()
  if (pro) return pro
  // Em produção não cai no bot da equipe — evita tráfego pro no @staff.
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    return undefined
  }
  return process.env.TELEGRAM_BOT_TOKEN?.trim()
}

export function getProBotUsername() {
  const raw = process.env.TELEGRAM_PRO_BOT_USERNAME?.trim()
  if (!raw) return null
  return raw.replace(/^@/, '')
}

export async function replyProBot(chatId: number | string, text: string) {
  await sendTelegramMessage(chatId, text, proBotToken())
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatHojeSummary(summary: ProHojeSummary) {
  return [
    `Hoje — ${summary.professionalName}`,
    `${summary.appointments} horário(s) · ${summary.attended} atendido(s)`,
    `Faturamento: ${formatCurrency(summary.revenue)}`,
    summary.goalPct != null ? `Meta do dia: ${summary.goalPct}%` : 'Meta do dia: não definida',
  ].join('\n')
}

export function formatMetaSummary(summary: ProHojeSummary) {
  const daily =
    summary.dailyGoal != null
      ? `${formatCurrency(summary.dailyGoal)}${summary.goalPct != null ? ` · ${summary.goalPct}%` : ''}`
      : 'não definida'
  const weekly =
    summary.weeklyGoal != null ? formatCurrency(summary.weeklyGoal) : 'não definida'
  return [
    `Metas — ${summary.professionalName}`,
    `Dia: ${daily}`,
    `Semana: ${weekly}`,
    `Faturamento hoje: ${formatCurrency(summary.revenue)}`,
  ].join('\n')
}

export function formatClientesSummary(summary: ProHojeSummary) {
  if (summary.clients.length === 0) {
    return `Carteira — ${summary.professionalName}\nNenhum cliente listado ainda (após o sync Avec).`
  }
  return [
    `Carteira — ${summary.professionalName}`,
    ...summary.clients.slice(0, 12).map((c) => `• ${c.name}`),
  ].join('\n')
}

export function helpMessage() {
  const product = getRomsalesProduct()
  return [
    `Bot ${product.productName}`,
    '',
    'Comandos:',
    '/start SEUCODIGO — vincular (código de 16 letras/números do Conectar)',
    '  ex.: /start a1b2c3d4e5f67890',
    '/hoje — agenda e faturamento do dia',
    '/meta — metas diária/semanal',
    '/clientes — carteira recente',
    '/briefing — briefing da manhã',
    '/ajuda — esta lista',
    '',
    'Ou mande uma pergunta livre (conta na cota da Assistente).',
  ].join('\n')
}

/** Aceita /start CODE, /startCODE, /start_CODE e deep link do Telegram. */
export function parseStartPayload(text: string): { kind: 'start'; code: string | null } | null {
  const trimmed = text.trim()
  const match = trimmed.match(/^\/start(?:@\w+)?(?:[\s_]+([a-fA-F0-9]+)|([a-fA-F0-9]+))?$/i)
  if (!match) return null
  const code = (match[1] || match[2] || '').trim().toLowerCase()
  return { kind: 'start', code: code || null }
}

function parseCommand(text: string): { cmd: string; arg: string } | null {
  const match = text.trim().match(/^\/([a-zA-Z_]+)(?:@\w+)?(?:\s+([\s\S]+))?$/)
  if (!match) return null
  return { cmd: match[1]!.toLowerCase(), arg: (match[2] ?? '').trim() }
}

async function requireLinkedUser(
  chatId: number,
): Promise<{ ok: true; user: ProUserRow } | { ok: false; mode: ProBotMode; message: string }> {
  const product = getRomsalesProduct()
  const user = await getProByTelegramChatId(String(chatId))
  if (!user) {
    return {
      ok: false,
      mode: 'hoje_unlinked',
      message: `Telegram ainda não vinculado ao ${product.productName}. Gere um código em Conectar e envie /start <código>.`,
    }
  }
  return { ok: true, user }
}

async function requireConnectedSummary(user: ProUserRow) {
  if (!user.professional_name || !user.connected_at) {
    return {
      ok: false as const,
      message:
        'Conta vinculada, mas a agenda ainda não está conectada. Abra Conectar e associe seu nome Avec.',
    }
  }
  const summary = await getProDaySummary(
    user.professional_name,
    { daily: user.daily_goal, weekly: user.weekly_goal },
    user.panel,
  )
  return { ok: true as const, summary }
}

async function withAiQuota(
  user: ProUserRow,
  run: () => Promise<{ reply: string; usedAi: boolean }>,
): Promise<{ reply: string; quotaExceeded: boolean }> {
  const limit = getAiDailyLimit()
  const consumed = await consumeAiQuota(user.id, limit)
  if (!consumed.ok) {
    return {
      reply: `Cota diária da Assistente esgotada (${limit}/dia). Volte amanhã ou use o app.`,
      quotaExceeded: true,
    }
  }

  try {
    const result = await run()
    if (!result.usedAi) {
      await refundAiQuota(user.id, limit).catch(() => {})
    }
    return { reply: result.reply, quotaExceeded: false }
  } catch (e) {
    await refundAiQuota(user.id, limit).catch(() => {})
    throw e
  }
}

/** Processa uma mensagem de texto do bot Romsales. */
export async function handleProBotText(chatId: number, text: string): Promise<ProBotResult> {
  const product = getRomsalesProduct()
  const trimmed = text.trim()
  if (!trimmed) return { replied: false, mode: 'ignored' }

  try {
    const start = parseStartPayload(trimmed)
    // Também aceita só o código hex colado (16 chars), sem /start
    const bareCode = /^[a-f0-9]{16}$/i.test(trimmed) ? trimmed.toLowerCase() : null
    if (start || bareCode) {
      const code = bareCode ?? start?.code ?? null
      if (!code) {
        await replyProBot(
          chatId,
          `Olá! Sou o bot do ${product.productName}.\n\nPara vincular:\n1) Abra Conectar no app e gere o código\n2) Envie aqui (com espaço):\n/start SEUCODIGO\n\nO código tem 16 caracteres. Ex.: /start a1b2c3d4e5f67890\n\n${helpMessage()}`,
        )
        return { replied: true, mode: 'start_help' }
      }

      if (!/^[a-f0-9]{16}$/.test(code)) {
        await replyProBot(
          chatId,
          `Código incompleto ou inválido (recebi "${code}", preciso de 16 caracteres).\n\nNo Conectar, copie o código inteiro e envie:\n/start ${code.length >= 8 ? code.slice(0, 16) : 'SEUCODIGO'}\n\nDica: deixe um espaço depois de /start.`,
        )
        return { replied: true, mode: 'link_failed', reason: 'Código incompleto' }
      }

      const claimed = await claimTelegramLinkByCode(code, String(chatId))
      if (!claimed.ok) {
        await replyProBot(
          chatId,
          `Não consegui vincular: ${claimed.reason}.\nGere um código novo em Conectar e envie:\n/start SEUCODIGO`,
        )
        return { replied: true, mode: 'link_failed', reason: claimed.reason }
      }

      await replyProBot(
        chatId,
        `Pronto — Telegram vinculado ao ${product.productName}.\n\nEnvie /hoje ou /briefing para começar.`,
      )
      return { replied: true, mode: 'linked', userId: claimed.userId }
    }

    const parsed = parseCommand(trimmed)
    const cmd = parsed?.cmd
    const isPlainHoje = trimmed.toLowerCase() === 'hoje'

    if (cmd === 'ajuda' || cmd === 'help') {
      await replyProBot(chatId, helpMessage())
      return { replied: true, mode: 'ajuda' }
    }

    if (cmd === 'hoje' || isPlainHoje) {
      const linked = await requireLinkedUser(chatId)
      if (!linked.ok) {
        await replyProBot(chatId, linked.message)
        return { replied: true, mode: linked.mode }
      }
      const ready = await requireConnectedSummary(linked.user)
      if (!ready.ok) {
        await replyProBot(chatId, ready.message)
        return { replied: true, mode: 'hoje_not_connected', userId: linked.user.id }
      }
      await replyProBot(chatId, formatHojeSummary(ready.summary))
      return { replied: true, mode: 'hoje', userId: linked.user.id }
    }

    if (cmd === 'meta' || cmd === 'metas') {
      const linked = await requireLinkedUser(chatId)
      if (!linked.ok) {
        await replyProBot(chatId, linked.message)
        return { replied: true, mode: linked.mode }
      }
      const ready = await requireConnectedSummary(linked.user)
      if (!ready.ok) {
        await replyProBot(chatId, ready.message)
        return { replied: true, mode: 'hoje_not_connected', userId: linked.user.id }
      }
      await replyProBot(chatId, formatMetaSummary(ready.summary))
      return { replied: true, mode: 'meta', userId: linked.user.id }
    }

    if (cmd === 'clientes' || cmd === 'carteira') {
      const linked = await requireLinkedUser(chatId)
      if (!linked.ok) {
        await replyProBot(chatId, linked.message)
        return { replied: true, mode: linked.mode }
      }
      const ready = await requireConnectedSummary(linked.user)
      if (!ready.ok) {
        await replyProBot(chatId, ready.message)
        return { replied: true, mode: 'hoje_not_connected', userId: linked.user.id }
      }
      await replyProBot(chatId, formatClientesSummary(ready.summary))
      return { replied: true, mode: 'clientes', userId: linked.user.id }
    }

    if (cmd === 'briefing' || cmd === 'manha' || cmd === 'manhã') {
      const linked = await requireLinkedUser(chatId)
      if (!linked.ok) {
        await replyProBot(chatId, linked.message)
        return { replied: true, mode: linked.mode }
      }
      const out = await withAiQuota(linked.user, () => morningBriefingForUser(linked.user))
      await replyProBot(chatId, out.reply)
      return {
        replied: true,
        mode: out.quotaExceeded ? 'quota' : 'briefing',
        userId: linked.user.id,
      }
    }

    // Comando desconhecido → ajuda
    if (cmd) {
      await replyProBot(chatId, `Comando não reconhecido.\n\n${helpMessage()}`)
      return { replied: true, mode: 'help' }
    }

    // Pergunta livre → Assistente (mesma cota do app)
    const linked = await requireLinkedUser(chatId)
    if (!linked.ok) {
      await replyProBot(chatId, `${linked.message}\n\n${helpMessage()}`)
      return { replied: true, mode: linked.mode }
    }

    const out = await withAiQuota(linked.user, () => askProAssistant(linked.user, trimmed))
    await replyProBot(chatId, out.reply)
    return {
      replied: true,
      mode: out.quotaExceeded ? 'quota' : 'ask',
      userId: linked.user.id,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'erro desconhecido'
    return { replied: false, mode: 'error', error: message }
  }
}

/** Comandos oficiais do BotFather / setMyCommands. */
export const ROMSALES_BOT_COMMANDS = [
  { command: 'start', description: 'Vincular conta com código' },
  { command: 'hoje', description: 'Resumo do dia' },
  { command: 'meta', description: 'Metas diária e semanal' },
  { command: 'clientes', description: 'Carteira recente' },
  { command: 'briefing', description: 'Briefing da manhã' },
  { command: 'ajuda', description: 'Lista de comandos' },
] as const

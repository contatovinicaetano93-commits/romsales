import { askAI, isAiConfigured } from '@/lib/ai/client'
import { getProDaySummary } from '@/lib/pro/data-plane'
import { getRomsalesProduct } from '@/lib/pro/product'
import type { ProUserRow } from '@/lib/pro/store'
import { buildConnectorStatus } from '@/lib/pro/store'

const AI_DAILY_LIMIT = 40

export function getAiDailyLimit() {
  return AI_DAILY_LIMIT
}

export async function buildProAssistantContext(user: ProUserRow) {
  const connectors = buildConnectorStatus(user)
  const connected = Boolean(user.professional_name && user.connected_at)
  let day = new Date().toISOString().slice(0, 10)

  let appointments = 0
  let attended = 0
  let revenue = 0
  let note = 'Agenda ainda não conectada'
  let clients: { name: string }[] = []
  let dailyGoal: number | null = user.daily_goal != null ? Number(user.daily_goal) : null
  let weeklyGoal: number | null = user.weekly_goal != null ? Number(user.weekly_goal) : null
  let goalPct: number | null = null

  if (connected && user.professional_name) {
    const summary = await getProDaySummary(
      user.professional_name,
      { daily: user.daily_goal, weekly: user.weekly_goal },
      user.panel,
    )
    appointments = summary.appointments
    attended = summary.attended
    revenue = summary.revenue
    note = summary.note
    clients = summary.clients
    dailyGoal = summary.dailyGoal
    weeklyGoal = summary.weeklyGoal
    goalPct = summary.goalPct
    day = summary.day
  } else if (dailyGoal && dailyGoal > 0) {
    goalPct = Math.round((revenue / dailyGoal) * 100)
  }

  const lines = [
    `Profissional: ${user.professional_name ?? user.full_name}`,
    `Conexão: ${connected ? 'ok' : 'missing'}`,
    `Dia: ${day}`,
    `Faturamento hoje: ${revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
    `Atendidos: ${attended}`,
    `Ticket médio: ${attended > 0 ? (revenue / attended).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}`,
    `Ocupação: —`,
    `Agenda hoje: ${appointments} horário(s)`,
    `Meta diária: ${dailyGoal != null ? `${dailyGoal} (${goalPct ?? 0}%)` : 'não definida'}`,
    `Meta semanal: ${weeklyGoal != null ? String(weeklyGoal) : 'não definida'}`,
    `Leads / carteira: ${clients.length}`,
    `Reativações pendentes: 0`,
    `Telegram: ${connectors.telegram.linked ? 'vinculado' : 'não'}`,
    `WhatsApp: ${connectors.whatsapp.credentialsSaved ? 'credenciais salvas; mensagens não ativas' : 'em breve; mensagens não ativas'}`,
    `Nota: ${note}`,
  ]

  return {
    connected,
    day,
    lines,
    text: lines.join('\n'),
    revenue,
    appointments,
    attended,
    dailyGoal,
    weeklyGoal,
    goalPct,
    clients,
    professionalName: user.professional_name,
    fullName: user.full_name,
  }
}

export function formatQuickContext(ctx: Awaited<ReturnType<typeof buildProAssistantContext>>) {
  return ['Contexto rápido:', ...ctx.lines].join('\n')
}

export function formatMorningBriefing(ctx: Awaited<ReturnType<typeof buildProAssistantContext>>) {
  if (!ctx.connected) {
    return [
      'Briefing da manhã',
      '',
      'Sua agenda ainda não está conectada (Conexão: missing).',
      '1) Abra Conectar e associe seu nome + token Avec.',
      '2) Defina meta diária/semanal.',
      '3) Volte aqui e peça o briefing de novo.',
      '',
      'Enquanto isso, posso te orientar no setup — pergunte “como conectar”.',
    ].join('\n')
  }

  return [
    'Briefing da manhã',
    '',
    `Olá, ${ctx.professionalName ?? ctx.fullName}.`,
    `Hoje (${ctx.day}): ${ctx.appointments} horário(s), ${ctx.attended} atendido(s), faturamento ${ctx.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
    ctx.dailyGoal != null
      ? `Meta diária R$ ${Number(ctx.dailyGoal).toLocaleString('pt-BR')} — progresso ${ctx.goalPct ?? 0}%.`
      : 'Meta diária ainda não definida — vale salvar em Conectar → Metas.',
    ctx.clients.length > 0
      ? `Carteira em destaque: ${ctx.clients
          .slice(0, 5)
          .map((c) => c.name)
          .join(', ')}.`
      : 'Carteira ainda sem preferências mapeadas — o sync Avec enriquece isso.',
    '',
    'Foco sugerido: confirmar próximos horários, remarcar retornos e puxar 1 upsell no fechamento.',
  ].join('\n')
}

function localAnswer(
  question: string,
  ctx: Awaited<ReturnType<typeof buildProAssistantContext>>,
): string {
  const q = question.trim().toLowerCase()

  if (/como conectar|conectar agenda|avec|conexão missing|conexao missing/.test(q)) {
    return [
      'Para conectar a Avec:',
      '1. Vá em Conectar',
      '2. Em Agenda, preencha nome (igual na agenda), token da API e unidade (opcional)',
      '3. Toque em “Conectar meus dados”',
      '4. Depois salve suas metas',
      '',
      'Em desenvolvimento você pode usar o token `mock`.',
    ].join('\n')
  }

  if (/meta/.test(q)) {
    if (ctx.dailyGoal == null) {
      return 'Meta ainda não definida. Em Conectar → Metas, salve meta diária e semanal. Depois pergunte “meta hoje” de novo.'
    }
    return [
      `Meta diária: R$ ${Number(ctx.dailyGoal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `Meta semanal: R$ ${Number(ctx.weeklyGoal ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      `Faturamento hoje: ${ctx.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${ctx.goalPct ?? 0}% da meta)`,
      ctx.connected ? '' : 'Conexão ainda missing — o faturamento só enche após sync Avec.',
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (/geral|contexto|resumo|hoje|agenda|status/.test(q)) {
    return formatQuickContext(ctx)
  }

  if (/briefing|manhã|manha/.test(q)) {
    return formatMorningBriefing(ctx)
  }

  if (/cliente|carteira|lead|reativa/.test(q)) {
    if (!ctx.connected) {
      return 'Sem conexão Avec ainda não tenho sua carteira. Conecte a agenda e pergunte de novo.'
    }
    if (ctx.clients.length === 0) {
      return 'Carteira vazia por enquanto. Depois do sync Avec, clientes com preferência pelo seu nome aparecem aqui.'
    }
    return `Clientes recentes da sua carteira:\n${ctx.clients.map((c) => `• ${c.name}`).join('\n')}`
  }

  return [
    formatQuickContext(ctx),
    '',
    'Posso ajudar com: “meta hoje”, “geral”, “briefing”, “como conectar”, “clientes”.',
  ].join('\n')
}

export async function askProAssistant(
  user: ProUserRow,
  question: string,
): Promise<{ reply: string; usedAi: boolean }> {
  const ctx = await buildProAssistantContext(user)
  const product = getRomsalesProduct()
  const trimmed = question.trim()
  if (!trimmed) {
    return { reply: 'Digite uma pergunta sobre agenda, meta ou clientes.', usedAi: false }
  }

  if (!isAiConfigured()) {
    return { reply: localAnswer(trimmed, ctx), usedAi: false }
  }

  const system = `Você é o Assistente ${product.productName} — app AI-first do profissional (${product.unitName}).
Responda em português, curto e acionável (máx. ~12 linhas).
Só use os dados do contexto. Se conexão = missing, oriente a conectar a Avec em /pro/conectar.
Não invente horários, valores ou clientes. Sem planos pagos — tudo é Free.
Tom: direto, de salão, sem enrolação.`

  const userMessage = `Pergunta do profissional:\n${trimmed}\n\nContexto:\n${ctx.text}`

  try {
    const reply = (await askAI(system, userMessage)).trim()
    if (!reply) return { reply: localAnswer(trimmed, ctx), usedAi: false }
    return { reply, usedAi: true }
  } catch {
    return { reply: localAnswer(trimmed, ctx), usedAi: false }
  }
}

export async function morningBriefingForUser(user: ProUserRow) {
  const ctx = await buildProAssistantContext(user)
  if (!isAiConfigured()) {
    return { reply: formatMorningBriefing(ctx), usedAi: false }
  }
  const product = getRomsalesProduct()
  const system = `Você é o Assistente ${product.productName}. Gere um briefing da manhã curto (máx. 10 linhas) com foco e 3 ações.`
  try {
    const reply = (
      await askAI(system, `Monte o briefing com este contexto:\n${ctx.text}`)
    ).trim()
    if (!reply) return { reply: formatMorningBriefing(ctx), usedAi: false }
    return { reply, usedAi: true }
  } catch {
    return { reply: formatMorningBriefing(ctx), usedAi: false }
  }
}

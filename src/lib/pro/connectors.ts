import type { ProUserRow } from '@/lib/pro/store'

export type AgendaStatus = 'unlinked' | 'linked-unit-sync'
export type TelegramStatus = 'unlinked' | 'pending' | 'linked'
export type WhatsAppStatus = 'unlinked' | 'credentials-saved'

export interface ChecklistItem {
  id: 'agenda' | 'goals' | 'telegram' | 'plan' | 'whatsapp'
  title: string
  detail: string
  done: boolean
  required: boolean
}

export interface ConnectorStatus {
  plan: 'free'
  agenda: {
    status: AgendaStatus
    connected: boolean
    dataPlane: 'unit-sync'
    source: string
    professionalName: string | null
    unitId: string | null
    hasToken: boolean
    connectedAt: string | null
  }
  goals: {
    saved: boolean
    daily: number | null
    weekly: number | null
    savedAt: string | null
  }
  telegram: {
    status: TelegramStatus
    linked: boolean
    hasPendingCode: boolean
    botLinkReady: true
  }
  whatsapp: {
    status: WhatsAppStatus
    linked: boolean
    credentialsSaved: boolean
    messagingReady: false
    displayNumber: string | null
    hasToken: boolean
  }
  checklist: ChecklistItem[]
}

export function buildConnectorStatus(user: ProUserRow): ConnectorStatus {
  const agendaConnected = Boolean(user.professional_name && user.connected_at)
  const agendaStatus: AgendaStatus = agendaConnected ? 'linked-unit-sync' : 'unlinked'
  const goalsSaved = user.daily_goal != null && user.weekly_goal != null
  const telegramLinked = user.telegram_linked
  const telegramStatus: TelegramStatus = telegramLinked
    ? 'linked'
    : user.has_telegram_code
      ? 'pending'
      : 'unlinked'
  const whatsappCredentialsSaved = user.has_wa_token
  const whatsappStatus: WhatsAppStatus = whatsappCredentialsSaved ? 'credentials-saved' : 'unlinked'

  return {
    plan: 'free',
    agenda: {
      status: agendaStatus,
      connected: agendaConnected,
      /** Hoje/Assistente leem sync da unidade filtrado por nome — não sync do token pessoal. */
      dataPlane: 'unit-sync',
      source: user.agenda_source ?? 'avec',
      professionalName: user.professional_name,
      unitId: user.avec_unit_id,
      hasToken: user.has_avec_token,
      connectedAt: user.connected_at,
    },
    goals: {
      saved: goalsSaved,
      daily: user.daily_goal,
      weekly: user.weekly_goal,
      savedAt: user.goals_saved_at,
    },
    telegram: {
      status: telegramStatus,
      linked: telegramLinked,
      hasPendingCode: telegramStatus === 'pending',
      botLinkReady: true,
    },
    whatsapp: {
      status: whatsappStatus,
      /** linked só quando messaging estiver ativo — credenciais sozinhas não contam. */
      linked: false,
      credentialsSaved: whatsappCredentialsSaved,
      messagingReady: false,
      displayNumber: user.wa_display_number,
      hasToken: user.has_wa_token,
    },
    checklist: [
      {
        id: 'agenda',
        title: 'Conectar agenda (Avec)',
        detail: agendaConnected
          ? `Nome vinculado: ${user.professional_name} · dados via sync da unidade`
          : 'Vincule seu nome Avec (token valida acesso; Hoje usa sync da unidade)',
        done: agendaConnected,
        required: true,
      },
      {
        id: 'goals',
        title: 'Definir meta',
        detail: goalsSaved
          ? `Dia R$ ${Number(user.daily_goal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · Semana R$ ${Number(user.weekly_goal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : 'Meta diária e semanal da sua carteira',
        done: goalsSaved,
        required: false,
      },
      {
        id: 'telegram',
        title: 'Vincular Telegram',
        detail: telegramLinked
          ? 'Chat vinculado ao bot do profissional'
          : telegramStatus === 'pending'
            ? 'Código pendente — envie /start <código> no bot'
            : 'Gere o código e envie /start no bot do Romsales',
        done: telegramLinked,
        required: false,
      },
      {
        id: 'plan',
        title: 'Plano Free',
        detail: 'Todas as funções liberadas — sem checkout',
        done: true,
        required: false,
      },
      {
        id: 'whatsapp',
        title: 'WhatsApp Cloud (em breve)',
        detail: whatsappCredentialsSaved
          ? `Credenciais salvas${user.wa_display_number ? ` · ${user.wa_display_number}` : ''}; mensagens ainda não estão ativas`
          : 'Em breve — mensagens pelo WhatsApp ainda não estão ativas',
        done: false,
        required: false,
      },
    ],
  }
}

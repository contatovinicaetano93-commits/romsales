'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, ChevronDown, Circle } from 'lucide-react'
import { ProShell } from '../_components/ProShell'

type SectionId = 'agenda' | 'plan' | 'goals' | 'telegram' | 'whatsapp'
type AgendaStatus = 'unlinked' | 'linked-unit-sync'
type TelegramStatus = 'unlinked' | 'pending' | 'linked'
type WhatsAppStatus = 'unlinked' | 'credentials-saved'

interface ChecklistItem {
  id: string
  title: string
  detail: string
  done: boolean
  required: boolean
}

interface Connectors {
  plan: string
  agenda: {
    status: AgendaStatus
    connected: boolean
    dataPlane: 'unit-sync'
    source: string
    professionalName: string | null
    unitId: string | null
    hasToken: boolean
    connectedAt?: string | null
  }
  goals: { saved: boolean; daily: number | null; weekly: number | null; savedAt?: string | null }
  telegram: { status: TelegramStatus; linked: boolean; hasPendingCode?: boolean; botLinkReady?: boolean }
  whatsapp: {
    status: WhatsAppStatus
    linked: boolean
    credentialsSaved?: boolean
    messagingReady?: false
    displayNumber: string | null
    hasToken?: boolean
  }
  checklist: ChecklistItem[]
}

const EMPTY: Connectors = {
  plan: 'free',
  agenda: {
    status: 'unlinked',
    connected: false,
    dataPlane: 'unit-sync',
    source: 'avec',
    professionalName: null,
    unitId: null,
    hasToken: false,
  },
  goals: { saved: false, daily: null, weekly: null },
  telegram: { status: 'unlinked', linked: false, hasPendingCode: false },
  whatsapp: {
    status: 'unlinked',
    linked: false,
    credentialsSaved: false,
    messagingReady: false,
    displayNumber: null,
  },
  checklist: [
    {
      id: 'agenda',
      title: 'Conectar agenda (Avec)',
      detail: 'Obrigatório para ver seus dados',
      done: false,
      required: true,
    },
    {
      id: 'goals',
      title: 'Definir meta',
      detail: 'Meta diária e semanal da sua carteira',
      done: false,
      required: false,
    },
    {
      id: 'telegram',
      title: 'Vincular Telegram',
      detail: 'Briefing e perguntas no Telegram — incluso no Free',
      done: false,
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
      detail: 'Mensagens ainda não estão ativas',
      done: false,
      required: false,
    },
  ],
}

export default function ProConectarPage() {
  const [connectors, setConnectors] = useState<Connectors>(EMPTY)
  const [open, setOpen] = useState<SectionId | null>('agenda')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Formulário Agenda — sempre começa vazio (estado “ainda vou conectar”)
  const [source, setSource] = useState<'avec'>('avec')
  const [professionalName, setProfessionalName] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [unitId, setUnitId] = useState('')

  const [dailyGoal, setDailyGoal] = useState('')
  const [weeklyGoal, setWeeklyGoal] = useState('')
  const [tgCode, setTgCode] = useState<string | null>(null)
  const [tgDeepLink, setTgDeepLink] = useState<string | null>(null)

  const [waPhoneId, setWaPhoneId] = useState('')
  const [waToken, setWaToken] = useState('')
  const [waDisplay, setWaDisplay] = useState('')

  const refresh = useCallback(async () => {
    const res = await fetch('/api/me/connect', { credentials: 'include' })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Falha ao carregar conectores')
      return
    }
    const next = (json.data?.connectors as Connectors) ?? EMPTY
    setConnectors(next)
    // não pré-preenche agenda — usuário conecta do zero
    if (!next.agenda.connected) {
      setProfessionalName('')
      setApiToken('')
      setUnitId('')
      setSource('avec')
    }
    if (next.goals.saved && next.goals.daily != null && next.goals.weekly != null) {
      setDailyGoal(String(next.goals.daily))
      setWeeklyGoal(String(next.goals.weekly))
    } else {
      setDailyGoal('')
      setWeeklyGoal('')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Só guia o accordion na 1ª carga — não fechar o card após Gerar código / salvar.
  const didGuideOpen = useRef(false)
  useEffect(() => {
    if (didGuideOpen.current) return
    // ignora o EMPTY inicial até o refresh popular os conectores
    if (connectors.checklist === EMPTY.checklist) return
    didGuideOpen.current = true
    if (!connectors.agenda.connected) setOpen('agenda')
    else if (!connectors.goals.saved) setOpen('goals')
    else if (!connectors.telegram.linked) setOpen('telegram')
    else setOpen(null)
  }, [connectors])

  const toggle = (id: SectionId) => setOpen((cur) => (cur === id ? null : id))

  async function withBusy(key: string, fn: () => Promise<void>) {
    setBusy(key)
    setError(null)
    setNotice(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha inesperada')
    } finally {
      setBusy(null)
    }
  }

  async function connectAgenda() {
    await withBusy('agenda', async () => {
      const res = await fetch('/api/me/connect', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect',
          source,
          professionalName,
          apiToken,
          unitId,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Não foi possível conectar')
      setConnectors(json.data.connectors)
      setNotice('Agenda conectada. Próximo: definir meta.')
      setOpen('goals')
    })
  }

  async function saveGoals() {
    await withBusy('goals', async () => {
      const res = await fetch('/api/me/goals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daily: Number(dailyGoal),
          weekly: Number(weeklyGoal),
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Não foi possível salvar metas')
      setConnectors(json.data.connectors)
      setNotice('Metas salvas.')
      setOpen('telegram')
    })
  }

  async function genTelegram() {
    await withBusy('telegram', async () => {
      const res = await fetch('/api/me/telegram', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Falha ao gerar código')
      setConnectors(json.data.connectors)
      setTgCode(json.data.code)
      setTgDeepLink(typeof json.data.deepLink === 'string' ? json.data.deepLink : null)
      setNotice(json.data.instruction)
      setOpen('telegram')
    })
  }

  async function connectWa() {
    await withBusy('whatsapp', async () => {
      const res = await fetch('/api/me/whatsapp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumberId: waPhoneId,
          accessToken: waToken,
          displayNumber: waDisplay,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Falha ao salvar credenciais')
      setConnectors(json.data.connectors)
      setNotice('Credenciais do WhatsApp salvas. Mensagens ainda não estão ativas.')
      setWaPhoneId('')
      setWaToken('')
    })
  }

  const money = useMemo(() => {
    if (!connectors.goals.saved) return null
    return `Dia R$ ${Number(connectors.goals.daily).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · Semana R$ ${Number(connectors.goals.weekly).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  }, [connectors.goals])

  return (
    <ProShell
      title="Conectar"
      subtitle="Agenda (nome Avec) → meta → Telegram. WhatsApp está em breve; Dados do Hoje vêm do sync da unidade."
    >
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}
      {notice ? <p className="mb-4 text-sm text-gold">{notice}</p> : null}

      <section className="pro-card mb-4 p-5">
        <ul className="space-y-4">
          {connectors.checklist.map((item) => (
            <li key={item.id} className="flex gap-3">
              {item.done ? (
                <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={18} />
              ) : (
                <Circle className="mt-0.5 shrink-0 text-muted" size={18} />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-sm text-muted">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-3">
        <Accordion
          title="Agenda"
          badge="Obrigatório"
          summary={
            connectors.agenda.connected
              ? `Vinculado · ${connectors.agenda.professionalName}`
              : 'Nome + token Avec desta unidade'
          }
          open={open === 'agenda'}
          onToggle={() => toggle('agenda')}
        >
          <p className="mb-3 text-sm text-muted">
            O token é validado e salvo. O Hoje e a Assistente leem o sync Avec da unidade
            (cron), filtrado pelo seu nome — ainda não há sync pessoal só com este token.
          </p>
          <label className="block text-[0.65rem] uppercase tracking-[0.18em] text-muted">
            Fonte
            <select
              className="pro-input mt-2"
              value={source}
              onChange={(e) => setSource(e.target.value as 'avec')}
            >
              <option value="avec">Avec</option>
            </select>
          </label>

          <label className="mt-3 block text-[0.65rem] uppercase tracking-[0.18em] text-muted">
            Nome do assinante (igual na agenda)
            <input
              className="pro-input mt-2"
              value={professionalName}
              onChange={(e) => setProfessionalName(e.target.value)}
              placeholder="Seu nome exatamente como na Avec"
              autoComplete="off"
            />
          </label>

          <label className="mt-3 block text-[0.65rem] uppercase tracking-[0.18em] text-muted">
            Token da API
            <input
              className="pro-input mt-2"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Token Avec (ou mock em dev)"
              autoComplete="off"
            />
          </label>
          <p className="mt-1 text-xs text-muted">
            Em desenvolvimento com mock: use o token <code className="text-gold">mock</code>.
          </p>

          <label className="mt-3 block text-[0.65rem] uppercase tracking-[0.18em] text-muted">
            ID da unidade Avec (opcional)
            <input
              className="pro-input mt-2"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              placeholder="site / unidade no Avec"
              autoComplete="off"
            />
          </label>

          <button
            type="button"
            className="pro-btn mt-4 w-full"
            disabled={busy === 'agenda' || !professionalName.trim() || !apiToken.trim()}
            onClick={() => void connectAgenda()}
          >
            {busy === 'agenda' ? 'Vinculando…' : 'Vincular nome na agenda'}
          </button>
        </Accordion>

        <Accordion
          title="Plano"
          badge="Free"
          badgeTone="success"
          summary="Free · todas as funções · sem checkout"
          open={open === 'plan'}
          onToggle={() => toggle('plan')}
        >
          <p className="text-sm text-muted">
            No Romsales o plano é Free para todos os profissionais da unidade — sem Stripe, Standard
            ou Pro.
          </p>
        </Accordion>

        <Accordion
          title="Metas"
          badge={connectors.goals.saved ? 'Salva' : undefined}
          summary={money ?? 'Defina meta diária e semanal'}
          open={open === 'goals'}
          onToggle={() => toggle('goals')}
        >
          {connectors.goals.saved ? (
            <div className="mb-3 rounded-xl border border-border bg-gold-soft px-4 py-3 text-sm">
              <p className="text-[0.65rem] uppercase tracking-[0.16em] text-gold">Meta salva agora</p>
              <p className="mt-1 font-medium text-foreground">{money}</p>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[0.65rem] uppercase tracking-[0.18em] text-muted">
              Meta diária (R$)
              <input
                type="number"
                min={0}
                className="pro-input mt-2"
                value={dailyGoal}
                onChange={(e) => setDailyGoal(e.target.value)}
                placeholder="Ex.: 700"
              />
            </label>
            <label className="block text-[0.65rem] uppercase tracking-[0.18em] text-muted">
              Meta semanal (R$)
              <input
                type="number"
                min={0}
                className="pro-input mt-2"
                value={weeklyGoal}
                onChange={(e) => setWeeklyGoal(e.target.value)}
                placeholder="Ex.: 3500"
              />
            </label>
          </div>
          <button
            type="button"
            className="pro-btn-ghost mt-4 w-full"
            disabled={busy === 'goals' || dailyGoal === '' || weeklyGoal === ''}
            onClick={() => void saveGoals()}
          >
            {busy === 'goals' ? 'Salvando…' : 'Salvar metas'}
          </button>
        </Accordion>

        <Accordion
          title="Telegram"
          summary={
            connectors.telegram.linked
              ? 'Chat vinculado'
              : 'Gere o código e envie /start no bot do Romsales'
          }
          open={open === 'telegram'}
          onToggle={() => toggle('telegram')}
        >
          <p className="mb-3 text-sm text-muted">
            Bot Romsales: vincule com código, depois use /hoje, /meta, /clientes e /briefing.
          </p>
          <button
            type="button"
            className="pro-btn-ghost w-full"
            disabled={busy === 'telegram'}
            onClick={() => void genTelegram()}
          >
            {busy === 'telegram' ? 'Gerando…' : 'Gerar código de vínculo'}
          </button>
          {tgCode ? (
            <div className="mt-3 space-y-2 text-sm text-foreground">
              <p>
                Código: <span className="font-semibold text-gold">{tgCode}</span>
              </p>
              <p className="text-muted">
                No bot, envie com espaço:{' '}
                <code className="text-gold">/start {tgCode}</code>
              </p>
              {tgDeepLink ? (
                <a
                  href={tgDeepLink}
                  target="_blank"
                  rel="noreferrer"
                  className="pro-btn inline-flex w-full justify-center"
                >
                  Abrir bot no Telegram
                </a>
              ) : null}
            </div>
          ) : null}
        </Accordion>

        <Accordion
          title="WhatsApp Cloud"
          badge="Em breve"
          summary={
            connectors.whatsapp.credentialsSaved
              ? 'Credenciais salvas — mensagens ainda não ativas'
              : 'Em breve — mensagens ainda não ativas'
          }
          open={open === 'whatsapp'}
          onToggle={() => toggle('whatsapp')}
        >
          <p className="mb-3 text-sm text-muted">
            O WhatsApp do profissional está em breve. Esta seção apenas guarda Phone number ID e
            token na conta; envio, automações e respostas pela Cloud API ainda não estão ligados.
          </p>
          <label className="block text-[0.65rem] uppercase tracking-[0.18em] text-muted">
            Phone number ID
            <input
              className="pro-input mt-2"
              value={waPhoneId}
              onChange={(e) => setWaPhoneId(e.target.value)}
              placeholder="Phone number ID"
              autoComplete="off"
            />
          </label>
          <label className="mt-3 block text-[0.65rem] uppercase tracking-[0.18em] text-muted">
            Access token
            <input
              className="pro-input mt-2"
              value={waToken}
              onChange={(e) => setWaToken(e.target.value)}
              placeholder="Access token (ou mock)"
              autoComplete="off"
            />
          </label>
          <label className="mt-3 block text-[0.65rem] uppercase tracking-[0.18em] text-muted">
            Número exibido (opcional)
            <input
              className="pro-input mt-2"
              value={waDisplay}
              onChange={(e) => setWaDisplay(e.target.value)}
              placeholder="Número exibido (opcional)"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            className="pro-btn-ghost mt-4 w-full"
            disabled={busy === 'whatsapp' || !waPhoneId.trim() || !waToken.trim()}
            onClick={() => void connectWa()}
          >
            {busy === 'whatsapp' ? 'Salvando…' : 'Salvar credenciais do WhatsApp'}
          </button>
        </Accordion>
      </div>
    </ProShell>
  )
}

function Accordion({
  title,
  badge,
  badgeTone = 'gold',
  summary,
  open,
  onToggle,
  children,
}: {
  title: string
  badge?: string
  badgeTone?: 'gold' | 'success'
  summary: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="pro-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            {badge ? (
              <span
                className={
                  badgeTone === 'success'
                    ? 'rounded-full bg-success/15 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-success'
                    : 'rounded-full bg-gold-soft px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-gold'
                }
              >
                {badge}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">{summary}</p>
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <div className="space-y-1 border-t border-border px-5 py-4">{children}</div> : null}
    </section>
  )
}

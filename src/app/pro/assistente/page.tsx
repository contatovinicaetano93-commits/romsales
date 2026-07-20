'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProShell } from '../_components/ProShell'
import { proFetch, ProSessionExpiredError } from '../_lib/pro-fetch'

type Msg = { id: string; role: 'user' | 'assistant'; text: string }

export default function ProAssistentePage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiUsed, setAiUsed] = useState(0)
  const [aiLimit, setAiLimit] = useState(40)
  const [aiConfigured, setAiConfigured] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  const push = useCallback((role: Msg['role'], text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role, text },
    ])
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const res = await proFetch('/api/pro/assistente')
        const json = await res.json()
        if (!res.ok) {
          push('assistant', json.error ?? 'Não consegui carregar sua assistente agora.')
          return
        }
        setAiUsed(json.data?.ai?.used ?? 0)
        setAiLimit(json.data?.ai?.limit ?? 40)
        setAiConfigured(Boolean(json.data?.ai?.configured))
        if (json.data?.context) {
          setMessages([
            {
              id: 'boot',
              role: 'assistant',
              text: json.data.context,
            },
          ])
        }
      } catch (e) {
        if (e instanceof ProSessionExpiredError) {
          router.push('/login?next=/pro/assistente')
          return
        }
        push('assistant', e instanceof Error ? e.message : 'Falha de rede.')
      }
    })()
  }, [router, push])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  async function send(question: string, action: 'ask' | 'briefing' = 'ask') {
    const q = question.trim()
    if ((!q && action === 'ask') || loading) return
    if (action === 'ask') {
      push('user', q)
      setInput('')
    } else {
      push('user', 'Briefing da manhã')
    }
    setLoading(true)
    try {
      const res = await proFetch('/api/pro/assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, question: q }),
      })
      const json = await res.json()
      if (json.data?.ai) {
        setAiUsed(json.data.ai.used)
        setAiLimit(json.data.ai.limit)
        setAiConfigured(Boolean(json.data.ai.configured))
      }
      if (!res.ok || json.error) {
        push('assistant', json.error ?? 'Não consegui responder agora.')
        return
      }
      push('assistant', json.data.reply)
    } catch (e) {
      if (e instanceof ProSessionExpiredError) {
        router.push('/login?next=/pro/assistente')
        return
      }
      push('assistant', e instanceof Error ? e.message : 'Falha de rede. Tente de novo.')
    } finally {
      setLoading(false)
    }
  }

  const composer = (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void send(input)
      }}
      className="flex items-center gap-2 rounded-full border border-border bg-card p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
    >
      <input
        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted"
        placeholder="Pergunte à assistente..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={loading}
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={loading || !input.trim()}
        className="shrink-0 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
      >
        Enviar
      </button>
    </form>
  )

  return (
    <ProShell
      title="Assistente"
      subtitle="Sua agenda, seus clientes, suas metas."
      hideDesktopHeader
      actions={
        <button
          type="button"
          className="pro-btn-ghost"
          disabled={loading}
          onClick={() => void send('', 'briefing')}
        >
          Briefing da manhã
        </button>
      }
      bottomSlot={composer}
    >
      <div className="mx-auto flex h-full max-w-3xl flex-col">
        <div className="mb-3 hidden lg:block">
          <p className="text-[0.62rem] uppercase tracking-[0.22em] text-gold">Romsales</p>
          <h1 className="mt-1 text-3xl font-semibold">Assistente</h1>
          <p className="mt-1 text-sm text-muted">Pergunte sobre agenda, meta e clientes.</p>
          <div className="mt-3">
            <button
              type="button"
              className="pro-btn-ghost"
              disabled={loading}
              onClick={() => void send('', 'briefing')}
            >
              Briefing da manhã
            </button>
          </div>
        </div>

        <p className="mb-3 text-[0.7rem] uppercase tracking-[0.16em] text-gold">
          IA hoje: {aiUsed}/{aiLimit} · plano free
          {!aiConfigured ? ' · modo local' : ''}
        </p>

        <section className="pro-card flex min-h-[50dvh] flex-1 flex-col p-4 sm:p-5">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Conversa</h2>
            <p className="text-sm text-muted">Histórico do dia</p>
          </div>

          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === 'user'
                    ? 'ml-auto max-w-[85%] rounded-2xl bg-gold-soft px-3.5 py-2.5 text-sm text-foreground'
                    : 'mr-auto max-w-[95%] rounded-2xl border border-border bg-surface px-3.5 py-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground/95'
                }
              >
                {m.text}
              </div>
            ))}
            {loading ? (
              <div className="mr-auto rounded-2xl border border-border bg-surface px-3.5 py-3 text-sm text-muted">
                Pensando…
              </div>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {['meta hoje', 'geral', 'como conectar', 'clientes'].map((chip) => (
              <button
                key={chip}
                type="button"
                className="pro-chip"
                disabled={loading}
                onClick={() => void send(chip)}
              >
                {chip}
              </button>
            ))}
          </div>
        </section>
      </div>
    </ProShell>
  )
}

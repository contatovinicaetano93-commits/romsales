'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CalendarClock, CalendarCheck, TrendingUp, Sparkles } from 'lucide-react'
import { ProShell } from '../_components/ProShell'
import { proFetch, ProSessionExpiredError } from '../_lib/pro-fetch'

type ActionType = 'overdue' | 'due_soon' | 'scheduled' | 'upsell' | 'crosssell'

interface ProAction {
  type: ActionType
  title: string
  detail: string
  clientName: string
}

const ICON: Record<ActionType, typeof AlertCircle> = {
  overdue: AlertCircle,
  due_soon: CalendarClock,
  scheduled: CalendarCheck,
  upsell: TrendingUp,
  crosssell: Sparkles,
}

const ICON_CLASS: Record<ActionType, string> = {
  overdue: 'text-danger',
  due_soon: 'text-warning',
  scheduled: 'text-muted',
  upsell: 'text-gold',
  crosssell: 'text-gold',
}

export default function ProAcoesPage() {
  const router = useRouter()
  const [actions, setActions] = useState<ProAction[]>([])
  const [connected, setConnected] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const res = await proFetch('/api/pro/acoes')
        if (res.status === 409) {
          setConnected(false)
          setActions([])
          return
        }
        const json = await res.json()
        if (res.ok) {
          setConnected(true)
          setActions(json.data?.actions ?? [])
        } else {
          setError(json.error ?? 'Falha ao carregar ações')
        }
      } catch (e) {
        if (e instanceof ProSessionExpiredError) {
          router.push('/login?next=/pro/acoes')
          return
        }
        setError(e instanceof Error ? e.message : 'Falha ao carregar ações')
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  return (
    <ProShell
      title="Ações"
      subtitle="As poucas coisas que valem sua atenção hoje — só da sua carteira."
      actions={
        <Link href="/pro/hoje" className="pro-btn-ghost">
          Voltar ao Hoje
        </Link>
      }
    >
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      <section className="pro-card p-5">
        {loading ? (
          <div className="animate-pulse space-y-3 py-2">
            <div className="h-4 w-full rounded bg-border" />
            <div className="h-4 w-5/6 rounded bg-border" />
            <div className="h-4 w-2/3 rounded bg-border" />
          </div>
        ) : !connected ? (
          <p className="py-10 text-center text-sm text-muted">
            Conecte sua agenda pra ver reativação e oportunidades da sua carteira.{' '}
            <Link href="/pro/conectar" className="font-medium text-gold hover:underline">
              Conectar
            </Link>
          </p>
        ) : actions.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            Nada urgente agora — sua carteira está em dia.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {actions.map((a, i) => {
              const Icon = ICON[a.type]
              return (
                <li key={`${a.clientName}-${a.type}-${i}`} className="flex gap-3 py-4">
                  <Icon className={`mt-0.5 shrink-0 ${ICON_CLASS[a.type]}`} size={18} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {a.clientName} — {a.title}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">{a.detail}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </ProShell>
  )
}

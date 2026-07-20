'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Circle } from 'lucide-react'
import { ProShell } from '../_components/ProShell'

interface Summary {
  professionalName: string
  day: string
  appointments: number
  attended: number
  revenue: number
  dailyGoal: number | null
  weeklyGoal: number | null
  goalPct: number | null
  clients: { name: string }[]
  note: string
}

interface ChecklistItem {
  id: string
  title: string
  detail: string
  done: boolean
}

export default function ProHojePage() {
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])

  useEffect(() => {
    void (async () => {
      const [hojeRes, connectRes] = await Promise.all([
        fetch('/api/pro/hoje', { credentials: 'include' }),
        fetch('/api/me/connect', { credentials: 'include' }),
      ])

      const connectJson = await connectRes.json().catch(() => null)
      if (connectRes.ok && connectJson?.data?.connectors?.checklist) {
        setChecklist(connectJson.data.connectors.checklist)
      }

      if (hojeRes.status === 409) {
        setConnected(false)
        setData(null)
        return
      }
      const json = await hojeRes.json()
      if (!hojeRes.ok) {
        setError(json.error ?? 'Falha ao carregar')
        return
      }
      setConnected(true)
      setData(json.data)
    })()
  }, [])

  const steps =
    checklist.length > 0
      ? checklist.map((c) => ({
          done: c.done,
          warn: !c.done && c.id === 'agenda',
          title: c.title,
          detail: c.detail,
        }))
      : [
          {
            done: false,
            warn: true,
            title: 'Conectar agenda (Avec)',
            detail: 'Obrigatório para ver seus dados',
          },
          {
            done: false,
            warn: false,
            title: 'Definir meta',
            detail: 'Meta diária e semanal da sua carteira',
          },
          {
            done: false,
            warn: false,
            title: 'Vincular Telegram',
            detail: 'Canal incluso no Free',
          },
        ]

  const progress = Math.round((steps.filter((s) => s.done).length / Math.max(steps.length, 1)) * 100)

  return (
    <ProShell
      title="Hoje"
      subtitle={
        connected && data
          ? data.professionalName
          : 'Conecte a Avec para ver agenda, meta e carteira'
      }
    >
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {!connected ? (
        <section className="pro-card mb-4 p-5">
          <h2 className="text-lg font-semibold">Conecte sua agenda</h2>
          <p className="mt-1 text-sm text-muted">
            Vincule seu nome Avec em Conectar. Os números do dia vêm do sync da unidade
            depois do cron — não de um sync pessoal.
          </p>
          <Link href="/pro/conectar" className="pro-btn mt-4">
            Ir para Conectar
          </Link>
        </section>
      ) : null}

      <section className="pro-card p-5">
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${progress}%` }} />
        </div>
        <ul className="space-y-4">
          {steps.map((step) => (
            <li key={step.title} className="flex gap-3">
              {step.done ? (
                <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={18} />
              ) : step.warn ? (
                <AlertCircle className="mt-0.5 shrink-0 text-warning" size={18} />
              ) : (
                <Circle className="mt-0.5 shrink-0 text-muted" size={18} />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">{step.title}</p>
                <p className="text-sm text-muted">{step.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {data && connected ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Agenda" value={String(data.appointments)} />
          <Stat label="Atendidos" value={String(data.attended)} />
          <Stat
            label="Faturamento"
            value={data.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          />
          <Stat
            label="Meta do dia"
            value={
              data.dailyGoal != null
                ? `${data.goalPct ?? 0}% · R$ ${Number(data.dailyGoal).toLocaleString('pt-BR')}`
                : 'Não definida'
            }
          />
        </div>
      ) : null}
      {data?.note ? <p className="mt-3 text-xs text-muted">{data.note}</p> : null}
    </ProShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="pro-card px-4 py-4">
      <p className="text-[0.65rem] uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold text-gold">{value}</p>
    </div>
  )
}

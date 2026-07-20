'use client'

import { useState } from 'react'
import { Info, X } from 'lucide-react'

export const STATUS_LABEL: Record<string, string> = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  agendado: 'Agendado',
  convertido: 'Convertido',
  perdido: 'Perdido',
}

// tom = classe de cor semântica pra pills e destaques
export const STATUS_TONE: Record<string, string> = {
  novo: 'bg-gold/15 text-gold',
  em_atendimento: 'bg-sky-500/15 text-sky-300',
  agendado: 'bg-violet-500/15 text-violet-300',
  convertido: 'bg-success/15 text-success',
  perdido: 'bg-danger/15 text-danger',
}

export const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  avec: 'Avec',
  instagram: 'Instagram',
  manual: 'Manual',
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[0.65rem] font-semibold ${
        STATUS_TONE[status] ?? 'bg-border text-muted'
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export function Avatar({ name }: { name: string }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase()
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-sm font-semibold text-gold">
      {initial}
    </span>
  )
}

export function SectionCard({
  title,
  badge,
  children,
  className = '',
}: {
  title: string
  badge?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        {badge}
      </div>
      {children}
    </section>
  )
}

export function CountBadge({ value, tone = 'gold' }: { value: string; tone?: 'gold' | 'success' | 'danger' }) {
  const tones = {
    gold: 'bg-gold/15 text-gold',
    success: 'bg-success/15 text-success',
    danger: 'bg-danger/15 text-danger',
  }
  return <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold ${tones[tone]}`}>{value}</span>
}

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold-bright py-3.5 text-base font-semibold text-background transition-transform active:scale-[0.99] disabled:opacity-60"
    >
      {children}
    </button>
  )
}

export function InfoBanner({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(true)
  if (!open) return null
  return (
    <div className="animate-rise flex items-start gap-3 rounded-2xl border border-gold/25 bg-gold/10 p-4">
      <Info size={18} className="mt-0.5 shrink-0 text-gold" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gold-strong">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{text}</p>
      </div>
      <button type="button" onClick={() => setOpen(false)} aria-label="Fechar aviso" className="shrink-0 text-gold/70 active:text-gold">
        <X size={18} />
      </button>
    </div>
  )
}

export function HealthItem({
  icon,
  label,
  value,
  tone = 'success',
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone?: 'success' | 'gold' | 'warning'
}) {
  const tones = {
    success: 'bg-success/12 text-success',
    gold: 'bg-gold/12 text-gold',
    warning: 'bg-warning/12 text-warning',
  }
  return (
    <div className="flex items-center gap-3 py-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[0.7rem] text-muted">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  CalendarDays,
  MessageCircle,
  Users,
  Sparkles,
  Link2,
  LogOut,
} from 'lucide-react'

const SIDEBAR_NAV = [
  { href: '/pro/hoje', label: 'Hoje', icon: CalendarDays },
  { href: '/pro/assistente', label: 'Assistente', icon: MessageCircle },
  { href: '/pro/clientes', label: 'Clientes', icon: Users },
  { href: '/pro/acoes', label: 'Ações', icon: Sparkles },
  { href: '/pro/conectar', label: 'Conectar', icon: Link2 },
] as const

const TAB_NAV = [
  { href: '/pro/hoje', label: 'Hoje', icon: CalendarDays },
  { href: '/pro/assistente', label: 'Assistente', icon: MessageCircle },
  { href: '/pro/clientes', label: 'Clientes', icon: Users },
  { href: '/pro/acoes', label: 'Ações', icon: Sparkles },
] as const

export function ProShell({
  title,
  subtitle,
  eyebrow,
  actions,
  children,
  /** Espaço extra no rodapé (ex.: composer do chat acima da tab bar). */
  bottomSlot,
  hideDesktopHeader,
}: {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: ReactNode
  children: ReactNode
  bottomSlot?: ReactNode
  hideDesktopHeader?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/pro/logout', { method: 'POST', credentials: 'include' })
    router.push('/login')
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-[1400px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-[15.5rem] shrink-0 flex-col border-r border-border bg-sidebar px-4 py-6 lg:flex">
          <div className="px-2">
            <p className="text-[0.62rem] uppercase tracking-[0.22em] text-gold">App do profissional</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-[1.75rem] font-semibold leading-none tracking-tight">
              Romsales
            </p>
          </div>
          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {SIDEBAR_NAV.map((item) => {
              const active = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors',
                    active
                      ? 'bg-gold-soft font-medium text-gold'
                      : 'text-muted hover:bg-gold-soft/70 hover:text-foreground',
                  ].join(' ')}
                >
                  <Icon size={18} strokeWidth={1.75} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <button
            type="button"
            onClick={() => void logout()}
            className="mt-4 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-muted transition-colors hover:bg-gold-soft/70 hover:text-foreground"
          >
            <LogOut size={18} strokeWidth={1.75} />
            Sair
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top — estilo app HairSales */}
          <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.62rem] uppercase tracking-[0.22em] text-gold">Romsales</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
                {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href="/pro/conectar"
                  aria-label="Conectar"
                  className="inline-flex size-10 items-center justify-center rounded-full border border-gold/40 bg-gold-soft text-gold"
                >
                  <Link2 size={18} strokeWidth={1.75} />
                </Link>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs text-muted"
                >
                  <LogOut size={14} />
                  Sair
                </button>
              </div>
            </div>
            {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
          </header>

          <main
            className={[
              'flex min-w-0 flex-1 flex-col px-4 py-4 sm:px-6',
              'pb-[calc(5.5rem+env(safe-area-inset-bottom))]',
              bottomSlot ? 'pb-[calc(9.5rem+env(safe-area-inset-bottom))]' : '',
              'lg:px-10 lg:py-10 lg:pb-10',
            ].join(' ')}
          >
            {!hideDesktopHeader ? (
              <header className="mb-6 hidden flex-wrap items-start justify-between gap-4 lg:flex">
                <div>
                  {eyebrow ? (
                    <p className="mb-1 text-[0.7rem] uppercase tracking-[0.18em] text-muted">
                      {eyebrow}
                    </p>
                  ) : null}
                  <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
                  {subtitle ? <p className="mt-1.5 max-w-2xl text-sm text-muted">{subtitle}</p> : null}
                </div>
                {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
              </header>
            ) : null}
            <div className="animate-rise flex-1">{children}</div>
          </main>

          {/* Composer / slot acima da tab bar (mobile + desktop assistente) */}
          {bottomSlot ? (
            <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 px-3 lg:static lg:bottom-auto lg:z-auto lg:border-t lg:border-border lg:bg-background lg:px-10 lg:py-4">
              {bottomSlot}
            </div>
          ) : null}

          {/* Mobile bottom tab bar — estilo app */}
          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
            <ul className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-2">
              {TAB_NAV.map((item) => {
                const active = pathname === item.href
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={[
                        'flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[0.68rem] transition-colors',
                        active ? 'bg-gold-soft font-medium text-gold' : 'text-muted',
                      ].join(' ')}
                    >
                      <Icon size={20} strokeWidth={1.75} />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { ProShell } from '../_components/ProShell'

type Filter = 'todos' | 'leads' | 'reativar'

export default function ProClientesPage() {
  const [clients, setClients] = useState<{ name: string }[]>([])
  const [connected, setConnected] = useState(true)
  const [filter, setFilter] = useState<Filter>('todos')
  const [q, setQ] = useState('')

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/pro/clientes', { credentials: 'include' })
      if (res.status === 409) {
        setConnected(false)
        setClients([])
        return
      }
      const json = await res.json()
      if (res.ok) {
        setConnected(true)
        setClients(json.data?.clients ?? [])
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return clients.filter((c) => !query || c.name.toLowerCase().includes(query))
  }, [clients, q])

  return (
    <ProShell
      eyebrow="Clientes"
      title="Meus clientes"
      subtitle="Só a sua carteira — nada do restante do salão."
    >
      <section className="pro-card p-5">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['todos', 'Todos'],
              ['leads', 'Leads quentes'],
              ['reativar', 'Reativar'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="pro-chip"
              data-active={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="relative mt-4 block">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            className="pro-input pl-10"
            placeholder="Buscar nome ou telefone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>

        <div className="mt-5 hidden grid-cols-5 gap-3 border-b border-border pb-2 text-[0.65rem] uppercase tracking-[0.16em] text-gold sm:grid">
          <span>Cliente</span>
          <span>Telefone</span>
          <span>Último serviço</span>
          <span>Última visita</span>
          <span>Valor</span>
        </div>

        {!connected || filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            Nenhum cliente ainda.{' '}
            <Link href="/pro/conectar" className="font-medium text-gold hover:underline">
              Conecte a agenda
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <li
                key={c.name}
                className="grid gap-1 py-3 text-sm sm:grid-cols-5 sm:items-center sm:gap-3"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-muted">—</span>
                <span className="text-muted">—</span>
                <span className="text-muted">—</span>
                <span className="text-muted">—</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ProShell>
  )
}

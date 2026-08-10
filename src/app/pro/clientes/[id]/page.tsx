'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { formatCurrency, formatVisitDate } from '@/lib/salon/format'
import { ProShell } from '../../_components/ProShell'
import { proFetch, ProSessionExpiredError } from '../../_lib/pro-fetch'

interface Dossier {
  contactId: string
  name: string | null
  phone: string | null
  preferredManicurist: string | null
  preferredHairstylist: string | null
  notes: string | null
  lastVisit: {
    serviceName: string
    professionalName: string | null
    price: number | null
    doneAt: string
  } | null
  recentVisits: {
    serviceName: string
    professionalName: string | null
    price: number | null
    doneAt: string
  }[]
  recentProducts: {
    productName: string
    brand: string | null
    productKind: string | null
    professionalName: string | null
    usedAt: string
    kind: string
  }[]
  anamnese: Record<string, unknown> | null
}

function displayPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  return phone.trim()
}

export default function ProClienteDossierPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = typeof params?.id === 'string' ? params.id : ''
  const [dossier, setDossier] = useState<Dossier | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    void (async () => {
      try {
        const res = await proFetch(`/api/pro/clientes/${encodeURIComponent(id)}`)
        if (res.status === 409) {
          router.push('/pro/conectar')
          return
        }
        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? 'Cliente não encontrado')
          return
        }
        setDossier(json.data?.dossier ?? null)
      } catch (e) {
        if (e instanceof ProSessionExpiredError) {
          router.push(`/login?next=/pro/clientes/${id}`)
          return
        }
        setError(e instanceof Error ? e.message : 'Falha ao carregar dossiê')
      } finally {
        setLoading(false)
      }
    })()
  }, [id, router])

  const anamneseEntries = dossier?.anamnese
    ? Object.entries(dossier.anamnese).filter(
        ([k, v]) => v != null && String(v).trim() !== '' && !['cliente_id', 'id', 'cliente'].includes(k),
      )
    : []

  return (
    <ProShell
      eyebrow="Dossiê"
      title={dossier?.name?.trim() || 'Cliente'}
      subtitle="Contexto na cadeira — visitas, produtos e preferências."
      actions={
        <Link href="/pro/clientes" className="inline-flex items-center gap-1 text-sm text-gold hover:underline">
          <ArrowLeft size={16} /> Lista
        </Link>
      }
    >
      {error ? <p className="mb-4 text-sm text-danger">{error}</p> : null}

      {loading ? (
        <div className="animate-pulse space-y-3 py-6">
          <div className="h-4 w-2/3 rounded bg-border" />
          <div className="h-4 w-full rounded bg-border" />
          <div className="h-4 w-1/2 rounded bg-border" />
        </div>
      ) : dossier ? (
        <div className="space-y-4">
          <section className="pro-card space-y-2 p-5 text-sm">
            <p>
              <span className="text-muted">Telefone</span>
              <br />
              {displayPhone(dossier.phone)}
            </p>
            <p>
              <span className="text-muted">Manicure preferida</span>
              <br />
              {dossier.preferredManicurist?.trim() || '—'}
            </p>
            <p>
              <span className="text-muted">Cabeleireiro preferido</span>
              <br />
              {dossier.preferredHairstylist?.trim() || '—'}
            </p>
            {dossier.lastVisit ? (
              <p>
                <span className="text-muted">Última visita</span>
                <br />
                {formatVisitDate(dossier.lastVisit.doneAt)} · {dossier.lastVisit.serviceName}
                {dossier.lastVisit.professionalName
                  ? ` · ${dossier.lastVisit.professionalName}`
                  : ''}
                {dossier.lastVisit.price != null
                  ? ` · ${formatCurrency(dossier.lastVisit.price)}`
                  : ''}
              </p>
            ) : null}
            {dossier.notes?.trim() ? (
              <p>
                <span className="text-muted">Notas</span>
                <br />
                {dossier.notes}
              </p>
            ) : null}
          </section>

          <section className="pro-card p-5">
            <h2 className="text-[0.65rem] uppercase tracking-[0.16em] text-gold">Serviços realizados</h2>
            {dossier.recentVisits.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Ainda sem histórico (aguarde sync full).</p>
            ) : (
              <ul className="mt-3 divide-y divide-border text-sm">
                {dossier.recentVisits.slice(0, 20).map((v, i) => (
                  <li key={`${v.doneAt}-${v.serviceName}-${i}`} className="py-2">
                    <span className="font-medium">{v.serviceName}</span>
                    <span className="block text-muted">
                      {formatVisitDate(v.doneAt)}
                      {v.professionalName ? ` · ${v.professionalName}` : ''}
                      {v.price != null ? ` · ${formatCurrency(v.price)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="pro-card p-5">
            <h2 className="text-[0.65rem] uppercase tracking-[0.16em] text-gold">
              Produtos usados
            </h2>
            {dossier.recentProducts.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nenhum produto em comanda no período syncado.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border text-sm">
                {dossier.recentProducts.slice(0, 20).map((p, i) => (
                  <li key={`${p.usedAt}-${p.productName}-${i}`} className="py-2">
                    <span className="font-medium">{p.productName}</span>
                    <span className="block text-muted">
                      {[p.productKind, p.brand, formatVisitDate(p.usedAt), p.kind]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {anamneseEntries.length > 0 ? (
            <section className="pro-card p-5">
              <h2 className="text-[0.65rem] uppercase tracking-[0.16em] text-gold">Anamnese</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {anamneseEntries.slice(0, 24).map(([k, v]) => (
                  <li key={k}>
                    <span className="text-muted">{k}</span>
                    <br />
                    {String(v)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </ProShell>
  )
}

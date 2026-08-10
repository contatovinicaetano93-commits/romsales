/**
 * Camada DOSSIER do sync Avec — memória do cliente para o profissional.
 * Roda só no mode=full. Soft-skip se relatório não mapeado / sem REST.
 *
 * Ver docs/CLIENT_DOSSIER_SYNC.md
 */

import { getSql } from '@/lib/db'
import {
  fetchAllAvecReport,
  formatTruncationWarning,
  periodRange,
  avecSiteParam,
} from '@/lib/avec/client'
import {
  normalizeServiceHistoryRow,
  normalizeProductUseRow,
  normalizeAnamneseRow,
  guessServiceCategory,
  isNailService,
  isHairService,
} from '@/lib/avec/normalize'
import { getDossierReports, resolveReportId } from '@/lib/avec/registry'
import { saveReportSnapshot } from '@/lib/avec/snapshots'
import {
  upsertContact,
  setPreferredManicurist,
  setPreferredHairstylist,
} from '@/lib/contacts'

export type DossierSyncStats = {
  snapshots_saved: number
  errors: string[]
  warnings: string[]
  visits_upserted?: number
  product_uses_upserted?: number
  anamnese_upserted?: number
  prefs_recomputed?: number
}

async function snapshotSafe(
  reportId: string,
  params: Record<string, unknown>,
  rows: Record<string, unknown>[],
  stats: DossierSyncStats,
  syncRunId?: string,
) {
  try {
    await saveReportSnapshot(reportId, params, rows, syncRunId)
    stats.snapshots_saved++
  } catch (e) {
    stats.warnings.push(`snapshot ${reportId}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

function warnIfTruncated(
  stats: DossierSyncStats,
  reportId: string,
  result: Awaited<ReturnType<typeof fetchAllAvecReport>>,
) {
  if (result.truncated) stats.warnings.push(formatTruncationWarning(reportId, result))
}

async function resolveContact(input: {
  avecClientId: string | null
  clientName: string | null
  phone: string | null
  source: string
}) {
  if (!input.avecClientId && !input.clientName && !input.phone) return null
  return upsertContact({
    avecClientId: input.avecClientId ?? undefined,
    name: input.clientName,
    phone: input.phone,
    channel: 'avec',
    source: input.source,
  })
}

export function visitDedupeKey(
  contactId: string,
  doneAt: string,
  serviceName: string,
  professional: string | null,
) {
  return `${contactId}|${doneAt}|${serviceName.trim().toLowerCase()}|${(professional ?? '').trim().toLowerCase()}`
}

function productDedupeKey(
  contactId: string,
  usedAt: string,
  productName: string,
  professional: string | null,
  comandaId: string | null,
) {
  return `${contactId}|${usedAt}|${productName.trim().toLowerCase()}|${(professional ?? '').trim().toLowerCase()}|${comandaId ?? ''}`
}

/** Também usado pelo sync fast (0002) para não perder visita do dia. */
export async function upsertClientVisit(input: {
  contactId: string
  avecClientId: string | null
  avecComandaId: string | null
  serviceName: string
  professional: string | null
  price: number | null
  doneAt: string
  source: string
}) {
  const sql = getSql()
  const category = guessServiceCategory(input.serviceName)
  const dedupeKey = visitDedupeKey(
    input.contactId,
    input.doneAt,
    input.serviceName,
    input.professional,
  )
  await sql`
    insert into client_visits (
      contact_id, avec_client_id, avec_comanda_id, service_name, category,
      professional_name, price, done_at, source, dedupe_key
    ) values (
      ${input.contactId}::uuid,
      ${input.avecClientId},
      ${input.avecComandaId},
      ${input.serviceName},
      ${category},
      ${input.professional},
      ${input.price},
      ${input.doneAt}::timestamptz,
      ${input.source},
      ${dedupeKey}
    )
    on conflict (dedupe_key)
    do update set
      price = coalesce(excluded.price, client_visits.price),
      avec_comanda_id = coalesce(excluded.avec_comanda_id, client_visits.avec_comanda_id),
      category = excluded.category,
      source = excluded.source
  `
}

async function upsertProductUse(input: {
  contactId: string
  avecClientId: string | null
  avecComandaId: string | null
  productName: string
  brand: string | null
  productKind: string | null
  quantity: number | null
  professional: string | null
  usedAt: string
  kind: string
  source: string
}) {
  const sql = getSql()
  const dedupeKey = productDedupeKey(
    input.contactId,
    input.usedAt,
    input.productName,
    input.professional,
    input.avecComandaId,
  )
  await sql`
    insert into client_product_uses (
      contact_id, avec_client_id, avec_comanda_id, product_name, brand, product_kind,
      quantity, professional_name, used_at, kind, source, dedupe_key
    ) values (
      ${input.contactId}::uuid,
      ${input.avecClientId},
      ${input.avecComandaId},
      ${input.productName},
      ${input.brand},
      ${input.productKind},
      ${input.quantity},
      ${input.professional},
      ${input.usedAt}::timestamptz,
      ${input.kind},
      ${input.source},
      ${dedupeKey}
    )
    on conflict (dedupe_key)
    do update set
      brand = coalesce(excluded.brand, client_product_uses.brand),
      product_kind = coalesce(excluded.product_kind, client_product_uses.product_kind),
      quantity = coalesce(excluded.quantity, client_product_uses.quantity),
      kind = excluded.kind,
      source = excluded.source
  `
}

async function syncServiceHistory(stats: DossierSyncStats, syncRunId?: string) {
  const def = getDossierReports().find((r) => r.mapper === 'service_history')
  if (!def) return
  const reportId = resolveReportId(def)
  if (!reportId) return

  // 90 dias — memória útil sem estourar Athena/Vercel.
  const range = periodRange(90, 0)
  const params = { ...range, site: avecSiteParam(), limit: 250 }
  let result: Awaited<ReturnType<typeof fetchAllAvecReport>>
  try {
    result = await fetchAllAvecReport(reportId, params)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('ainda não mapeia')) {
      stats.warnings.push(`Dossiê serviços (${reportId}): ${msg}`)
      return
    }
    throw e
  }
  warnIfTruncated(stats, reportId, result)
  await snapshotSafe(reportId, params, result.rows, stats, syncRunId)

  let n = 0
  for (const row of result.rows) {
    try {
      const v = normalizeServiceHistoryRow(row)
      if (!v) continue
      const contact = await resolveContact({
        avecClientId: v.avecClientId,
        clientName: v.clientName,
        phone: v.phone,
        source: 'avec_dossier_0031',
      })
      if (!contact) continue
      await upsertClientVisit({
        contactId: contact.id,
        avecClientId: v.avecClientId,
        avecComandaId: v.avecComandaId,
        serviceName: v.serviceName,
        professional: v.professional,
        price: v.price,
        doneAt: v.doneAt,
        source: `avec_${reportId}`,
      })
      n++
    } catch (e) {
      stats.errors.push(`visita: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  stats.visits_upserted = (stats.visits_upserted ?? 0) + n
}

async function syncProductUses(stats: DossierSyncStats, syncRunId?: string) {
  const def = getDossierReports().find((r) => r.mapper === 'product_uses')
  if (!def) return
  const reportId = resolveReportId(def)
  if (!reportId) return

  const range = periodRange(90, 0)
  const params = { ...range, site: avecSiteParam(), limit: 250 }
  let result: Awaited<ReturnType<typeof fetchAllAvecReport>>
  try {
    result = await fetchAllAvecReport(reportId, params)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('ainda não mapeia')) {
      stats.warnings.push(`Dossiê produtos (${reportId}): ${msg}`)
      return
    }
    throw e
  }
  warnIfTruncated(stats, reportId, result)
  await snapshotSafe(reportId, params, result.rows, stats, syncRunId)

  let n = 0
  for (const row of result.rows) {
    try {
      const p = normalizeProductUseRow(row)
      if (!p) continue
      const contact = await resolveContact({
        avecClientId: p.avecClientId,
        clientName: p.clientName,
        phone: p.phone,
        source: 'avec_dossier_0246',
      })
      if (!contact) continue
      await upsertProductUse({
        contactId: contact.id,
        avecClientId: p.avecClientId,
        avecComandaId: p.avecComandaId,
        productName: p.productName,
        brand: p.brand,
        productKind: p.productKind,
        quantity: p.quantity,
        professional: p.professional,
        usedAt: p.usedAt,
        kind: p.kind,
        source: `avec_${reportId}`,
      })
      n++
    } catch (e) {
      stats.errors.push(`produto: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  stats.product_uses_upserted = (stats.product_uses_upserted ?? 0) + n
}

async function syncAnamnese(stats: DossierSyncStats, syncRunId?: string) {
  const def = getDossierReports().find((r) => r.mapper === 'anamnese')
  if (!def) return
  const reportId = resolveReportId(def)
  if (!reportId) return

  // 0115 usa idStart (cursor), não período.
  const params = { idStart: '0', site: avecSiteParam(), limit: 250 }
  let result: Awaited<ReturnType<typeof fetchAllAvecReport>>
  try {
    result = await fetchAllAvecReport(reportId, params)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('ainda não mapeia') || msg.includes('AVEC_API_TOKEN')) {
      stats.warnings.push(`Anamnese (${reportId}): ${msg}`)
      return
    }
    throw e
  }
  warnIfTruncated(stats, reportId, result)
  await snapshotSafe(reportId, params, result.rows, stats, syncRunId)

  const sql = getSql()
  let n = 0
  for (const row of result.rows) {
    try {
      const a = normalizeAnamneseRow(row)
      if (!a) continue
      const contact = await resolveContact({
        avecClientId: a.avecClientId,
        clientName: a.clientName,
        phone: null,
        source: 'avec_dossier_0115',
      })
      if (!contact) continue
      await sql`
        insert into contact_clinical (contact_id, anamnese, source, updated_at)
        values (
          ${contact.id}::uuid,
          ${JSON.stringify(a.fields)}::jsonb,
          ${`avec_${reportId}`},
          now()
        )
        on conflict (contact_id) do update set
          anamnese = excluded.anamnese,
          source = excluded.source,
          updated_at = now()
      `
      n++
    } catch (e) {
      stats.errors.push(`anamnese: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  stats.anamnese_upserted = (stats.anamnese_upserted ?? 0) + n
}

/**
 * Preferidos = profissional mais frequente nos últimos 180d por categoria unha/cabelo.
 * Só preenche se ainda vazio (não sobrescreve ajuste manual futuro).
 */
async function recomputePreferences(stats: DossierSyncStats) {
  const sql = getSql()
  try {
    const rows = (await sql`
      select contact_id, service_name, professional_name
      from client_visits
      where done_at > now() - interval '180 days'
        and professional_name is not null
        and professional_name <> ''
    `) as { contact_id: string; service_name: string; professional_name: string }[]

    const byContact = new Map<
      string,
      { nail: Map<string, number>; hair: Map<string, number> }
    >()
    for (const r of rows) {
      const pro = r.professional_name.trim()
      if (!pro) continue
      let bucket = byContact.get(r.contact_id)
      if (!bucket) {
        bucket = { nail: new Map(), hair: new Map() }
        byContact.set(r.contact_id, bucket)
      }
      if (isNailService(r.service_name)) {
        bucket.nail.set(pro, (bucket.nail.get(pro) ?? 0) + 1)
      } else if (isHairService(r.service_name)) {
        bucket.hair.set(pro, (bucket.hair.get(pro) ?? 0) + 1)
      }
    }

    function top(m: Map<string, number>): string | null {
      let best: string | null = null
      let n = 0
      for (const [name, count] of m) {
        if (count > n) {
          best = name
          n = count
        }
      }
      return best
    }

    let updated = 0
    for (const [contactId, bucket] of byContact) {
      const nail = top(bucket.nail)
      const hair = top(bucket.hair)
      if (nail) {
        await setPreferredManicurist(contactId, nail)
        updated++
      }
      if (hair) {
        await setPreferredHairstylist(contactId, hair)
        updated++
      }
    }
    stats.prefs_recomputed = updated
  } catch (e) {
    stats.warnings.push(`prefs: ${e instanceof Error ? e.message : String(e)}`)
  }
}

/** Full sync — histórico + produtos + anamnese (soft). */
export async function syncClientDossier(stats: DossierSyncStats, syncRunId?: string) {
  stats.visits_upserted = stats.visits_upserted ?? 0
  stats.product_uses_upserted = stats.product_uses_upserted ?? 0
  stats.anamnese_upserted = stats.anamnese_upserted ?? 0

  for (const [label, fn] of [
    ['serviços', () => syncServiceHistory(stats, syncRunId)],
    ['produtos', () => syncProductUses(stats, syncRunId)],
    ['anamnese', () => syncAnamnese(stats, syncRunId)],
  ] as const) {
    try {
      await fn()
    } catch (e) {
      stats.errors.push(`Dossiê ${label}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  await recomputePreferences(stats)
}

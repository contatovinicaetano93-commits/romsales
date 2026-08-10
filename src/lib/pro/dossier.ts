import { getSql } from '@/lib/db'
import { isValidRomPanelId } from '@/lib/brand'
import { Observability } from '@/lib/observability'

export interface ProClientVisit {
  serviceName: string
  professionalName: string | null
  price: number | null
  doneAt: string
}

export interface ProClientProductUse {
  productName: string
  brand: string | null
  productKind: string | null
  professionalName: string | null
  usedAt: string
  kind: string
}

export interface ProClientDossier {
  contactId: string
  name: string | null
  phone: string | null
  preferredManicurist: string | null
  preferredHairstylist: string | null
  notes: string | null
  lastVisit: ProClientVisit | null
  recentVisits: ProClientVisit[]
  recentProducts: ProClientProductUse[]
  anamnese: Record<string, unknown> | null
}

/**
 * Dossiê completo para a cadeira — visitas, produtos, prefs, anamnese.
 * Fonte: unit-sync (client_visits / client_product_uses / contact_clinical).
 */
export async function getProClientDossier(
  contactId: string,
  panel?: string,
): Promise<ProClientDossier | null> {
  const sql = getSql(isValidRomPanelId(panel) ? panel : undefined)

  try {
    const contacts = (await sql`
      select id, name, phone, notes, preferred_manicurist, preferred_hairstylist
      from contacts
      where id = ${contactId}::uuid
        and anonymized_at is null
      limit 1
    `) as {
      id: string
      name: string | null
      phone: string | null
      notes: string | null
      preferred_manicurist: string | null
      preferred_hairstylist: string | null
    }[]
    const contact = contacts[0]
    if (!contact) return null

    const visits = (await sql`
      select service_name, professional_name, price, done_at
      from client_visits
      where contact_id = ${contactId}::uuid
      order by done_at desc
      limit 40
    `) as {
      service_name: string
      professional_name: string | null
      price: number | null
      done_at: string
    }[]

    const products = (await sql`
      select product_name, brand, product_kind, professional_name, used_at, kind
      from client_product_uses
      where contact_id = ${contactId}::uuid
      order by used_at desc
      limit 40
    `) as {
      product_name: string
      brand: string | null
      product_kind: string | null
      professional_name: string | null
      used_at: string
      kind: string
    }[]

    const clinical = (await sql`
      select anamnese from contact_clinical
      where contact_id = ${contactId}::uuid
      limit 1
    `) as { anamnese: Record<string, unknown> | null }[]

    const recentVisits: ProClientVisit[] = visits.map((v) => ({
      serviceName: v.service_name,
      professionalName: v.professional_name,
      price: v.price != null ? Number(v.price) : null,
      doneAt: v.done_at,
    }))

    return {
      contactId: contact.id,
      name: contact.name,
      phone: contact.phone,
      preferredManicurist: contact.preferred_manicurist,
      preferredHairstylist: contact.preferred_hairstylist,
      notes: contact.notes,
      lastVisit: recentVisits[0] ?? null,
      recentVisits,
      recentProducts: products.map((p) => ({
        productName: p.product_name,
        brand: p.brand,
        productKind: p.product_kind,
        professionalName: p.professional_name,
        usedAt: p.used_at,
        kind: p.kind,
      })),
      anamnese: clinical[0]?.anamnese ?? null,
    }
  } catch (e) {
    Observability.captureException(e instanceof Error ? e : new Error(String(e)), {
      scope: 'pro.getProClientDossier',
      panel: panel ?? null,
    })
    return null
  }
}

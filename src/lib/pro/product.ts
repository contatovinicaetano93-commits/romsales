import { getBrand, getRomPanelId, type RomPanelId } from '@/lib/brand'

/** Marca do produto Romsales (app do profissional) — sem HairSales/Vitrini. */
export function getRomsalesProduct(panel?: RomPanelId) {
  const brand = getBrand(panel ?? getRomPanelId())
  return {
    productName: 'Romsales',
    unitName: brand.displayName,
    panel: brand.panel,
    tagline: `Agenda, clientes e meta do profissional · ${brand.displayName}`,
    landingHeadline: 'Seu painel de clientes, agenda e ações',
    landingSupport: `Uso interno · ${brand.displayName}`,
    assistantName: 'Assistente Romsales',
  }
}

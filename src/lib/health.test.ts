import { beforeEach, describe, expect, it, vi } from 'vitest'

const sqlMock = vi.fn(async (strings: TemplateStringsArray) => {
  const q = strings.join('')
  if (q.includes('select 1')) return [{ ok: 1 }]
  return []
})

vi.mock('@/lib/db', () => ({
  getSql: () => sqlMock,
}))
vi.mock('@/lib/avec/sync', () => ({ getLastAvecSync: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/avec/sync-stock', () => ({ getLastStockSync: vi.fn().mockResolvedValue(null) }))

const REAL_TOKEN = 'segredo-super-sensivel-avec-nao-pode-vazar'

describe('getHealthStatus — token da Avec nunca sai em texto plano', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.AVEC_API_TOKEN = REAL_TOKEN
    process.env.DATABASE_URL = 'postgres://fake'
  })

  it('avec.token é sempre booleano, nunca o valor real do env', async () => {
    const { getHealthStatus } = await import('@/lib/health')
    const status = await getHealthStatus()
    expect(typeof status.avec.token).toBe('boolean')
    expect(status.avec.token).toBe(true)

    // Garante que o segredo não aparece em nenhum lugar da resposta serializada.
    const serialized = JSON.stringify(status)
    expect(serialized).not.toContain(REAL_TOKEN)
  })

  it('getPublicHealthStatus (sem login) não expõe nenhum dado sensível', async () => {
    const { getPublicHealthStatus } = await import('@/lib/health')
    const status = await getPublicHealthStatus()
    expect(Object.keys(status)).toEqual(['ok'])
    expect(JSON.stringify(status)).not.toContain(REAL_TOKEN)
  })
})

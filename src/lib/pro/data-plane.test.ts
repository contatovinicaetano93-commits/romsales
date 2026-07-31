import { afterEach, describe, expect, it } from 'vitest'
import { getProDataPlaneMode, normalizeProName } from './data-plane'

describe('normalizeProName', () => {
  it('ignora case, acentos e espaços extras', () => {
    expect(normalizeProName('  Romeu  Felipe ')).toBe('romeu felipe')
    expect(normalizeProName('José Antônio')).toBe('jose antonio')
    expect(normalizeProName('ROMEÚ FELIPE')).toBe('romeu felipe')
  })
})

describe('getProDataPlaneMode', () => {
  const original = process.env.ROMSALES_DATA_PLANE

  afterEach(() => {
    if (original == null) {
      delete process.env.ROMSALES_DATA_PLANE
    } else {
      process.env.ROMSALES_DATA_PLANE = original
    }
  })

  it('defaults to unit-sync', () => {
    delete process.env.ROMSALES_DATA_PLANE

    expect(getProDataPlaneMode()).toBe('unit-sync')
  })

  it('only accepts the current unit-sync data plane', () => {
    process.env.ROMSALES_DATA_PLANE = 'personal-avec'
    expect(getProDataPlaneMode()).toBe('unit-sync')

    process.env.ROMSALES_DATA_PLANE = 'unit-sync'
    expect(getProDataPlaneMode()).toBe('unit-sync')
  })
})

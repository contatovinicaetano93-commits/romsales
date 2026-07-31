import { describe, expect, it } from 'vitest'
import { salonWallTimeToUtcIso, toSalonDateIso } from './format'

describe('toSalonDateIso', () => {
  it('converte instante perto da meia-noite SP sem usar slice UTC', () => {
    // 2026-07-10 02:30 UTC = 2026-07-09 23:30 em America/Sao_Paulo
    expect(toSalonDateIso('2026-07-10T02:30:00.000Z')).toBe('2026-07-09')
    // 2026-07-10 03:30 UTC = 2026-07-10 00:30 SP
    expect(toSalonDateIso('2026-07-10T03:30:00.000Z')).toBe('2026-07-10')
  })

  it('retorna null para inválido', () => {
    expect(toSalonDateIso(null)).toBeNull()
    expect(toSalonDateIso('não-é-data')).toBeNull()
  })
})

describe('salonWallTimeToUtcIso', () => {
  it('trata madrugada BRT sem cair no dia anterior', () => {
    // 31/07/2026 01:00 America/Sao_Paulo = 31/07/2026 04:00 UTC
    expect(salonWallTimeToUtcIso(2026, 6, 31, 1, 0)).toBe('2026-07-31T04:00:00.000Z')
    expect(toSalonDateIso(salonWallTimeToUtcIso(2026, 6, 31, 1, 0))).toBe('2026-07-31')
  })

  it('mantém tarde BRT no mesmo dia', () => {
    expect(salonWallTimeToUtcIso(2026, 2, 10, 14, 0)).toBe('2026-03-10T17:00:00.000Z')
  })
})

import { describe, expect, it } from 'vitest'
import {
  conferProfessional,
  conferAgainstNames,
  avecNameBelongsToConnectedPro,
  collectMatchedAvecNames,
} from '@/lib/pro/confer-professional'

describe('conferProfessional — roster Brasil (ROM Central)', () => {
  it('casa Romeu Felipe (canônico)', () => {
    const p = conferProfessional('romeu felipe', 'brasil')
    expect(p?.name).toBe('Romeu Felipe')
    expect(p?.id).toBe('pro-romeu-felipe')
  })

  it('casa prefixo único', () => {
    expect(conferProfessional('Walter', 'brasil')?.name).toBe('Walter Leal')
  })

  it('não adivinha Lucas ambíguo', () => {
    expect(conferProfessional('Lucas', 'brasil')).toBeNull()
    expect(conferProfessional('Lucas Sales', 'brasil')?.name).toBe('Lucas Sales')
  })

  it('Iguatemi vazio → null no roster (fallback é sync)', () => {
    expect(conferProfessional('Qualquer', 'iguatemi')).toBeNull()
  })
})

describe('conferAgainstNames — fallback sync', () => {
  it('casa nome Avec com a mesma lógica de match-pro', () => {
    const hit = conferAgainstNames('Ana Clara', ['Ana Clara', 'Bruno Silva'])
    expect(hit?.name).toBe('Ana Clara')
  })

  it('não adivinha homônimo', () => {
    expect(conferAgainstNames('Ana', ['Ana Clara', 'Ana Paula'])).toBeNull()
  })
})

describe('avecNameBelongsToConnectedPro', () => {
  it('variante Avec bate no canônico conectado', () => {
    expect(avecNameBelongsToConnectedPro('Romeu Felipe', 'Romeu Felipe', 'brasil')).toBe(true)
    expect(avecNameBelongsToConnectedPro('ROMEU FELIPE', 'Romeu Felipe', 'brasil')).toBe(true)
  })

  it('outro profissional do roster não bate', () => {
    expect(avecNameBelongsToConnectedPro('Walter Leal', 'Romeu Felipe', 'brasil')).toBe(false)
  })
})

describe('collectMatchedAvecNames', () => {
  it('filtra só variantes do conectado', () => {
    const names = collectMatchedAvecNames(
      ['Romeu Felipe', 'Walter Leal', 'romeu felipe', 'Outro'],
      'Romeu Felipe',
      'brasil',
    )
    expect(names).toEqual(['Romeu Felipe', 'romeu felipe'])
  })
})

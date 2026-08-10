import { describe, expect, it } from 'vitest'
import {
  guessProductKind,
  normalizeProductUseRow,
  normalizeServiceHistoryRow,
  normalizeAnamneseRow,
} from '@/lib/avec/normalize'

describe('guessProductKind', () => {
  it('classifica tintura / shampoo / creme', () => {
    expect(guessProductKind('Tintura Igora 6.0')).toBe('tintura')
    expect(guessProductKind('Shampoo Nutritivo')).toBe('shampoo')
    expect(guessProductKind('Creme de pentear')).toBe('creme')
  })
})

describe('normalizeServiceHistoryRow', () => {
  it('aceita linha estilo Lake 0031', () => {
    const v = normalizeServiceHistoryRow({
      cliente_id: '99',
      cliente_nome: 'Ana',
      celular: '11999998888',
      servico: 'Escova',
      data: '10/07/2026',
      hora: '12:00',
      profissional: 'Romeu Felipe',
      valor: 120,
      comanda_id: '555',
    })
    expect(v).not.toBeNull()
    expect(v!.serviceName).toBe('Escova')
    expect(v!.professional).toBe('Romeu Felipe')
    expect(v!.avecComandaId).toBe('555')
    expect(v!.doneAt).toBeTruthy()
  })

  it('ignora linha sem serviço/data', () => {
    expect(normalizeServiceHistoryRow({ cliente_nome: 'Ana' })).toBeNull()
  })
})

describe('normalizeProductUseRow', () => {
  it('aceita produto em comanda', () => {
    const p = normalizeProductUseRow({
      cliente_id: '10',
      cliente_nome: 'Bia',
      produto: 'Shampoo Kerastase',
      data: '01/08/2026',
      profissional: 'Romeu Felipe',
      quantidade: 1,
      tipo: 'produtos',
      comanda_id: '77',
    })
    expect(p).not.toBeNull()
    expect(p!.productName).toContain('Shampoo')
    expect(p!.productKind).toBe('shampoo')
    expect(p!.kind).toBe('consumo')
  })
})

describe('normalizeAnamneseRow', () => {
  it('empacota campos livres', () => {
    const a = normalizeAnamneseRow({
      cliente_id: '1',
      cliente: 'Carla',
      alergia: 'amônia',
      observacao: 'pele sensível',
    })
    expect(a?.avecClientId).toBe('1')
    expect(a?.fields.alergia).toBe('amônia')
  })
})

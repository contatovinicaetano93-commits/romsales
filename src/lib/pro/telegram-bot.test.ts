import { describe, expect, it } from 'vitest'
import {
  formatClientesSummary,
  formatHojeSummary,
  formatMetaSummary,
  helpMessage,
  parseStartPayload,
  ROMSALES_BOT_COMMANDS,
} from '@/lib/pro/telegram-bot'
import type { ProHojeSummary } from '@/lib/pro/data-plane'

const summary: ProHojeSummary = {
  professionalName: 'Maria',
  day: '2026-07-19',
  appointments: 4,
  attended: 2,
  revenue: 800,
  dailyGoal: 1000,
  weeklyGoal: 5000,
  goalPct: 80,
  clients: [{ name: 'Ana' }, { name: 'Bia' }],
  note: 'ok',
  connected: true,
  dataSource: 'unit-sync',
}

describe('Romsales telegram bot helpers', () => {
  it('formats hoje summary', () => {
    const text = formatHojeSummary(summary)
    expect(text).toContain('Maria')
    expect(text).toContain('4 horário')
    expect(text).toContain('80%')
  })

  it('formats meta summary', () => {
    const text = formatMetaSummary(summary)
    expect(text).toContain('Dia:')
    expect(text).toContain('Semana:')
  })

  it('formats clientes summary', () => {
    expect(formatClientesSummary(summary)).toContain('• Ana')
    expect(
      formatClientesSummary({ ...summary, clients: [] }),
    ).toMatch(/Nenhum cliente/)
  })

  it('exposes help and bot commands', () => {
    expect(helpMessage()).toContain('/hoje')
    expect(ROMSALES_BOT_COMMANDS.map((c) => c.command)).toContain('briefing')
  })

  it('parses /start with space, glued code, and underscore', () => {
    expect(parseStartPayload('/start a1b2c3d4e5f67890')?.code).toBe('a1b2c3d4e5f67890')
    expect(parseStartPayload('/starta1b2c3d4e5f67890')?.code).toBe('a1b2c3d4e5f67890')
    expect(parseStartPayload('/start_a1b2c3d4e5f67890')?.code).toBe('a1b2c3d4e5f67890')
    expect(parseStartPayload('/start30fe58')?.code).toBe('30fe58')
    expect(parseStartPayload('/start')?.code).toBeNull()
    expect(parseStartPayload('/hoje')).toBeNull()
  })
})

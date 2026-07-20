import { describe, expect, it } from 'vitest'
import { buildConnectorStatus } from '@/lib/pro/connectors'
import type { ProUserRow } from '@/lib/pro/store'

function makeUser(overrides: Partial<ProUserRow> = {}): ProUserRow {
  return {
    id: 'user-1',
    email: 'pro@example.com',
    full_name: 'Pro User',
    professional_name: null,
    panel: 'brasil',
    connected_at: null,
    telegram_linked: false,
    agenda_source: null,
    has_avec_token: false,
    avec_unit_id: null,
    daily_goal: null,
    weekly_goal: null,
    goals_saved_at: null,
    has_telegram_code: false,
    has_wa_token: false,
    wa_display_number: null,
    ai_used_today: 0,
    ai_quota_day: null,
    ...overrides,
  }
}

describe('buildConnectorStatus', () => {
  it('reports explicit unlinked states', () => {
    const status = buildConnectorStatus(makeUser())

    expect(status.agenda.status).toBe('unlinked')
    expect(status.telegram.status).toBe('unlinked')
    expect(status.whatsapp.status).toBe('unlinked')
    expect(status.whatsapp.messagingReady).toBe(false)
  })

  it('reports linked-unit-sync agenda and credentials-saved whatsapp', () => {
    const status = buildConnectorStatus(
      makeUser({
        professional_name: 'Maria',
        connected_at: '2026-07-19T00:00:00.000Z',
        has_avec_token: true,
        has_wa_token: true,
      }),
    )

    expect(status.agenda.status).toBe('linked-unit-sync')
    expect(status.agenda.dataPlane).toBe('unit-sync')
    expect(status.whatsapp.status).toBe('credentials-saved')
    expect(status.whatsapp.credentialsSaved).toBe(true)
    expect(status.whatsapp.linked).toBe(false)
    expect(status.whatsapp.messagingReady).toBe(false)
  })

  it('reports pending telegram when a link code exists', () => {
    const status = buildConnectorStatus(makeUser({ has_telegram_code: true }))

    expect(status.telegram.status).toBe('pending')
    expect(status.telegram.hasPendingCode).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { formatDatabaseError, isDatabaseQuotaError } from '@/lib/db-errors'

describe('isDatabaseQuotaError', () => {
  it('detecta Neon 402 quota', () => {
    expect(
      isDatabaseQuotaError(
        new Error(
          'Server error (HTTP status 402): {"message":"Your project has exceeded the data transfer quota."}',
        ),
      ),
    ).toBe(true)
  })

  it('ignora erro comum', () => {
    expect(isDatabaseQuotaError(new Error('relation does not exist'))).toBe(false)
  })
})

describe('formatDatabaseError', () => {
  it('mapeia quota para 503 acionável', () => {
    const mapped = formatDatabaseError(new Error('exceeded the data transfer quota'))
    expect(mapped.status).toBe(503)
    expect(mapped.message).toMatch(/Neon/)
  })
})

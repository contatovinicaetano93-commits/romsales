import { afterEach, describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret } from '@/lib/pro/secrets'

const ORIGINAL_SECRET = process.env.ROMSALES_CONNECTOR_SECRET
const ORIGINAL_VERCEL_ENV = process.env.VERCEL_ENV

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.ROMSALES_CONNECTOR_SECRET
  else process.env.ROMSALES_CONNECTOR_SECRET = ORIGINAL_SECRET

  if (ORIGINAL_VERCEL_ENV === undefined) delete process.env.VERCEL_ENV
  else process.env.VERCEL_ENV = ORIGINAL_VERCEL_ENV
})

describe('pro connector secrets', () => {
  it('encrypts and decrypts AES-GCM packed secrets', () => {
    process.env.ROMSALES_CONNECTOR_SECRET = 'test-secret'

    const packed = encryptSecret('avec-token-123')

    expect(packed).toMatch(/^v1:[^:]+:[^:]+:[^:]+$/)
    expect(packed).not.toContain('avec-token-123')
    expect(decryptSecret(packed)).toBe('avec-token-123')
  })

  it('passes through legacy plaintext values without v1 prefix', () => {
    expect(decryptSecret('legacy-plaintext-token')).toBe('legacy-plaintext-token')
  })

  it('requires ROMSALES_CONNECTOR_SECRET in production', () => {
    delete process.env.ROMSALES_CONNECTOR_SECRET
    process.env.VERCEL_ENV = 'production'

    expect(() => encryptSecret('secret')).toThrow('ROMSALES_CONNECTOR_SECRET')
  })
})

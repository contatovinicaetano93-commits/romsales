import { afterEach, describe, expect, it } from 'vitest'
import { brDateToIso, parseAvecLakeToken, shouldUseAvecLake } from '@/lib/avec/lake'

const SAMPLE_KEY = 'AKIAIOSFODNN7EXAMPLE'

describe('parseAvecLakeToken', () => {
  it('aceita Access Key sozinha', () => {
    expect(parseAvecLakeToken(SAMPLE_KEY)).toEqual({
      accessKeyId: SAMPLE_KEY,
    })
  })

  it('aceita AKIA|secret', () => {
    expect(parseAvecLakeToken(`${SAMPLE_KEY}|my-secret`)).toEqual({
      accessKeyId: SAMPLE_KEY,
      secretAccessKey: 'my-secret',
    })
  })

  it('aceita duas linhas', () => {
    expect(parseAvecLakeToken(`${SAMPLE_KEY}\nmy-secret`)).toEqual({
      accessKeyId: SAMPLE_KEY,
      secretAccessKey: 'my-secret',
    })
  })

  it('rejeita token REST comum', () => {
    expect(parseAvecLakeToken('abc123token')).toBeNull()
  })
})

describe('brDateToIso', () => {
  it('converte dd/mm/yyyy', () => {
    expect(brDateToIso('31/07/2026')).toBe('2026-07-31')
    expect(brDateToIso('1/7/2026')).toBe('2026-07-01')
  })
})

describe('shouldUseAvecLake', () => {
  const env = process.env

  afterEach(() => {
    process.env = env
  })

  it('auto usa lake quando credenciais existem', () => {
    process.env = {
      ...env,
      AVEC_DATA_SOURCE: 'auto',
      AVEC_LAKE_ACCESS_KEY_ID: SAMPLE_KEY,
      AVEC_LAKE_SECRET_ACCESS_KEY: 'secret',
    }
    expect(shouldUseAvecLake()).toBe(true)
  })

  it('rest força REST mesmo com lake', () => {
    process.env = {
      ...env,
      AVEC_DATA_SOURCE: 'rest',
      AVEC_LAKE_ACCESS_KEY_ID: SAMPLE_KEY,
      AVEC_LAKE_SECRET_ACCESS_KEY: 'secret',
    }
    expect(shouldUseAvecLake()).toBe(false)
  })
})

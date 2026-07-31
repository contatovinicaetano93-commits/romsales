import { afterEach, describe, expect, it } from 'vitest'
import {
  brDateToIso,
  isAvecLakeReady,
  isAvecLakeReportSupported,
  lakeTokenForStorage,
  parseAvecLakeToken,
  shouldUseAvecLake,
} from '@/lib/avec/lake'

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

describe('lakeTokenForStorage', () => {
  it('não persiste o secret AWS', () => {
    expect(lakeTokenForStorage(`${SAMPLE_KEY}|super-secret`)).toBe(`lake:${SAMPLE_KEY}`)
  })

  it('marca lake:unit para keyword', () => {
    expect(lakeTokenForStorage('lake')).toBe('lake:unit')
  })

  it('ignora token REST', () => {
    expect(lakeTokenForStorage('rest-token-xyz')).toBeNull()
  })
})

describe('isAvecLakeReportSupported', () => {
  it('mapeia P1/hoje e carteira', () => {
    expect(isAvecLakeReportSupported('0021')).toBe(true)
    expect(isAvecLakeReportSupported('0051')).toBe(true)
    expect(isAvecLakeReportSupported('0052')).toBe(true)
    expect(isAvecLakeReportSupported('revenue')).toBe(true)
  })

  it('não mapeia estoque/P2', () => {
    expect(isAvecLakeReportSupported('0149')).toBe(false)
    expect(isAvecLakeReportSupported('0056')).toBe(false)
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

  it('auto usa lake só quando keys + unit id + DB existem', () => {
    process.env = {
      ...env,
      AVEC_DATA_SOURCE: 'auto',
      AVEC_LAKE_ACCESS_KEY_ID: SAMPLE_KEY,
      AVEC_LAKE_SECRET_ACCESS_KEY: 'secret',
      AVEC_UNIT_ID: '40613',
      DATABASE_URL: 'postgres://localhost/test',
    }
    expect(isAvecLakeReady()).toBe(true)
    expect(shouldUseAvecLake()).toBe(true)
  })

  it('auto não usa lake só com keys (permite REST)', () => {
    process.env = {
      ...env,
      AVEC_DATA_SOURCE: 'auto',
      AVEC_LAKE_ACCESS_KEY_ID: SAMPLE_KEY,
      AVEC_LAKE_SECRET_ACCESS_KEY: 'secret',
      AVEC_UNIT_ID: '',
      DATABASE_URL: 'postgres://localhost/test',
    }
    delete process.env.AVEC_UNIT_ID
    expect(isAvecLakeReady()).toBe(false)
    expect(shouldUseAvecLake()).toBe(false)
  })

  it('rest força REST mesmo com lake completo', () => {
    process.env = {
      ...env,
      AVEC_DATA_SOURCE: 'rest',
      AVEC_LAKE_ACCESS_KEY_ID: SAMPLE_KEY,
      AVEC_LAKE_SECRET_ACCESS_KEY: 'secret',
      AVEC_UNIT_ID: '40613',
      DATABASE_URL: 'postgres://localhost/test',
    }
    expect(shouldUseAvecLake()).toBe(false)
  })

  it('lake força Athena mesmo sem credenciais (erro fica no fetch)', () => {
    process.env = {
      ...env,
      AVEC_DATA_SOURCE: 'lake',
      AVEC_LAKE_ACCESS_KEY_ID: '',
      AVEC_LAKE_SECRET_ACCESS_KEY: '',
    }
    delete process.env.AVEC_LAKE_ACCESS_KEY_ID
    delete process.env.AVEC_LAKE_SECRET_ACCESS_KEY
    expect(shouldUseAvecLake()).toBe(true)
  })
})

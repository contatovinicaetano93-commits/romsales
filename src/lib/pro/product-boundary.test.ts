import { describe, expect, it } from 'vitest'
import {
  getInfrastructureApiAccess,
  isAllowedInfrastructureApi,
  isProSurface,
  isTeamApiPath,
  isTeamUiPath,
} from '@/lib/pro/product-boundary'

describe('Romsales pro-only product boundary', () => {
  it('identifica UI de equipe bloqueada', () => {
    expect(isTeamUiPath('/dashboard')).toBe(true)
    expect(isTeamUiPath('/contatos/123')).toBe(true)
    expect(isTeamUiPath('/pro/hoje')).toBe(false)
  })

  it('identifica APIs de equipe incluindo auth legado', () => {
    expect(isTeamApiPath('/api/auth/login')).toBe(true)
    expect(isTeamApiPath('/api/contacts/123')).toBe(true)
    expect(isTeamApiPath('/api/pro/login')).toBe(false)
  })

  it('mantem superficie pro publicada', () => {
    expect(isProSurface('/')).toBe(true)
    expect(isProSurface('/login')).toBe(true)
    expect(isProSurface('/pro/conectar')).toBe(true)
    expect(isProSurface('/api/pro/register')).toBe(true)
    expect(isProSurface('/api/me/profile')).toBe(true)
    expect(isProSurface('/api/auth/session')).toBe(false)
  })

  it('mantem infraestrutura publica e cron separadas', () => {
    expect(getInfrastructureApiAccess('/api/health')).toBe('public')
    expect(getInfrastructureApiAccess('/api/webhooks/telegram-pro')).toBe('public')
    expect(getInfrastructureApiAccess('/api/webhooks/avec')).toBe('public')
    expect(getInfrastructureApiAccess('/api/avec/sync')).toBe('cron')
    expect(getInfrastructureApiAccess('/api/admin/migrations')).toBe('cron')
    expect(getInfrastructureApiAccess('/api/auth/session')).toBeNull()
    expect(isAllowedInfrastructureApi('/api/lgpd/purge')).toBe(true)
  })

  it('nao publica webhooks/cron da equipe no pro-only', () => {
    expect(getInfrastructureApiAccess('/api/webhooks/telegram')).toBeNull()
    expect(getInfrastructureApiAccess('/api/webhooks/telegram-staff')).toBeNull()
    expect(getInfrastructureApiAccess('/api/webhooks/telegram-financeiro')).toBeNull()
    expect(getInfrastructureApiAccess('/api/webhooks/whatsapp')).toBeNull()
    expect(getInfrastructureApiAccess('/api/estoque/sync')).toBeNull()
    expect(getInfrastructureApiAccess('/api/director-report')).toBeNull()
    expect(getInfrastructureApiAccess('/api/reminders/financeiro')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('pro password', () => {
  it('hash e verifica', () => {
    const stored = hashPassword('Senha@123')
    expect(verifyPassword('Senha@123', stored)).toBe(true)
    expect(verifyPassword('outra', stored)).toBe(false)
  })
})

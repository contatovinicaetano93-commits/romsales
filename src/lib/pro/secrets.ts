import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { isProduction } from '@/lib/env'

const PREFIX = 'v1'
const IV_BYTES = 12

function getConnectorSecret(): string {
  const configured = process.env.ROMSALES_CONNECTOR_SECRET?.trim()
  if (configured) return configured
  if (isProduction()) {
    throw new Error('ROMSALES_CONNECTOR_SECRET não configurado')
  }
  return 'romsales-dev-connector-secret'
}

function getKey(): Buffer {
  return createHash('sha256').update(getConnectorSecret(), 'utf8').digest()
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [PREFIX, iv.toString('base64url'), ciphertext.toString('base64url'), tag.toString('base64url')].join(':')
}

export function decryptSecret(packed: string): string {
  if (!packed.startsWith(`${PREFIX}:`)) return packed

  const [, ivPacked, ciphertextPacked, tagPacked, ...rest] = packed.split(':')
  if (!ivPacked || !ciphertextPacked || !tagPacked || rest.length > 0) {
    throw new Error('Segredo criptografado inválido')
  }

  const iv = Buffer.from(ivPacked, 'base64url')
  const ciphertext = Buffer.from(ciphertextPacked, 'base64url')
  const tag = Buffer.from(tagPacked, 'base64url')
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

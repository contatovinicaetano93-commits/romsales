import type { NextRequest } from 'next/server'
import { isProduction } from '@/lib/env'
import { getRomPanelId, isMultiUnitDeploy } from '@/lib/brand'
import { PRO_AUTH_COOKIE } from '@/lib/pro/constants'

export { PRO_AUTH_COOKIE }

export interface ProSession {
  userId: string
  email: string
  fullName: string
  professionalName: string | null
  panel: string
  exp?: number
}

const SESSION_TTL_SEC = 60 * 60 * 24 * 30

function sessionSecret() {
  const dedicated = process.env.ROMSALES_PRO_SESSION_SECRET?.trim()
  if (dedicated) return dedicated

  if (isProduction()) {
    throw new Error('ROMSALES_PRO_SESSION_SECRET é obrigatória em produção')
  }

  return 'romsales-dev-only'
}

function toBase64Url(bytes: Uint8Array) {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  // btoa disponível em Edge e Node 18+
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(input: string) {
  const pad = input + '==='.slice((input.length + 3) % 4)
  const b64 = pad.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function signPayload(payload: string) {
  const secret = sessionSecret()
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`romsales-pro:${payload}`))
  return bytesToHex(new Uint8Array(sig))
}

export async function createProSessionToken(
  session: Omit<ProSession, 'panel' | 'exp'> & { panel?: string },
) {
  const panel = session.panel ?? getRomPanelId()
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC
  const payload = JSON.stringify({
    v: 2,
    userId: session.userId,
    email: session.email.toLowerCase(),
    fullName: session.fullName,
    professionalName: session.professionalName ?? null,
    panel,
    exp,
  })
  const sig = await signPayload(payload)
  return `v2.${toBase64Url(new TextEncoder().encode(payload))}.${sig}`
}

async function parseV2(body: string, sig: string): Promise<ProSession | null> {
  let payload: string
  try {
    payload = new TextDecoder().decode(fromBase64Url(body))
  } catch {
    return null
  }
  const expected = await signPayload(payload)
  if (!timingSafeEqualHex(sig, expected)) return null
  try {
    const data = JSON.parse(payload) as {
      v?: number
      userId?: string
      email?: string
      fullName?: string
      professionalName?: string | null
      panel?: string
      exp?: number
    }
    if (data.v !== 2 || !data.userId || !data.email || !data.fullName) return null
    if (typeof data.exp !== 'number' || data.exp < Math.floor(Date.now() / 1000)) return null
    return {
      userId: data.userId,
      email: data.email,
      fullName: data.fullName,
      professionalName: data.professionalName || null,
      panel: data.panel || getRomPanelId(),
      exp: data.exp,
    }
  } catch {
    return null
  }
}

export async function parseProSessionToken(
  token: string | undefined | null,
): Promise<ProSession | null> {
  if (!token) return null
  try {
    sessionSecret()
  } catch {
    return null
  }

  const parts = token.split('.')
  if (parts[0] === 'v2' && parts.length === 3) {
    return parseV2(parts[1]!, parts[2]!)
  }
  // Legado com `|` não é mais aceito (força re-login com cookie v2).
  return null
}

export async function getProSession(req: NextRequest): Promise<ProSession | null> {
  return parseProSessionToken(req.cookies.get(PRO_AUTH_COOKIE)?.value)
}

export async function requireProSession(req: NextRequest) {
  try {
    sessionSecret()
  } catch {
    return {
      ok: false as const,
      status: 503 as const,
      message: 'Auth do Romsales não configurada (ROMSALES_PRO_SESSION_SECRET)',
    }
  }
  const session = await getProSession(req)
  if (!session) {
    return { ok: false as const, status: 401 as const, message: 'Faça login no Romsales' }
  }
  // Deploy legado (um `ROM_PANEL` fixo por unidade): cookie de outro painel não serve.
  // Em deploy multi-unidade (sem ROM_PANEL), a unidade da sessão já vem do perfil no banco.
  if (!isMultiUnitDeploy() && session.panel && session.panel !== getRomPanelId()) {
    return {
      ok: false as const,
      status: 401 as const,
      message: 'Sessão de outra unidade — entre de novo neste Romsales',
    }
  }
  return { ok: true as const, session }
}

export function proCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction(),
    path: '/',
    maxAge: SESSION_TTL_SEC,
  }
}

import { normalizePhone } from '@/lib/avec/normalize'

function pickText(msg: Record<string, unknown> | undefined): string | null {
  if (!msg) return null
  if (typeof msg.conversation === 'string' && msg.conversation.trim()) return msg.conversation.trim()
  const ext = msg.extendedTextMessage as Record<string, unknown> | undefined
  if (typeof ext?.text === 'string' && ext.text.trim()) return ext.text.trim()
  const img = msg.imageMessage as Record<string, unknown> | undefined
  if (typeof img?.caption === 'string' && img.caption.trim()) return img.caption.trim()
  const btn = msg.buttonsResponseMessage as Record<string, unknown> | undefined
  const selected = btn?.selectedButtonId ?? btn?.selectedDisplayText
  if (typeof selected === 'string' && selected.trim()) return selected.trim()
  return null
}

function jidToPhone(jid: string): string | null {
  const digits = jid.split('@')[0]?.replace(/\D/g, '') ?? ''
  return normalizePhone(digits)
}

function isFromMe(data: Record<string, unknown>): boolean {
  const key = data.key as Record<string, unknown> | undefined
  return key?.fromMe === true || data.fromMe === true
}

// Aceita payload simples { from, text } ou webhooks Evolution API v1/v2.
export function parseWhatsAppPayload(body: unknown): { from: string; text: string } | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  if (b.fromMe === true) return null

  if (typeof b.from === 'string' && typeof b.text === 'string') {
    const phone = normalizePhone(b.from) ?? b.from
    return { from: phone, text: b.text.trim() }
  }

  const data = (b.data ?? b.message ?? b) as Record<string, unknown>
  if (data && typeof data === 'object') {
    if (isFromMe(data)) return null

    const key = data.key as Record<string, unknown> | undefined
    const jid = (key?.remoteJid ?? data.remoteJid ?? data.from) as string | undefined
    const msg = (data.message ?? data) as Record<string, unknown>
    const text = pickText(msg)
    if (jid && text) {
      const phone = jidToPhone(jid)
      if (phone) return { from: phone, text }
    }
  }

  const messages = b.messages as unknown[] | undefined
  if (Array.isArray(messages) && messages[0] && typeof messages[0] === 'object') {
    return parseWhatsAppPayload(messages[0])
  }

  return null
}

import { NextRequest } from 'next/server'
import { ok, err } from '@/lib/api-response'
import { handleProBotText } from '@/lib/pro/telegram-bot'
import { verifyTelegramProWebhook } from '@/lib/webhooks'

interface TelegramUpdate {
  message?: {
    chat: { id: number }
    text?: string
  }
}

export async function POST(req: NextRequest) {
  const webhook = verifyTelegramProWebhook(req)
  if (!webhook.ok) return err(webhook.reason, 401)

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null
  const chatId = update?.message?.chat.id
  const text = update?.message?.text?.trim()
  if (!chatId || !text) return ok({ ignored: true })

  const result = await handleProBotText(chatId, text)
  return ok(result)
}

import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import { requireProSession } from '@/lib/pro/auth'
import { getProBotUsername } from '@/lib/pro/telegram-bot'
import { buildConnectorStatus, getProUserById, issueTelegramLinkCode } from '@/lib/pro/store'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireProSession(req)
    if (!auth.ok) return err(auth.message, auth.status)

    const code = await issueTelegramLinkCode(auth.session.userId)
    const user = await getProUserById(auth.session.userId)
    if (!user) return err('Conta não encontrada', 404)

    const botUsername = getProBotUsername()
    const deepLink = botUsername
      ? `https://t.me/${botUsername}?start=${code}`
      : null

    return ok({
      code,
      botUsername,
      deepLink,
      instruction: botUsername
        ? `Abra @${botUsername} e envie /start ${code} (ou use o link direto)`
        : `No bot Telegram do Romsales, envie: /start ${code}`,
      webhookPath: '/api/webhooks/telegram-pro',
      connectors: buildConnectorStatus(user),
    })
  } catch (e) {
    return handleError(e)
  }
}

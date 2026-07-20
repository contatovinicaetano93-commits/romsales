#!/usr/bin/env node
/**
 * Configura o bot Telegram do Romsales:
 * - setWebhook → /api/webhooks/telegram-pro
 * - setMyCommands → /hoje /meta /clientes /briefing /ajuda
 *
 * Uso:
 *   TELEGRAM_PRO_BOT_TOKEN=... \
 *   TELEGRAM_PRO_WEBHOOK_SECRET=... \
 *   ROMSALES_PUBLIC_URL=https://romsales-brasil.vercel.app \
 *   npm run bot:setup
 */

const token = process.env.TELEGRAM_PRO_BOT_TOKEN?.trim()
const secret =
  process.env.TELEGRAM_PRO_WEBHOOK_SECRET?.trim() || process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
const base = (process.env.ROMSALES_PUBLIC_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || '')
  .trim()
  .replace(/\/$/, '')

const commands = [
  { command: 'start', description: 'Vincular conta com código' },
  { command: 'hoje', description: 'Resumo do dia' },
  { command: 'meta', description: 'Metas diária e semanal' },
  { command: 'clientes', description: 'Carteira recente' },
  { command: 'briefing', description: 'Briefing da manhã' },
  { command: 'ajuda', description: 'Lista de comandos' },
]

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

if (!token) fail('TELEGRAM_PRO_BOT_TOKEN é obrigatório')
if (!secret) fail('TELEGRAM_PRO_WEBHOOK_SECRET (ou TELEGRAM_WEBHOOK_SECRET) é obrigatório')
if (!base) fail('ROMSALES_PUBLIC_URL é obrigatório (ex.: https://romsales-brasil.vercel.app)')

const webhookUrl = `${base.startsWith('http') ? base : `https://${base}`}/api/webhooks/telegram-pro`

async function telegram(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.ok) {
    throw new Error(`${method} falhou: ${JSON.stringify(json)}`)
  }
  return json
}

const me = await telegram('getMe', {})
console.log(`Bot: @${me.result.username} (${me.result.first_name})`)

await telegram('setWebhook', {
  url: webhookUrl,
  secret_token: secret,
  allowed_updates: ['message'],
  drop_pending_updates: true,
})
console.log(`Webhook: ${webhookUrl}`)

await telegram('setMyCommands', { commands })
console.log(`Comandos: ${commands.map((c) => '/' + c.command).join(' ')}`)

console.log('OK — bot Romsales configurado.')

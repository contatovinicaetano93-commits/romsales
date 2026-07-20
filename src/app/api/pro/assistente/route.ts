import { NextRequest } from 'next/server'
import { ok, err, handleError } from '@/lib/api-response'
import { requireProSession } from '@/lib/pro/auth'
import {
  askProAssistant,
  buildProAssistantContext,
  formatQuickContext,
  getAiDailyLimit,
  morningBriefingForUser,
} from '@/lib/pro/assistant'
import { consumeAiQuota, getProUserById, readAiQuota, refundAiQuota } from '@/lib/pro/store'
import { isAiConfigured } from '@/lib/ai/client'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireProSession(req)
    if (!auth.ok) return err(auth.message, auth.status)
    const user = await getProUserById(auth.session.userId)
    if (!user) return err('Conta não encontrada', 404)

    const quota = await readAiQuota(user.id, getAiDailyLimit())
    const ctx = await buildProAssistantContext(user)
    return ok({
      context: formatQuickContext(ctx),
      connected: ctx.connected,
      ai: {
        used: quota.used,
        limit: quota.limit,
        remaining: quota.remaining,
        configured: isAiConfigured(),
        plan: 'free',
      },
    })
  } catch (e) {
    return handleError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireProSession(req)
    if (!auth.ok) return err(auth.message, auth.status)
    const user = await getProUserById(auth.session.userId)
    if (!user) return err('Conta não encontrada', 404)

    const body = await req.json().catch(() => null)
    const action = typeof body?.action === 'string' ? body.action : 'ask'
    const question = typeof body?.question === 'string' ? body.question : ''

    const limit = getAiDailyLimit()
    const configured = isAiConfigured()

    let quota = await readAiQuota(user.id, limit)
    let reserved = false
    if (configured) {
      const consumed = await consumeAiQuota(user.id, limit)
      if (!consumed.ok) {
        return err(
          `Limite diário de IA atingido (${consumed.limit}/${consumed.limit}). Volte amanhã.`,
          429,
        )
      }
      quota = consumed
      reserved = true
    }

    try {
      const result =
        action === 'briefing'
          ? await morningBriefingForUser(user)
          : await askProAssistant(user, question || 'geral')

      if (reserved && !result.usedAi) {
        reserved = false // evita estorno duplo se o refund lançar e cair no catch
        quota = await refundAiQuota(user.id, limit)
      }

      return ok({
        reply: result.reply,
        usedAi: result.usedAi,
        ai: {
          used: quota.used,
          limit: quota.limit,
          remaining: quota.remaining,
          configured,
          plan: 'free',
        },
      })
    } catch (e) {
      if (reserved) {
        // Um único estorno; falha do refund não tenta de novo.
        await refundAiQuota(user.id, limit).catch(() => null)
        reserved = false
      }
      throw e
    }
  } catch (e) {
    return handleError(e)
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createEnhancedTelegramBot } from '@/lib/telegram-enhanced'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/utils/device'
import { checkRateLimit } from '@/lib/utils/rate-limit'

// Кеш ботів для кожного бізнесу
const botCache = new Map<string, any>()

function getSenderTelegramId(update: any): string | null {
  const fromId =
    update?.message?.from?.id ??
    update?.edited_message?.from?.id ??
    update?.callback_query?.from?.id

  if (fromId === undefined || fromId === null) return null
  return String(fromId)
}

function getStartPassword(update: any): string | null {
  const text = update?.message?.text
  if (typeof text !== 'string') return null
  if (!text.startsWith('/start')) return null
  const parts = text.trim().split(/\s+/)
  const password = parts[1]
  return password || null
}

async function resolveBusinessIdFromUpdate(update: any): Promise<string | null> {
  // 1) Якщо це /start <пароль> — знаходимо бізнес по activationPassword
  const startPassword = getStartPassword(update)
  if (startPassword) {
    const userWithPassword = await prisma.telegramUser.findFirst({
      where: {
        activationPassword: startPassword,
        activatedAt: null,
      },
      select: { businessId: true },
    })
    if (userWithPassword?.businessId) return userWithPassword.businessId
  }

  // 2) Інакше шукаємо бізнес по вже активованому telegramId
  const senderId = getSenderTelegramId(update)
  if (!senderId) return null
  try {
    const telegramId = BigInt(senderId)
    const existingUser = await prisma.telegramUser.findUnique({
      where: { telegramId },
      select: { businessId: true },
    })
    return existingUser?.businessId || null
  } catch {
    return null
  }
}

/**
 * Webhook endpoint для Telegram бота
 * Обробляє всі оновлення від Telegram для конкретного бізнесу
 */
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request) || 'unknown'
    const rateLimit = checkRateLimit({
      key: `telegram-webhook:${clientIp}`,
      maxRequests: 180,
      windowMs: 60 * 1000,
    })
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } }
      )
    }

    const { searchParams } = new URL(request.url)
    const queryBusinessId = searchParams.get('businessId')

    let update: unknown
    try {
      update = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (!update || typeof update !== 'object') {
      return NextResponse.json({ error: 'Invalid update payload' }, { status: 400 })
    }

    // Визначаємо бізнес не лише з query, а й з контенту update.
    // Це дозволяє коректно маршрутизувати повідомлення навіть коли один бот використовується кількома бізнесами.
    const resolvedBusinessId = await resolveBusinessIdFromUpdate(update)
    const businessId = resolvedBusinessId || queryBusinessId
    if (!businessId) {
      return NextResponse.json({ error: 'Cannot resolve businessId for update' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        telegramBotToken: true,
        telegramNotificationsEnabled: true,
      },
    })
    if (!business || !business.telegramBotToken) {
      return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 400 })
    }

    let bot = botCache.get(businessId)
    if (!bot) {
      bot = createEnhancedTelegramBot({
        token: business.telegramBotToken,
        businessId: business.id,
      })
      botCache.set(businessId, bot)
    }

    await bot.handleUpdate(update)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint для перевірки webhook
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')

  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
  }

  try {
    let business: { id: string; name: string; telegramBotToken: string | null; telegramWebhookSetAt?: Date | null } | null = null
    try {
      business = await prisma.business.findUnique({
        where: { id: businessId },
        select: {
          id: true,
          name: true,
          telegramBotToken: true,
          telegramWebhookSetAt: true
        }
      })
    } catch (colErr: any) {
      // Якщо колонки telegramWebhookSetAt ще немає (міграція не застосована), запитуємо без неї
      if (colErr?.message?.includes('telegramWebhookSetAt') || colErr?.message?.includes('does not exist')) {
        business = await prisma.business.findUnique({
          where: { id: businessId },
          select: {
            id: true,
            name: true,
            telegramBotToken: true
          }
        }) as typeof business
        if (business) (business as any).telegramWebhookSetAt = null
      } else throw colErr
    }

    if (!business || !business.telegramBotToken) {
      return NextResponse.json({ 
        configured: false,
        message: 'Telegram bot not configured' 
      })
    }

    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online').replace(/\/$/, '')
    const expectedWebhookUrl = `${baseUrl}/api/telegram/webhook?businessId=${business.id}`

    const webhookInfo = await fetch(`https://api.telegram.org/bot${business.telegramBotToken}/getWebhookInfo`)
      .then(res => res.json())
      .catch(() => null)
    const actualWebhookUrl = webhookInfo?.result?.url || null
    const isCurrentBusinessWebhook = actualWebhookUrl === expectedWebhookUrl

    return NextResponse.json({
      configured: true,
      business: {
        id: business.id,
        name: business.name
      },
      webhook: webhookInfo?.result || null,
      expectedWebhookUrl,
      actualWebhookUrl,
      isCurrentBusinessWebhook,
      telegramWebhookSetAt: business.telegramWebhookSetAt instanceof Date
        ? business.telegramWebhookSetAt.toISOString()
        : null
    })
  } catch (error: any) {
    console.error('Telegram webhook check error:', error)
    return NextResponse.json(
      { error: 'Failed to check webhook' },
      { status: 500 }
    )
  }
}


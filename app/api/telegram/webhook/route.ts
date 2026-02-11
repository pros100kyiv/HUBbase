import { NextRequest, NextResponse } from 'next/server'
import { createEnhancedTelegramBot } from '@/lib/telegram-enhanced'
import { prisma } from '@/lib/prisma'

// Кеш ботів для кожного бізнесу
const botCache = new Map<string, any>()

/**
 * Webhook endpoint для Telegram бота
 * Обробляє всі оновлення від Telegram для конкретного бізнесу
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Отримуємо бізнес та токен бота
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        telegramBotToken: true,
        telegramNotificationsEnabled: true
      }
    })

    if (!business || !business.telegramBotToken) {
      return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 400 })
    }

    // Отримуємо або створюємо бота для цього бізнесу
    let bot = botCache.get(businessId)
    if (!bot) {
      bot = createEnhancedTelegramBot({
        token: business.telegramBotToken,
        businessId: business.id
      })
      botCache.set(businessId, bot)
    }

    // Отримуємо оновлення від Telegram
    const update = await request.json()

    // Обробляємо оновлення через бота
    await bot.handleUpdate(update)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      details: error.message 
    }, { status: 500 })
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
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        telegramBotToken: true,
        telegramWebhookSetAt: true
      }
    })

    if (!business || !business.telegramBotToken) {
      return NextResponse.json({ 
        configured: false,
        message: 'Telegram bot not configured' 
      })
    }

    // Перевіряємо webhook через Telegram API (опційно; якщо не вдасться — покладаємось на telegramWebhookSetAt)
    const webhookInfo = await fetch(`https://api.telegram.org/bot${business.telegramBotToken}/getWebhookInfo`)
      .then(res => res.json())
      .catch(() => null)

    return NextResponse.json({
      configured: true,
      business: {
        id: business.id,
        name: business.name
      },
      webhook: webhookInfo?.result || null,
      telegramWebhookSetAt: business.telegramWebhookSetAt?.toISOString() ?? null
    })
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Failed to check webhook',
      details: error.message 
    }, { status: 500 })
  }
}


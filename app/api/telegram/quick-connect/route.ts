import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'
const PLATFORM_BOT_TOKEN =
  process.env.DEFAULT_TELEGRAM_BOT_TOKEN ||
  process.env.TELEGRAM_BOT_TOKEN ||
  ''
const PLATFORM_WEBHOOK_URL = `${BASE_URL.replace(/\/$/, '')}/api/telegram/webhook`

/**
 * POST /api/telegram/quick-connect
 * Швидке підключення за 2 кліки: бізнес → Підключити → Підтвердити → готово.
 * Використовує платформний бот, повідомлення роутуються по businessIdentifier (/start 12345).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const businessId = body.businessId

    if (!businessId || typeof businessId !== 'string') {
      return NextResponse.json({ error: 'businessId обов\'язковий', success: false }, { status: 400 })
    }

    if (!PLATFORM_BOT_TOKEN) {
      return NextResponse.json({
        error: 'Платформний Telegram бот не налаштований. Ви можете підключити свого бота в налаштуваннях.',
        code: 'BOT_NOT_CONFIGURED',
        success: false,
      }, { status: 503 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, businessIdentifier: true },
    })

    if (!business || !business.businessIdentifier) {
      return NextResponse.json({ error: 'Бізнес не знайдено або немає ідентифікатора', success: false }, { status: 404 })
    }

    await prisma.business.update({
      where: { id: businessId },
      data: {
        telegramBotToken: PLATFORM_BOT_TOKEN,
        telegramWebhookSetAt: new Date(),
      },
    })

    const res = await fetch(`https://api.telegram.org/bot${PLATFORM_BOT_TOKEN}/getMe`)
    const meData = await res.json().catch(() => ({}))
    const botUsername = meData?.result?.username || 'XbaseBot'

    const inviteLink = `https://t.me/${botUsername}?start=${business.businessIdentifier}`

    await fetch(`https://api.telegram.org/bot${PLATFORM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: PLATFORM_WEBHOOK_URL }),
    })

    return NextResponse.json({
      success: true,
      message: 'Telegram підключено! Діліться посиланням з клієнтами — повідомлення з\'являтимуться тут.',
      inviteLink,
      botUsername: `@${botUsername}`,
    })
  } catch (error: any) {
    console.error('quick-connect error:', error)
    return NextResponse.json({
      success: false,
      error: error?.message || 'Помилка підключення. Спробуйте пізніше.',
    }, { status: 500 })
  }
}

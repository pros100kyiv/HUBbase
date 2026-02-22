import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'

/**
 * POST /api/telegram/set-token
 * Встановлює індивідуальний токен Telegram бота для бізнесу.
 * Body: { businessId: string, token: string }
 * Перевіряє токен через Telegram API перед збереженням.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { businessId, token } = body

    if (!businessId || typeof businessId !== 'string') {
      return NextResponse.json({ error: 'businessId обов\'язковий', success: false }, { status: 400 })
    }

    const trimmedToken = typeof token === 'string' ? token.trim() : ''
    if (!trimmedToken) {
      return NextResponse.json({
        error: 'Вставте токен бота з @BotFather',
        success: false,
      }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Бізнес не знайдено', success: false }, { status: 404 })
    }

    const res = await fetch(`https://api.telegram.org/bot${trimmedToken}/getMe`)
    const data = await res.json().catch(() => ({ ok: false }))

    if (!data.ok) {
      return NextResponse.json({
        success: false,
        error: data.description || 'Невірний токен. Перевірте токен з @BotFather.',
      }, { status: 400 })
    }

    await prisma.business.update({
      where: { id: businessId },
      data: {
        telegramBotToken: trimmedToken,
        telegramWebhookSetAt: null,
      },
    })

    const webhookUrl = `${BASE_URL.replace(/\/$/, '')}/api/telegram/webhook?businessId=${businessId}`
    const webhookRes = await fetch(`https://api.telegram.org/bot${trimmedToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    })
    const webhookData = await webhookRes.json().catch(() => ({ ok: false }))

    if (webhookData.ok) {
      await prisma.business.update({
        where: { id: businessId },
        data: { telegramWebhookSetAt: new Date() },
      })
    }

    return NextResponse.json({
      success: true,
      message: `Бот @${data.result?.username || 'bot'} підключено. Повідомлення надходитимуть у кабінет.`,
      botUsername: data.result?.username,
      webhookSet: webhookData.ok,
    })
  } catch (error: any) {
    console.error('set-token error:', error)
    return NextResponse.json({
      success: false,
      error: error?.message || 'Помилка збереження. Спробуйте пізніше.',
    }, { status: 500 })
  }
}

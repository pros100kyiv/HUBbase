import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/telegram/disconnect
 * Відключає Telegram для бізнесу: очищає токен, видаляє chat-мапінги.
 * Body: { businessId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const businessId = body.businessId

    if (!businessId || typeof businessId !== 'string') {
      return NextResponse.json({ error: 'businessId обов\'язковий', success: false }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Бізнес не знайдено', success: false }, { status: 404 })
    }

    // Видаляємо chat-мапінги (ігноруємо помилки — таблиця може не існувати)
    try {
      await prisma.telegramChatMapping.deleteMany({ where: { businessId } })
    } catch {
      // Продовжуємо — основним є обнулення токена
    }

    await prisma.business.update({
      where: { id: businessId },
      data: {
        telegramBotToken: null,
        telegramWebhookSetAt: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Telegram відключено. Повідомлення більше не надходитимуть.',
    })
  } catch (error: any) {
    console.error('disconnect error:', error?.message || error)
    const msg = error?.message || 'Помилка відключення.'
    return NextResponse.json({
      success: false,
      error: msg,
      code: error?.code,
    }, { status: 500 })
  }
}

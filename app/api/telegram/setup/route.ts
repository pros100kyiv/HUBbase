import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Налаштування Telegram бота для бізнесу
 * POST /api/telegram/setup
 * Body: { businessId, botToken, chatId?, notificationsEnabled? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessId, botToken, chatId, notificationsEnabled = false } = body

    if (!businessId || !botToken) {
      return NextResponse.json({ error: 'Missing businessId or botToken' }, { status: 400 })
    }

    // Оновлюємо налаштування бізнесу
    const business = await prisma.business.update({
      where: { id: businessId },
      data: {
        telegramBotToken: botToken,
        telegramChatId: chatId || null,
        telegramNotificationsEnabled: notificationsEnabled,
      },
    })

    return NextResponse.json({ success: true, business })
  } catch (error) {
    console.error('Error setting up Telegram bot:', error)
    return NextResponse.json(
      { error: 'Failed to setup bot', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


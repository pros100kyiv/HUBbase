import { NextRequest, NextResponse } from 'next/server'
import { createTelegramBot } from '@/lib/telegram'
import { createEnhancedTelegramBot } from '@/lib/telegram-enhanced'
import { prisma } from '@/lib/prisma'

/**
 * Webhook endpoint для Telegram ботів
 * POST /api/telegram/webhook?businessId=xxx
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })
    }

    // Отримуємо бізнес та його токен
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { telegramBotToken: true },
    })

    if (!business?.telegramBotToken) {
      return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 400 })
    }

    // Створюємо розширеного бота (з активацією через пароль та інтерфейсом)
    const bot = createEnhancedTelegramBot({
      token: business.telegramBotToken,
      businessId,
    })

    // Обробляємо оновлення від Telegram
    const body = await request.json()
    await bot.handleUpdate(body)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error processing Telegram webhook:', error)
    return NextResponse.json(
      { error: 'Failed to process webhook', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


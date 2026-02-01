import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Telegraf } from 'telegraf'

/**
 * Відправка розсилки
 * POST /api/telegram/broadcasts/[id]/send
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const broadcast = await prisma.telegramBroadcast.findUnique({
      where: { id: resolvedParams.id },
      include: { business: true },
    })

    if (!broadcast) {
      return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 })
    }

    if (!broadcast.business.telegramBotToken) {
      return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 400 })
    }

    const bot = new Telegraf(broadcast.business.telegramBotToken)

    // Отримуємо цільову аудиторію
    const where: any = {
      businessId: broadcast.businessId,
      isActive: true,
      notificationsEnabled: true,
      activatedAt: { not: null }, // Тільки активовані користувачі
    }

    if (broadcast.targetRole) {
      where.role = broadcast.targetRole
    }

    const users = await prisma.telegramUser.findMany({
      where,
      select: { telegramId: true },
    })

    let sentCount = 0
    let failedCount = 0

    // Відправляємо повідомлення
    for (const user of users) {
      try {
        await bot.telegram.sendMessage(Number(user.telegramId), broadcast.message, { parse_mode: 'HTML' })
        sentCount++
      } catch (error) {
        console.error(`Error sending to user ${user.telegramId}:`, error)
        failedCount++
      }
    }

    // Оновлюємо статус розсилки
    await prisma.telegramBroadcast.update({
      where: { id: resolvedParams.id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        sentCount,
        failedCount,
      },
    })

    return NextResponse.json({
      success: true,
      sentCount,
      failedCount,
      totalUsers: users.length,
    })
  } catch (error) {
    console.error('Error sending broadcast:', error)
    return NextResponse.json(
      { error: 'Failed to send broadcast', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


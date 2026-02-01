import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Telegraf } from 'telegraf'

/**
 * Відправка нагадування
 * POST /api/telegram/reminders/[id]/send
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const reminder = await prisma.telegramReminder.findUnique({
      where: { id: resolvedParams.id },
      include: { 
        business: true,
        client: true,
      },
    })

    if (!reminder) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
    }

    if (!reminder.business.telegramBotToken) {
      return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 400 })
    }

    const bot = new Telegraf(reminder.business.telegramBotToken)

    let sentCount = 0
    let failedCount = 0

    if (reminder.targetType === 'client' && reminder.clientId) {
      // Персональне нагадування
      const telegramUser = await prisma.telegramUser.findFirst({
        where: {
          businessId: reminder.businessId,
          role: 'CLIENT',
          isActive: true,
          notificationsEnabled: true,
          activatedAt: { not: null },
        },
        // Можна додати зв'язок з клієнтом через phone або інший ідентифікатор
        // Поки що відправляємо всім клієнтам
      })

      // Якщо є конкретний клієнт, спробуємо знайти його Telegram
      // Поки що відправляємо всім активним клієнтам
      const clients = await prisma.telegramUser.findMany({
        where: {
          businessId: reminder.businessId,
          role: 'CLIENT',
          isActive: true,
          notificationsEnabled: true,
          activatedAt: { not: null },
        },
      })

      for (const client of clients) {
        try {
          await bot.telegram.sendMessage(Number(client.telegramId), reminder.message, { parse_mode: 'HTML' })
          sentCount++
        } catch (error) {
          console.error(`Error sending to client ${client.telegramId}:`, error)
          failedCount++
        }
      }
    } else {
      // Відправка всім клієнтам
      const clients = await prisma.telegramUser.findMany({
        where: {
          businessId: reminder.businessId,
          role: 'CLIENT',
          isActive: true,
          notificationsEnabled: true,
          activatedAt: { not: null },
        },
      })

      for (const client of clients) {
        try {
          await bot.telegram.sendMessage(Number(client.telegramId), reminder.message, { parse_mode: 'HTML' })
          sentCount++
        } catch (error) {
          console.error(`Error sending to client ${client.telegramId}:`, error)
          failedCount++
        }
      }
    }

    // Оновлюємо статус нагадування
    await prisma.telegramReminder.update({
      where: { id: resolvedParams.id },
      data: {
        status: 'sent',
        sentAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      sentCount,
      failedCount,
    })
  } catch (error) {
    console.error('Error sending reminder:', error)
    return NextResponse.json(
      { error: 'Failed to send reminder', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


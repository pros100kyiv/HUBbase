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
        client: { select: { id: true, telegramChatId: true } },
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

    if (reminder.targetType === 'client' && reminder.clientId && reminder.client?.telegramChatId) {
      // Персональне нагадування — ТІЛЬКИ конкретному клієнту (Client.telegramChatId)
      const chatId = reminder.client.telegramChatId.trim()
      try {
        await bot.telegram.sendMessage(chatId, reminder.message, { parse_mode: 'HTML' })
        sentCount++
      } catch (error) {
        console.error(`Error sending to client ${chatId}:`, error)
        failedCount++
      }
    } else {
      // targetType 'all' або інший — відправка всім Telegram-користувачам з роль CLIENT (активованим)
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


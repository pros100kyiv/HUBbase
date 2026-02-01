import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramNotification } from '@/lib/telegram'
import { prisma } from '@/lib/prisma'

/**
 * Інтеграція сповіщень з аналітики в Telegram
 * Викликається автоматично при зміні показників
 * POST /api/telegram/integrate-alerts
 * Body: { businessId }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessId } = body

    if (!businessId) {
      return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })
    }

    // Перевіряємо чи увімкнені сповіщення
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { telegramNotificationsEnabled: true, telegramBotToken: true },
    })

    if (!business?.telegramNotificationsEnabled || !business.telegramBotToken) {
      return NextResponse.json({ success: true, message: 'Notifications disabled' })
    }

    // Завантажуємо сповіщення
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/analytics/alerts?businessId=${businessId}`)
    const data = await response.json()

    if (data.alerts && data.alerts.length > 0) {
      // Фільтруємо тільки критичні та попередження
      const criticalAlerts = data.alerts.filter((alert: any) => 
        alert.type === 'critical' || alert.type === 'warning'
      )

      if (criticalAlerts.length > 0) {
        const message = `⚠️ <b>Сповіщення</b>\n\n` +
          criticalAlerts.map((alert: any) => {
            const icon = alert.type === 'critical' ? '🔴' : '🟡'
            return `${icon} ${alert.message}\nЗміна: ${alert.change > 0 ? '+' : ''}${alert.change.toFixed(1)}%`
          }).join('\n\n')

        // Відправляємо тільки адміністраторам та власникам
        await sendTelegramNotification(businessId, message, {
          onlyToRole: undefined, // Відправляємо всім активним користувачам
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error integrating alerts:', error)
    return NextResponse.json(
      { error: 'Failed to integrate alerts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


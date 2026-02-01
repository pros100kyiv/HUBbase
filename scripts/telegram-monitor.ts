/**
 * Скрипт для моніторингу та відправки сповіщень через Telegram
 * Запускається через cron або як окремий процес
 */

import { prisma } from '../lib/prisma'
import { sendTelegramNotification } from '../lib/telegram'

async function checkAndSendAlerts() {
  try {
    // Отримуємо всі активні бізнеси з увімкненими Telegram сповіщеннями
    const businesses = await prisma.business.findMany({
      where: {
        isActive: true,
        telegramNotificationsEnabled: true,
        telegramBotToken: { not: null },
      },
      select: { id: true, name: true },
    })

    for (const business of businesses) {
      try {
        // Завантажуємо сповіщення для бізнесу
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        const response = await fetch(`${baseUrl}/api/analytics/alerts?businessId=${business.id}`)
        const data = await response.json()

        if (data.alerts && data.alerts.length > 0) {
          // Фільтруємо тільки критичні та попередження
          const criticalAlerts = data.alerts.filter((alert: any) => 
            alert.type === 'critical' || alert.type === 'warning'
          )

          if (criticalAlerts.length > 0) {
            const message = `⚠️ <b>Сповіщення для ${business.name}</b>\n\n` +
              criticalAlerts.map((alert: any) => {
                const icon = alert.type === 'critical' ? '🔴' : '🟡'
                return `${icon} ${alert.message}\nЗміна: ${alert.change > 0 ? '+' : ''}${alert.change.toFixed(1)}%`
              }).join('\n\n')

            // Відправляємо тільки адміністраторам та власникам
            await sendTelegramNotification(business.id, message, {
              onlyToRole: undefined, // Відправляємо всім активним користувачам
            })
          }
        }
      } catch (error) {
        console.error(`Error processing alerts for business ${business.id}:`, error)
      }
    }
  } catch (error) {
    console.error('Error in monitor script:', error)
  }
}

// Запускаємо перевірку
if (require.main === module) {
  checkAndSendAlerts()
    .then(() => {
      console.log('Monitor check completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Monitor check failed:', error)
      process.exit(1)
    })
}

export { checkAndSendAlerts }


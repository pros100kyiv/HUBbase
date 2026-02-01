/**
 * Скрипт для налаштування Telegram бота для бізнесу
 * Використання: tsx scripts/setup-telegram-bot.ts <businessId> <botToken>
 */

import { prisma } from '../lib/prisma'

async function setupBot(businessId: string, botToken: string) {
  try {
    // Перевіряємо чи бізнес існує
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    })

    if (!business) {
      console.error('❌ Бізнес не знайдено')
      process.exit(1)
    }

    // Перевіряємо токен бота
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`)
    const botInfo = await response.json()

    if (!botInfo.ok) {
      console.error('❌ Невірний токен бота:', botInfo.description)
      process.exit(1)
    }

    console.log('✅ Бот знайдено:', botInfo.result.username)

    // Оновлюємо налаштування бізнесу
    await prisma.business.update({
      where: { id: businessId },
      data: {
        telegramBotToken: botToken,
        telegramNotificationsEnabled: true,
      },
    })

    console.log('✅ Бот налаштовано для бізнесу:', business.name)

    // Отримуємо URL для webhook
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const webhookUrl = `${baseUrl}/api/telegram/webhook?businessId=${businessId}`

    console.log('\n📋 Наступні кроки:')
    console.log('1. Налаштуйте webhook:')
    console.log(`   curl -X POST "https://api.telegram.org/bot${botToken}/setWebhook" -d "url=${webhookUrl}"`)
    console.log('\n2. Або використайте команду:')
    console.log(`   npm run telegram:setup-webhook ${businessId}`)

  } catch (error) {
    console.error('❌ Помилка:', error)
    process.exit(1)
  }
}

const businessId = process.argv[2]
const botToken = process.argv[3] || '8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo'

if (!businessId) {
  console.error('Використання: tsx scripts/setup-telegram-bot.ts <businessId> [botToken]')
  process.exit(1)
}

setupBot(businessId, botToken)
  .then(() => {
    console.log('\n✅ Налаштування завершено!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Помилка:', error)
    process.exit(1)
  })


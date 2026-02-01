/**
 * Скрипт для налаштування webhook для Telegram бота
 * Використання: tsx scripts/setup-webhook.ts <businessId>
 */

import { prisma } from '../lib/prisma'

async function setupWebhook(businessId: string) {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { telegramBotToken: true, name: true },
    })

    if (!business) {
      console.error('❌ Бізнес не знайдено')
      process.exit(1)
    }

    if (!business.telegramBotToken) {
      console.error('❌ Токен бота не налаштовано. Спочатку налаштуйте бота.')
      process.exit(1)
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const webhookUrl = `${baseUrl}/api/telegram/webhook?businessId=${businessId}`

    console.log('🔗 Налаштування webhook для:', business.name)
    console.log('📡 URL:', webhookUrl)

    const response = await fetch(`https://api.telegram.org/bot${business.telegramBotToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    })

    const result = await response.json()

    if (result.ok) {
      console.log('✅ Webhook налаштовано успішно!')
      console.log('📋 Інформація:', JSON.stringify(result, null, 2))
    } else {
      console.error('❌ Помилка налаштування webhook:', result.description)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Помилка:', error)
    process.exit(1)
  }
}

const businessId = process.argv[2]

if (!businessId) {
  console.error('Використання: tsx scripts/setup-webhook.ts <businessId>')
  process.exit(1)
}

setupWebhook(businessId)
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Помилка:', error)
    process.exit(1)
  })


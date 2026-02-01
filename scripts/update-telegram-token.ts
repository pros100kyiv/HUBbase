import { prisma } from '../lib/prisma'

const DEFAULT_TELEGRAM_BOT_TOKEN = process.env.DEFAULT_TELEGRAM_BOT_TOKEN || '8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo'

async function updateTelegramTokens() {
  try {
    console.log('🔄 Оновлення токенів Telegram для всіх бізнесів...')
    
    const businesses = await prisma.business.findMany({
      where: {
        OR: [
          { telegramBotToken: null },
          { telegramBotToken: '' },
        ],
      },
    })

    console.log(`📊 Знайдено ${businesses.length} бізнесів без токену`)

    for (const business of businesses) {
      await prisma.business.update({
        where: { id: business.id },
        data: {
          telegramBotToken: DEFAULT_TELEGRAM_BOT_TOKEN,
          telegramNotificationsEnabled: true,
        },
      })
      console.log(`✅ Оновлено бізнес: ${business.name} (${business.id})`)
    }

    console.log('✅ Всі токени оновлено!')
  } catch (error) {
    console.error('❌ Помилка:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

updateTelegramTokens()


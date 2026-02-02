#!/usr/bin/env tsx

/**
 * Скрипт для налаштування Telegram бота для бізнесу
 * 
 * Використання:
 *   npm run telegram:setup-token <businessId> [botToken]
 * 
 * Якщо botToken не вказано, використовується токен з аргументів або змінної оточення
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BOT_TOKEN = '8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo'

async function setupTelegramBotToken(businessId: string, botToken?: string) {
  try {
    console.log('🔧 Налаштування Telegram бота...\n')

    const token = botToken || BOT_TOKEN

    // Отримуємо бізнес
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        telegramBotToken: true
      }
    })

    if (!business) {
      console.error('❌ Бізнес не знайдено з ID:', businessId)
      process.exit(1)
    }

    console.log(`📋 Бізнес: ${business.name} (${business.id})\n`)

    // Перевіряємо токен через Telegram API
    console.log('🔍 Перевірка токену бота...')
    try {
      const botInfoResponse = await fetch(`https://api.telegram.org/bot${token}/getMe`)
      if (!botInfoResponse.ok) {
        throw new Error('Не вдалося отримати інформацію про бота')
      }

      const botInfo = await botInfoResponse.json()
      if (!botInfo.ok) {
        throw new Error(botInfo.description || 'Помилка від Telegram API')
      }

      console.log(`✅ Бот знайдено: @${botInfo.result.username} (${botInfo.result.first_name})`)
      console.log(`   Bot ID: ${botInfo.result.id}\n`)

      // Оновлюємо токен в базі даних
      await prisma.business.update({
        where: { id: businessId },
        data: { 
          telegramBotToken: token,
          telegramNotificationsEnabled: true
        }
      })
      console.log('✅ Токен оновлено в базі даних\n')

      // Перевіряємо webhook
      console.log('🔍 Перевірка webhook...')
      const webhookInfoResponse = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
      if (webhookInfoResponse.ok) {
        const webhookInfo = await webhookInfoResponse.json()
        if (webhookInfo.ok) {
          const webhook = webhookInfo.result
          if (webhook.url) {
            console.log(`📡 Webhook налаштовано: ${webhook.url}`)
            console.log(`   Pending updates: ${webhook.pending_update_count}`)
            if (webhook.last_error_date) {
              console.log(`   ⚠️  Остання помилка: ${webhook.last_error_message}`)
            }
          } else {
            console.log('⚠️  Webhook не налаштовано')
            console.log('   Запустіть: npm run telegram:webhook', businessId)
          }
        }
      }
      console.log()

      // Інструкції
      console.log('📝 Наступні кроки:\n')
      console.log('1. Налаштуйте домен в @BotFather:')
      console.log('   - Відкрийте @BotFather')
      console.log('   - Виберіть вашого бота')
      console.log('   - Оберіть "Edit Bot" → "Edit Domains"')
      console.log('   - Додайте домен: xbase.online\n')
      console.log('2. Налаштуйте webhook (якщо потрібно):')
      console.log(`   npm run telegram:webhook ${businessId}\n`)
      console.log('3. Відкрийте налаштування бізнесу в Xbase')
      console.log('4. Перейдіть до вкладки "Telegram"')
      console.log('5. Натисніть "Підключити Telegram"\n')

      console.log('✅ Налаштування завершено!\n')

    } catch (error: any) {
      console.error('❌ Помилка при перевірці токену:', error.message)
      console.error('\nПереконайтеся, що:')
      console.error('1. Токен бота правильний')
      console.error('2. Бот активний в @BotFather')
      console.error('3. Є доступ до інтернету\n')
      process.exit(1)
    }

  } catch (error: any) {
    console.error('❌ Помилка:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Отримуємо аргументи з командного рядка
const args = process.argv.slice(2)

if (args.length < 1) {
  console.error('❌ Помилка: не вказано businessId')
  console.error('\nВикористання:')
  console.error('  npm run telegram:setup-token <businessId> [botToken]')
  console.error('\nПриклад:')
  console.error('  npm run telegram:setup-token cml3hv43g000011zklyvox6sh')
  console.error('  npm run telegram:setup-token cml3hv43g000011zklyvox6sh 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11')
  process.exit(1)
}

const businessId = args[0]
const botToken = args[1]

setupTelegramBotToken(businessId, botToken)


#!/usr/bin/env tsx

/**
 * Скрипт для налаштування webhook для всіх бізнесів
 * Запускається на хостингу для постійної роботи ботів
 * 
 * Використання:
 *   npm run telegram:webhook-all
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'
const DEFAULT_BOT_TOKEN = process.env.DEFAULT_TELEGRAM_BOT_TOKEN || '8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo'

async function setupWebhooksForAllBusinesses() {
  try {
    console.log('🔧 Налаштування webhook для всіх бізнесів...\n')

    // Отримуємо всі бізнеси з налаштованими токенами
    const businesses = await prisma.business.findMany({
      where: {
        telegramBotToken: {
          not: null
        },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        telegramBotToken: true
      }
    })

    console.log(`📊 Знайдено ${businesses.length} бізнесів з налаштованими ботамі\n`)

    let successCount = 0
    let errorCount = 0

    for (const business of businesses) {
      try {
        const token = business.telegramBotToken || DEFAULT_BOT_TOKEN
        const webhookUrl = `${BASE_URL}/api/telegram/webhook?businessId=${business.id}`

        console.log(`🔗 Налаштування webhook для: ${business.name} (${business.id})`)
        console.log(`   URL: ${webhookUrl}`)

        const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: webhookUrl })
        })

        const result = await response.json()

        if (result.ok) {
          console.log(`   ✅ Webhook налаштовано\n`)
          successCount++
        } else {
          console.error(`   ❌ Помилка: ${result.description}\n`)
          errorCount++
        }
      } catch (error: any) {
        console.error(`   ❌ Помилка для ${business.name}: ${error.message}\n`)
        errorCount++
      }
    }

    console.log('📊 Результати:')
    console.log(`   ✅ Успішно: ${successCount}`)
    console.log(`   ❌ Помилок: ${errorCount}`)
    console.log(`   📊 Всього: ${businesses.length}\n`)

    // Перевіряємо webhook для дефолтного бота
    console.log('🔍 Перевірка webhook для дефолтного бота...')
    const webhookInfo = await fetch(`https://api.telegram.org/bot${DEFAULT_BOT_TOKEN}/getWebhookInfo`)
      .then(res => res.json())
      .catch(() => null)

    if (webhookInfo?.ok) {
      console.log(`   ✅ Webhook: ${webhookInfo.result.url || 'не налаштовано'}`)
      console.log(`   📊 Pending updates: ${webhookInfo.result.pending_update_count || 0}\n`)
    }

    console.log('✅ Налаштування завершено!\n')
  } catch (error: any) {
    console.error('❌ Помилка:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

setupWebhooksForAllBusinesses()


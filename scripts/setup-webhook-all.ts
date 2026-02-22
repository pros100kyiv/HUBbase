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
const DELAY_MS = 1500
const MAX_RETRIES = 3

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function setWebhookWithRetry(
  token: string,
  webhookUrl: string
): Promise<{ ok: boolean; description?: string }> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    })
    const result = await response.json()

    if (result.ok) return { ok: true }
    if (result.description?.includes('retry after')) {
      const match = result.description.match(/retry after (\d+)/i)
      const retrySec = match ? parseInt(match[1], 10) : 2
      if (attempt < MAX_RETRIES) {
        console.log(`   ⏳ Rate limit, чекаю ${retrySec}s...`)
        await sleep(retrySec * 1000)
        continue
      }
    }
    return { ok: false, description: result.description }
  }
  return { ok: false, description: 'Max retries exceeded' }
}

async function setupWebhooksForAllBusinesses() {
  try {
    console.log('🔧 Налаштування webhook для всіх бізнесів...\n')

    const businesses = await prisma.business.findMany({
      where: {
        telegramBotToken: { not: null },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        telegramBotToken: true,
      },
    })

    console.log(`📊 Знайдено ${businesses.length} бізнесів з налаштованими ботамі\n`)

    const byToken = new Map<string, typeof businesses>()
    for (const b of businesses) {
      const token = b.telegramBotToken
      if (!token) continue
      if (!byToken.has(token)) byToken.set(token, [])
      byToken.get(token)!.push(b)
    }

    let successCount = 0
    let errorCount = 0

    for (const [token, bizList] of byToken) {
      const primary = bizList[0]!
      const webhookUrl = `${BASE_URL.replace(/\/$/, '')}/api/telegram/webhook?businessId=${primary.id}`

      console.log(`🔗 Токен: ${token.slice(0, 15)}... — бізнесів: ${bizList.length}`)
      console.log(`   Перший: ${primary.name} (${primary.id})`)
      console.log(`   URL: ${webhookUrl}`)

      const result = await setWebhookWithRetry(token, webhookUrl)

      if (result.ok) {
        console.log(`   ✅ Webhook налаштовано`)
        successCount += bizList.length
        try {
          await prisma.business.updateMany({
            where: { id: { in: bizList.map((b) => b.id) } },
            data: { telegramWebhookSetAt: new Date() },
          })
          console.log(`   ✅ telegramWebhookSetAt оновлено для ${bizList.length} бізнесів`)
        } catch (e: any) {
          if (!e?.message?.includes('telegramWebhookSetAt')) console.error('   ⚠️ DB update:', e?.message)
        }
        console.log('')
      } else {
        console.error(`   ❌ Помилка: ${result.description}\n`)
        errorCount += bizList.length
      }

      if (byToken.size > 1) await sleep(DELAY_MS)
    }

    console.log('📊 Результати:')
    console.log(`   ✅ Успішно: ${successCount}`)
    console.log(`   ❌ Помилок: ${errorCount}`)
    console.log(`   📊 Унікальних токенів: ${byToken.size}\n`)

    const firstToken = businesses[0]?.telegramBotToken
    if (firstToken) {
      console.log('🔍 Перевірка webhook...')
      const webhookInfo = await fetch(`https://api.telegram.org/bot${firstToken}/getWebhookInfo`)
        .then((res) => res.json())
        .catch(() => null)
      if (webhookInfo?.ok) {
        console.log(`   ✅ URL: ${webhookInfo.result?.url || '(не встановлено)'}`)
        console.log(`   📊 Pending: ${webhookInfo.result?.pending_update_count || 0}\n`)
      }
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

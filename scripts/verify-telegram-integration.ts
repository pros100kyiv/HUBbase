#!/usr/bin/env tsx
/**
 * Скрипт перевірки інтеграції Telegram: webhook, збереження повідомлень, дошборд.
 * Використання: npm run telegram:verify (або npx tsx scripts/verify-telegram-integration.ts)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'

async function main() {
  console.log('🔍 Перевірка інтеграції Telegram\n')
  console.log('─'.repeat(60))

  // 1. Бізнеси з налаштованим ботом
  const businessesWithBot = await prisma.business.findMany({
    where: {
      telegramBotToken: { not: null },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      telegramBotToken: true,
      telegramWebhookSetAt: true,
    },
  })

  console.log(`\n📊 Бізнеси з Telegram ботом: ${businessesWithBot.length}`)
  if (businessesWithBot.length === 0) {
    console.log('   ⚠️ Жоден бізнес не має telegramBotToken. Додайте токен в налаштуваннях.')
    return
  }

  const tokenToPrimary = new Map<string, string>()
  for (const biz of businessesWithBot) {
    const token = biz.telegramBotToken!
    if (!tokenToPrimary.has(token)) tokenToPrimary.set(token, biz.id)
  }

  const webhookByToken = new Map<string, string | null>()
  for (const biz of businessesWithBot) {
    const token = biz.telegramBotToken!
    const webhookUrl = `${BASE_URL.replace(/\/$/, '')}/api/telegram/webhook?businessId=${biz.id}`
    const primaryId = tokenToPrimary.get(token)!
    const isPrimary = primaryId === biz.id

    console.log(`\n📌 ${biz.name} (${biz.id})`)
    console.log(`   Webhook URL: ${webhookUrl}`)
    console.log(`   Webhook встановлено (БД): ${biz.telegramWebhookSetAt ? '✅ Так' : '❌ Ні / невідомо'}`)

    try {
      if (!webhookByToken.has(token)) {
        const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
        const data = await res.json()
        webhookByToken.set(token, data.ok ? data.result?.url || null : null)
      }
      const actualUrl = webhookByToken.get(token)!
      const pending = 0

      if (actualUrl !== undefined) {
        const primaryUrl = `${BASE_URL.replace(/\/$/, '')}/api/telegram/webhook?businessId=${primaryId}`
        const isActive = !!actualUrl
        const isCorrect = actualUrl === webhookUrl
        const isSharedOk = isActive && actualUrl === primaryUrl

        console.log(`   Telegram webhook: ${actualUrl || '(не встановлено)'}`)
        if (isCorrect) {
          console.log(`   Статус: ✅ Активний (цей бізнес)`)
        } else if (isSharedOk && !isPrimary) {
          console.log(`   Статус: ✅ Спільний токен — маршрутизація через TelegramUser/пароль`)
        } else if (isActive) {
          console.log(`   Статус: ⚠️ Webhook для іншого бізнесу (спільний бот)`)
        } else {
          console.log(`   Статус: ❌ Webhook не встановлено`)
        }
        console.log(`   Pending updates: ${pending}`)

        if (!actualUrl) {
          console.log('   ⚠️  Запустіть: npm run telegram:webhook-all')
        }
      }
    } catch (e: any) {
      console.log(`   ❌ Помилка: ${e.message}`)
    }
  }

  // 2. Повідомлення в SocialInboxMessage (telegram)
  const inboxCount = await prisma.socialInboxMessage.count({
    where: { platform: 'telegram', direction: 'inbound' },
  })
  const byBusiness = await prisma.socialInboxMessage.groupBy({
    by: ['businessId'],
    where: { platform: 'telegram', direction: 'inbound' },
    _count: true,
  })

  console.log('\n' + '─'.repeat(60))
  console.log(`\n📬 Повідомлення з Telegram в SocialInbox (вхідні): ${inboxCount}`)
  if (byBusiness.length > 0) {
    for (const g of byBusiness) {
      const b = await prisma.business.findUnique({
        where: { id: g.businessId },
        select: { name: true },
      })
      console.log(`   - ${b?.name || g.businessId}: ${g._count} шт.`)
    }
  } else {
    console.log('   (немає вхідних повідомлень з Telegram)')
  }

  // 3. TelegramUser — хто може писати боту
  const tgUsers = await prisma.telegramUser.count({
    where: { activatedAt: { not: null } },
  })
  console.log(`\n👤 Активованих Telegram-користувачів (activatedAt не null): ${tgUsers}`)

  console.log('\n' + '─'.repeat(60))
  console.log('\n📋 Чекліст для роботи інтеграції:')
  console.log('   1. Бізнес має telegramBotToken (налаштування → Інтеграції → Telegram)')
  console.log('   2. Webhook встановлено (GET /api/telegram/webhook?businessId=... показує isCurrentBusinessWebhook: true)')
  console.log('   3. Клієнт пише боту звичайний текст (не команду /start) — повідомлення зберігається в SocialInbox')
  console.log('   4. Дошборд: /dashboard/social та /dashboard/main показують SocialMessagesCard з повідомленнями')
  console.log('\n')
}

main()
  .catch((e) => {
    console.error('Помилка:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

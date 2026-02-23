#!/usr/bin/env tsx
/**
 * Тест бота через API: getMe, getUpdates, симуляція webhook /start
 * npm run telegram:test
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'

async function main() {
  console.log('🤖 Тест Telegram бота\n')

  const biz = await prisma.business.findFirst({
    where: { telegramBotToken: { not: null }, isActive: true },
    select: {
      id: true,
      name: true,
      businessIdentifier: true,
      telegramBotToken: true,
    },
  })

  if (!biz?.telegramBotToken) {
    console.log('❌ Немає бізнесу з токеном')
    return
  }

  const token = biz.telegramBotToken
  console.log(`📌 Бізнес: ${biz.name} (${biz.businessIdentifier || biz.id})\n`)

  // 1. getMe
  console.log('1️⃣ getMe (інфо про бота)...')
  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`)
  const meData = await meRes.json()
  if (meData.ok) {
    console.log(`   ✅ @${meData.result.username} — ${meData.result.first_name}`)
  } else {
    console.log(`   ❌ ${meData.description || 'Помилка'}`)
  }

  // 2. getUpdates (останні оновлення)
  console.log('\n2️⃣ getUpdates (останні оновлення)...')
  const upRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=3`)
  const upData = await upRes.json()
  if (upData.ok) {
    const updates = upData.result || []
    console.log(`   Отримано: ${updates.length} оновлень`)
    if (updates.length > 0) {
      for (const u of updates.slice(0, 2)) {
        const msg = u.message || u.callback_query?.message
        const text = u.message?.text || u.callback_query?.data || '(callback)'
        console.log(`   - update_id ${u.update_id}: ${String(text).slice(0, 50)}...`)
      }
    }
  }

  // 3. Симуляція webhook /start
  const identifier = biz.businessIdentifier || '100'
  const webhookUrl = `${BASE.replace(/\/$/, '')}/api/telegram/webhook?businessId=${biz.id}`
  const mockUpdate = {
    update_id: Math.floor(Math.random() * 1e9),
    message: {
      message_id: 1,
      from: { id: 999888777, first_name: 'TestUser', username: 'test_script' },
      chat: { id: 999888777, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text: `/start ${identifier}`,
    },
  }

  console.log(`\n3️⃣ Симуляція webhook POST /start ${identifier}...`)
  const whRes = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mockUpdate),
  })
  const whStatus = whRes.status
  const whText = await whRes.text()
  if (whStatus >= 200 && whStatus < 300) {
    console.log(`   ✅ Webhook відповів: ${whStatus}`)
  } else {
    console.log(`   ⚠️ Webhook: ${whStatus} — ${whText.slice(0, 150)}`)
  }

  console.log('\n✅ Тест завершено')
}

main()
  .catch((e) => {
    console.error('Помилка:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

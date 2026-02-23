#!/usr/bin/env tsx
/**
 * Симуляція повного запису через Telegram: /start → Записатися → майстер → послуга → дата → час → телефон
 * npm run telegram:booking-flow (або npx tsx scripts/telegram-booking-flow.ts)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'
const CHAT_ID = 999888777
const TEST_PHONE = '0671234567'

function makeMessageUpdate(text: string, updateId: number) {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      from: { id: CHAT_ID, first_name: 'TestUser', username: 'test_flow' },
      chat: { id: CHAT_ID, type: 'private' as const },
      date: Math.floor(Date.now() / 1000),
      text,
    },
  }
}

function makeCallbackUpdate(data: string, messageText: string, updateId: number) {
  return {
    update_id: updateId,
    callback_query: {
      id: `cb_${updateId}_${Date.now()}`,
      from: { id: CHAT_ID, first_name: 'TestUser', username: 'test_flow' },
      message: {
        message_id: updateId,
        chat: { id: CHAT_ID, type: 'private' as const },
        date: Math.floor(Date.now() / 1000),
        text: messageText,
      },
      chat_instance: `inst_${updateId}`,
      data,
    },
  }
}

async function postWebhook(businessId: string, update: object): Promise<{ ok: boolean; status: number }> {
  const url = `${BASE.replace(/\/$/, '')}/api/telegram/webhook?businessId=${businessId}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  })
  return { ok: res.ok, status: res.status }
}

async function main() {
  console.log('📅 Симуляція запису через Telegram бота\n')

  const biz = await prisma.business.findFirst({
    where: { telegramBotToken: { not: null }, isActive: true },
    select: { id: true, name: true, businessIdentifier: true },
  })

  if (!biz) {
    console.log('❌ Немає бізнесу з ботом')
    return
  }

  const identifier = biz.businessIdentifier || biz.id
  console.log(`Бізнес: ${biz.name} (${identifier})\n`)

  // Отримати майстрів та availability
  const masters = await prisma.master.findMany({
    where: { businessId: biz.id, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 5,
  })

  if (masters.length === 0) {
    console.log('❌ Немає майстрів')
    return
  }

  const masterId = masters[0].id
  const today = new Date()
  const fromStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const availUrl = `${BASE}/api/availability?businessId=${biz.id}&masterId=${masterId}&from=${fromStr}&days=7&limit=60&durationMinutes=30`
  const availRes = await fetch(availUrl)
  const availData = (await availRes.json()) as { recommendedSlots?: Array<{ date: string; time: string; slot: string }> }
  const slots = availData?.recommendedSlots ?? []

  if (slots.length === 0) {
    console.log('❌ Немає вільних слотів')
    return
  }

  // Беремо 3-й слот, щоб уникати конфліктів з попередніми тестами
  const firstSlot = slots[Math.min(2, slots.length - 1)]
  const slotKey = firstSlot.slot
  const slotSafe = slotKey.replace(/:/g, '_')
  const dateNorm = firstSlot.date

  console.log(`Майстер: ${masters[0].name}`)
  console.log(`Слот: ${slotKey}\n`)

  let updateId = Math.floor(Math.random() * 1000000)

  // 1. /start — створити mapping
  console.log('1. /start …')
  const r1 = await postWebhook(biz.id, makeMessageUpdate(`/start ${identifier}`, ++updateId))
  console.log(`   ${r1.ok ? '✅' : '❌'} ${r1.status}`)

  // 2. book_start
  console.log('2. book_start …')
  const r2 = await postWebhook(biz.id, makeCallbackUpdate('book_start', 'Оберіть дію:', ++updateId))
  console.log(`   ${r2.ok ? '✅' : '❌'} ${r2.status}`)

  // 3. book_m_<id>
  console.log('3. book_m_… (вибір майстра) …')
  const r3 = await postWebhook(biz.id, makeCallbackUpdate(`book_m_${masterId}`, '👤 Оберіть спеціаліста:', ++updateId))
  console.log(`   ${r3.ok ? '✅' : '❌'} ${r3.status}`)

  // 4. book_without_svc
  console.log('4. book_without_svc …')
  const r4 = await postWebhook(biz.id, makeCallbackUpdate('book_without_svc', 'Оберіть:', ++updateId))
  console.log(`   ${r4.ok ? '✅' : '❌'} ${r4.status}`)

  // 5. book_date_<date>
  console.log('5. book_date_… …')
  const r5 = await postWebhook(biz.id, makeCallbackUpdate(`book_date_${dateNorm}`, '📅 Оберіть дату:', ++updateId))
  console.log(`   ${r5.ok ? '✅' : '❌'} ${r5.status}`)

  // 6. book_slot_<slot>
  console.log('6. book_slot_… …')
  const r6 = await postWebhook(biz.id, makeCallbackUpdate(`book_slot_${slotSafe}`, '📅 Оберіть час:', ++updateId))
  console.log(`   ${r6.ok ? '✅' : '❌'} ${r6.status}`)

  // 7. Текст з телефоном
  console.log('7. Текст (телефон) …')
  const r7 = await postWebhook(biz.id, makeMessageUpdate(TEST_PHONE, ++updateId))
  console.log(`   ${r7.ok ? '✅' : '❌'} ${r7.status}`)

  const allOk = r1.ok && r2.ok && r3.ok && r4.ok && r5.ok && r6.ok && r7.ok

  // Перевірка, що запис створився
  const since = new Date(Date.now() - 120 * 1000)
  const lastApt = await prisma.appointment.findFirst({
    where: {
      businessId: biz.id,
      source: 'telegram',
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      clientName: true,
      startTime: true,
      status: true,
      telegramChatId: true,
    },
  })

  if (lastApt) {
    console.log('\n✅ Запис створено:')
    console.log(`   ID: ${lastApt.id}`)
    console.log(`   Клієнт: ${lastApt.clientName}`)
    console.log(`   Час: ${lastApt.startTime.toISOString()}`)
    console.log(`   Статус: ${lastApt.status}`)
    console.log(`   telegramChatId: ${lastApt.telegramChatId || '(немає)'}`)
  } else if (allOk) {
    console.log('\n⚠️ Всі кроки 200, але запис у БД не знайдено (можливо інший номер).')
  } else {
    console.log('\n⚠️ Деякі кроки не пройшли. Перевірте лог.')
  }
}

main()
  .catch((e) => {
    console.error('Помилка:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

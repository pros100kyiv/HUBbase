/**
 * Тест публічного бронювання: 1) створює запис через API (як клієнт) 2) дублікат — очікує 409
 * Запуск: npx tsx scripts/test-public-booking.ts
 */
const BASE = 'http://localhost:3000'

const businessId = 'business-1'
const masterId = 'master-1'
const serviceId = 'service-1'

async function main() {
  // 17:30 на 12 лютого 2026 (Kyiv = UTC+2)
  const date = new Date('2026-02-12T17:30:00+02:00')
  const startTime = date.toISOString()
  const endTime = new Date(date.getTime() + 45 * 60 * 1000).toISOString()

  const body = {
    businessId,
    masterId,
    clientName: 'Публічний Клієнт',
    clientPhone: '+380506667788',
    startTime,
    endTime,
    services: [serviceId],
    isFromBooking: true,
  }

  console.log('1) Публічне бронювання: 17:30–18:15 (12 лют. 2026, Олександр)...')
  const res1 = await fetch(`${BASE}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data1 = await res1.json().catch(() => ({}))
  if (!res1.ok) {
    if (res1.status === 409) {
      console.log('   Час зайнятий — OK, пробуємо дублікат...')
    } else {
      console.log('   Помилка:', data1?.error || res1.status)
      process.exit(1)
    }
  } else {
    console.log('   OK, запис створено:', data1.id)
  }

  console.log('\n2) Спроба другого запису на той самий час...')
  const body2 = { ...body, clientPhone: '+380506667799', clientName: 'Другий Клієнт' }
  const res2 = await fetch(`${BASE}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body2),
  })
  const data2 = await res2.json().catch(() => ({}))
  if (res2.status === 409) {
    console.log('   ✅ API повернув 409 — слот зайнятий (блокування працює)')
  } else {
    console.log('   ❌ Очікувалось 409, отримано:', res2.status, data2)
    process.exit(1)
  }

  console.log('\n✅ Тест публічного бронювання пройдено.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

export {}

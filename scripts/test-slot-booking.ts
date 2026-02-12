/**
 * Тест: 1) створює запис на вільний слот 2) пробує записатися на той самий час — очікує 409
 * Запуск: npx tsx scripts/test-slot-booking.ts
 */
const BASE = 'http://localhost:3000'

const businessId = 'business-1'
const masterId = 'master-1' // Олександр
const serviceId = 'service-1'

async function main() {
  // 12:00–12:30 на 12 лютого 2026 (місцевий час Kyiv)
  const date = new Date('2026-02-12T12:00:00+02:00')
  const startTime = date.toISOString()
  const endTime = new Date(date.getTime() + 30 * 60 * 1000).toISOString()

  const body = {
    businessId,
    masterId,
    clientName: 'Тест Слот Конфлікт',
    clientPhone: '+380509998877',
    startTime,
    endTime,
    services: [serviceId],
    isFromBooking: false,
  }

  console.log('1) Створюємо запис на 12:00–12:30 (12 лют. 2026, Олександр)...')
  const res1 = await fetch(`${BASE}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data1 = await res1.json().catch(() => ({}))
  if (!res1.ok) {
    if (res1.status === 409) {
      console.log('   Час уже зайнятий — можливо запис існує. Пробуємо дублікат...')
    } else {
      console.log('   Помилка:', data1?.error || res1.status)
      process.exit(1)
    }
  } else {
    console.log('   OK, запис створено:', data1.id)
  }

  console.log('\n2) Пробуємо створити ще один запис на той самий час...')
  const body2 = { ...body, clientPhone: '+380509998866', clientName: 'Дублікат' }
  const res2 = await fetch(`${BASE}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body2),
  })
  const data2 = await res2.json().catch(() => ({}))
  if (res2.status === 409) {
    console.log('   ✅ Очікувано: API повернув 409 — слот зайнятий')
  } else {
    console.log('   ❌ Очікувалось 409, отримано:', res2.status, data2)
    process.exit(1)
  }

  console.log('\n✅ Тест пройдено: блокування дублікатів працює.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

export {}

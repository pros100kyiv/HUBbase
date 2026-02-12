/**
 * Інтеграційні тести API: appointments (валідація телефону), statistics (totalRevenue).
 * Потрібен запущений сервер: npm run dev
 * Запуск: npx tsx scripts/api-integration-tests.ts
 */
const BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function testAppointmentsInvalidPhone(): Promise<boolean> {
  const businessId = process.env.TEST_BUSINESS_ID || 'business-1'
  const masterId = process.env.TEST_MASTER_ID || 'master-1'
  const start = new Date()
  start.setHours(20, 0, 0, 0)
  const end = new Date(start.getTime() + 30 * 60 * 1000)

  const res = await fetch(`${BASE}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessId,
      masterId,
      clientName: 'Тест',
      clientPhone: 'invalid',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      services: [],
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status !== 400) {
    console.error('  Очікувалось 400 для невалідного телефону, отримано:', res.status, data)
    return false
  }
  if (!data.error || typeof data.error !== 'string') {
    console.error('  Очікувалось поле error у відповіді:', data)
    return false
  }
  if (!/телефон|phone|формат|невірний/i.test(data.error)) {
    console.error('  Повідомлення має стосуватися телефону:', data.error)
    return false
  }
  return true
}

async function testStatisticsRequiresBusinessId(): Promise<boolean> {
  const res = await fetch(`${BASE}/api/statistics?period=month`)
  const data = await res.json().catch(() => ({}))
  if (res.status !== 400) {
    console.error('  Очікувалось 400 без businessId, отримано:', res.status, data)
    return false
  }
  return true
}

async function testStatisticsTotalRevenueType(businessId: string): Promise<boolean> {
  const res = await fetch(`${BASE}/api/statistics?businessId=${encodeURIComponent(businessId)}&period=month`)
  const data = await res.json().catch(() => ({}))
  if (res.status === 404) {
    console.log('  Пропущено: бізнес не знайдено (нормально для порожньої БД)')
    return true
  }
  if (!res.ok) {
    console.error('  Помилка запиту statistics:', res.status, data)
    return false
  }
  if (typeof data.totalRevenue !== 'number') {
    console.error('  Очікувалось totalRevenue: number, отримано:', typeof data.totalRevenue, data)
    return false
  }
  return true
}

async function main() {
  console.log('API інтеграційні тести (BASE=', BASE, ')\n')

  let ok = 0
  let fail = 0

  console.log('1) POST /api/appointments з невалідним телефоном → 400')
  if (await testAppointmentsInvalidPhone()) {
    console.log('   ✅ OK')
    ok++
  } else {
    fail++
  }

  console.log('\n2) GET /api/statistics без businessId → 400')
  if (await testStatisticsRequiresBusinessId()) {
    console.log('   ✅ OK')
    ok++
  } else {
    fail++
  }

  const businessId = process.env.TEST_BUSINESS_ID || 'business-1'
  console.log('\n3) GET /api/statistics?businessId=... → totalRevenue number')
  if (await testStatisticsTotalRevenueType(businessId)) {
    console.log('   ✅ OK')
    ok++
  } else {
    fail++
  }

  console.log('\n---')
  console.log(`Результат: ${ok} пройдено, ${fail} не пройдено`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

export {}

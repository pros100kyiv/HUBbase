/**
 * Додає тимчасові тестові записи на сьогодні для business-1 (045 Barbershop) через API.
 * Потрібен запущений сервер: npm run dev
 * Запуск: npx tsx scripts/add-test-appointments.ts
 */
const BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'

const businessId = 'business-1'
const masterId = 'master-1'
const serviceId = 'service-1'

const slots = [
  { hour: 10, min: 0, clientName: 'Тест Очікує', clientPhone: '+380501234501', isFromBooking: true },
  { hour: 11, min: 30, clientName: 'Тест Підтверджено', clientPhone: '+380501234502', isFromBooking: false },
  { hour: 14, min: 0, clientName: 'Тест Виконано', clientPhone: '+380501234503', isFromBooking: false },
  { hour: 16, min: 0, clientName: 'Тест Очікує 2', clientPhone: '+380501234504', isFromBooking: true },
]

async function main() {
  const dateArg = process.env.ADD_APPT_DATE || process.argv[2] // YYYY-MM-DD, optional
  const today = dateArg
    ? new Date(dateArg + 'T12:00:00.000Z')
    : new Date()
  today.setUTCHours(0, 0, 0, 0)
  const dateStr = today.toISOString().slice(0, 10)

  const created: string[] = []
  for (const slot of slots) {
    const startTime = new Date(today)
    startTime.setHours(slot.hour, slot.min, 0, 0)
    const endTime = new Date(startTime)
    endTime.setMinutes(endTime.getMinutes() + 30)

    const body = {
      businessId,
      masterId,
      clientName: slot.clientName,
      clientPhone: slot.clientPhone,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      services: [serviceId],
      isFromBooking: slot.isFromBooking,
    }

    try {
      const res = await fetch(`${BASE}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.id) {
        created.push(data.id)
        if (slot.clientName === 'Тест Виконано') {
          await fetch(`${BASE}/api/appointments/${data.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ businessId, status: 'Done' }),
          })
        }
      } else {
        if (res.status === 409) console.log(`   Пропущено ${slot.clientName}: час зайнятий`)
        else console.log(`   Помилка ${slot.clientName}:`, data?.error || res.status)
      }
    } catch (e) {
      console.error(`   Помилка запиту ${slot.clientName}:`, e)
    }
  }

  console.log(`✅ Додано ${created.length} тестових записів на ${dateStr} (business-1)`)
  if (created.length === 0) console.log('   Переконайтесь, що сервер запущено: npm run dev')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

export {}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format, addMinutes, startOfDay, getDay } from 'date-fns'

interface DaySchedule {
  enabled: boolean
  start: string
  end: string
}

interface WorkingHours {
  [key: string]: DaySchedule
}

// date-fns getDay: 0 = Sunday, 1 = Monday, ... 6 = Saturday. Ключі збігаються з MasterScheduleModal (monday..sunday).
const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

// Чому слоти можуть бути порожні (заблоковані):
// 1. Майстер не знайдений або isActive === false → scheduleNotConfigured: true
// 2. master.workingHours порожній/null або для цього дня тижня немає ключа (напр. wednesday) → finalDay.enabled = false → scheduleNotConfigured: true
// 3. Для дня вимкнено (day.enabled === false) у графіку майстра → scheduleNotConfigured: true
// 4. dayStart >= dayEnd (крайній випадок) → scheduleNotConfigured: true
// 5. Графік є, але всі згенеровані слоти зайняті записами або в blockedPeriods → availableSlots: [], reason: 'all_occupied'
// 6. На клієнті: слоти відфільтровані як минулі (futureOnly) — якщо обрано сьогодні і зараз пізно, усі слоти можуть бути в минулому

function parseWorkingHours(json: string | null): WorkingHours | null {
  if (!json || !json.trim()) return null
  try {
    const parsed = JSON.parse(json)
    if (parsed && typeof parsed === 'object') return parsed
  } catch (e) {
    console.error('Error parsing working hours:', e)
  }
  return null
}

/** Повертає діапазон годин дня. Якщо графік не налаштований або день вимкнений — enabled: false (не підставляємо 9–21). */
function getDayWindow(
  workingHours: WorkingHours | null,
  dayName: string
): { start: number; end: number; enabled: boolean } {
  if (!workingHours || !workingHours[dayName]) {
    return { start: 0, end: 0, enabled: false }
  }
  const day = workingHours[dayName]
  if (!day.enabled) {
    return { start: 0, end: 0, enabled: false }
  }
  const [startH, startM] = (day.start || '09:00').split(':').map(Number)
  const [endH, endM] = (day.end || '18:00').split(':').map(Number)
  const start = startH + (startM || 0) / 60
  const endExact = endH + (endM || 0) / 60
  const startHour = Math.floor(start)
  const endHour = endExact > Math.floor(endExact) ? Math.ceil(endExact) : Math.floor(endExact)
  return { start: startHour, end: endHour, enabled: true }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const masterId = searchParams.get('masterId')
    const businessId = searchParams.get('businessId')
    const dateParam = searchParams.get('date')
    const durationParam = searchParams.get('durationMinutes')

    if (!masterId || !businessId || !dateParam) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const durationMinutes = durationParam ? Math.max(30, Math.min(480, parseInt(durationParam, 10) || 30)) : 30

    const dateParts = dateParam.split('-')
    if (dateParts.length !== 3) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    const year = parseInt(dateParts[0], 10)
    const month = parseInt(dateParts[1], 10) - 1
    const day = parseInt(dateParts[2], 10)
    const dateNorm = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const date = new Date(year, month, day)
    const startOfSelectedDay = startOfDay(date)
    const endOfDayDate = new Date(startOfSelectedDay)
    endOfDayDate.setHours(23, 59, 59, 999)

    const master = await prisma.master.findUnique({
      where: { id: masterId },
      select: { workingHours: true, blockedPeriods: true, isActive: true },
    })

    if (!master || master.isActive === false) {
      return NextResponse.json({
        availableSlots: [],
        scheduleNotConfigured: true,
        message: 'Спеціаліст недоступний або графік не налаштовано.',
      })
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        businessId,
        masterId,
        startTime: { gte: startOfSelectedDay, lte: endOfDayDate },
        status: { not: 'Cancelled' },
      },
    })

    const masterWH = parseWorkingHours(master.workingHours)

    const dayOfWeek = getDay(date)
    const dayName = dayNames[dayOfWeek]

    // Слоти тільки за графіком майстра; графік бізнесу поки не використовуємо
    const finalDay = getDayWindow(masterWH, dayName)

    if (!finalDay.enabled) {
      return NextResponse.json({
        availableSlots: [],
        scheduleNotConfigured: true,
        message: 'Графік майстра не налаштовано або на цей день немає робочого часу.',
      })
    }

    const dayStart = finalDay.start
    const dayEnd = finalDay.end

    if (dayStart >= dayEnd) {
      return NextResponse.json({
        availableSlots: [],
        scheduleNotConfigured: true,
        message: 'На цей день немає робочого вікна.',
      })
    }

    let blockedPeriods: Array<{ start: string; end: string }> = []
    if (master.blockedPeriods) {
      try {
        blockedPeriods = JSON.parse(master.blockedPeriods)
      } catch (e) {
        console.error('Error parsing blocked periods:', e)
      }
    }

    // Ключі слотів у форматі YYYY-MM-DDTHH:mm — той самий формат, що й у клієнта (dateStr + 'T' + time).
    // Генеруємо по даті з запиту та годинах робочого вікна майстра (минулі фільтрує клієнт).
    const slots: string[] = []
    {
      const dateStr = dateNorm
      for (let hour = dayStart; hour < dayEnd; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const h = String(hour).padStart(2, '0')
          const m = String(minute).padStart(2, '0')
          slots.push(`${dateStr}T${h}:${m}`)
        }
      }
    }

    const occupiedSlots = new Set<string>()
    appointments.forEach((apt) => {
      let current = new Date(apt.startTime)
      const end = new Date(apt.endTime)
      while (current < end) {
        occupiedSlots.add(format(current, "yyyy-MM-dd'T'HH:mm"))
        current = addMinutes(current, 30)
      }
    })

    blockedPeriods.forEach((blocked) => {
      const blockStart = new Date(blocked.start)
      const blockEnd = new Date(blocked.end)
      let current = new Date(blockStart)
      while (current < blockEnd) {
        occupiedSlots.add(format(current, "yyyy-MM-dd'T'HH:mm"))
        current = addMinutes(current, 30)
      }
    })

    const slotStepMinutes = 30
    const stepsNeeded = Math.ceil(durationMinutes / slotStepMinutes)

    const availableSlots = slots.filter((slotStr) => {
      const slotDate = new Date(slotStr)
      for (let i = 0; i < stepsNeeded; i++) {
        const checkTime = addMinutes(slotDate, i * slotStepMinutes)
        const checkStr = format(checkTime, "yyyy-MM-dd'T'HH:mm")
        if (occupiedSlots.has(checkStr)) return false
        const checkHour = checkTime.getHours()
        const checkMin = checkTime.getMinutes()
        const checkValue = checkHour + checkMin / 60
        if (checkValue < dayStart || checkValue >= dayEnd) return false
      }
      return true
    })

    // Якщо графік є, але всі слоти зайняті — повертаємо reason для зрозумілого повідомлення
    const reason = availableSlots.length === 0 ? 'all_occupied' : undefined
    return NextResponse.json({
      availableSlots,
      scheduleNotConfigured: false,
      ...(reason && { reason }),
    })
  } catch (error) {
    console.error('Error fetching availability:', error)
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 })
  }
}

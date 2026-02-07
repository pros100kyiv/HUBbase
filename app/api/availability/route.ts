/**
 * Availability API: вільні слоти для запису до майстра.
 * Логіка: клієнт обирає майстра → дату → запит сюди. Ми беремо графік майстра на цей день,
 * генеруємо слоти по 30 хв, виключаємо зайняті (існуючі записи + blockedPeriods), повертаємо список.
 * Заброньований слот не потрапляє в availableSlots; після створення запису (POST /api/appointments)
 * він з’явиться в кабінеті (календар, Мій день, сповіщення).
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format, addMinutes } from 'date-fns'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** День тижня (0–6) за датою YYYY-MM-DD без залежності від таймзони сервера */
function getDayOfWeek(year: number, month: number, day: number): number {
  const d = new Date(Date.UTC(year, month, day))
  return d.getUTCDay()
}

/** Парсинг workingHours: рядок JSON або об'єкт. Завжди повертає об'єкт { dayName: { enabled, start, end } } або null */
function parseWorkingHours(
  raw: string | Record<string, unknown> | null | undefined
): Record<string, { enabled: boolean; start: string; end: string }> | null {
  if (raw == null) return null
  let obj: Record<string, unknown>
  if (typeof raw === 'string') {
    if (!raw.trim()) return null
    try {
      obj = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  } else if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    obj = raw
  } else {
    return null
  }
  const result: Record<string, { enabled: boolean; start: string; end: string }> = {}
  for (const key of DAY_NAMES) {
    const k = Object.keys(obj).find((x) => x.toLowerCase() === key) ?? key
    const day = obj[k]
    if (day && typeof day === 'object' && day !== null && 'enabled' in day) {
      const d = day as { enabled?: unknown; start?: unknown; end?: unknown }
      result[key] = {
        enabled: d.enabled === true,
        start: typeof d.start === 'string' ? d.start : '09:00',
        end: typeof d.end === 'string' ? d.end : '18:00',
      }
    }
  }
  return Object.keys(result).length > 0 ? result : null
}

/** Вікно годин для дня: start/end у годинах (число). Якщо день не налаштований — null */
function getWindow(
  wh: Record<string, { enabled: boolean; start: string; end: string }> | null,
  dayName: string
): { start: number; end: number } | null {
  if (!wh || !wh[dayName] || !wh[dayName].enabled) return null
  const d = wh[dayName]
  const [sh, sm] = d.start.split(':').map((x) => parseInt(x, 10) || 0)
  const [eh, em] = d.end.split(':').map((x) => parseInt(x, 10) || 0)
  const start = sh + sm / 60
  const end = eh + em / 60
  if (start >= end) return null
  return { start: Math.floor(start), end: Math.ceil(end) }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const masterId = searchParams.get('masterId')
    const businessId = searchParams.get('businessId')
    const dateParam = searchParams.get('date')
    const durationParam = searchParams.get('durationMinutes')

    if (!masterId || !businessId || !dateParam) {
      return NextResponse.json({ availableSlots: [], scheduleNotConfigured: true }, { status: 200 })
    }

    const durationMinutes = durationParam
      ? Math.max(30, Math.min(480, parseInt(durationParam, 10) || 30))
      : 30

    const parts = dateParam.split('-')
    if (parts.length !== 3) {
      return NextResponse.json({ availableSlots: [], scheduleNotConfigured: true }, { status: 200 })
    }

    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return NextResponse.json({ availableSlots: [], scheduleNotConfigured: true }, { status: 200 })
    }

    const dateNorm = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    const master = await prisma.master.findUnique({
      where: { id: masterId },
      select: { workingHours: true, blockedPeriods: true, isActive: true },
    })

    if (!master) {
      return NextResponse.json({ availableSlots: [], scheduleNotConfigured: true }, { status: 200 })
    }

    const dayOfWeek = getDayOfWeek(year, month, day)
    const dayName = DAY_NAMES[dayOfWeek]

    const wh = parseWorkingHours(master.workingHours)
    let window = getWindow(wh, dayName)
    if (!window) {
      window = { start: 9, end: 18 }
    }

    const dayStart = window.start
    const dayEnd = window.end

    const slots: string[] = []
    for (let h = dayStart; h < dayEnd; h++) {
      for (let m = 0; m < 60; m += 30) {
        slots.push(`${dateNorm}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
      }
    }

    const startOfDayDate = new Date(year, month, day, 0, 0, 0, 0)
    const endOfDayDate = new Date(year, month, day, 23, 59, 59, 999)

    const appointments = await prisma.appointment.findMany({
      where: {
        businessId,
        masterId,
        startTime: { gte: startOfDayDate, lte: endOfDayDate },
        status: { not: 'Cancelled' },
      },
    })

    const occupied = new Set<string>()
    for (const apt of appointments) {
      let t = new Date(apt.startTime)
      const end = new Date(apt.endTime)
      while (t < end) {
        const key = format(t, "yyyy-MM-dd'T'HH:mm")
        if (key.startsWith(dateNorm)) occupied.add(key)
        t = addMinutes(t, 30)
      }
    }

    let blockedPeriods: Array<{ start: string; end: string }> = []
    if (master.blockedPeriods) {
      try {
        blockedPeriods = JSON.parse(master.blockedPeriods)
      } catch {
        blockedPeriods = []
      }
    }
    for (const b of blockedPeriods) {
      let t = new Date(b.start)
      const end = new Date(b.end)
      while (t < end) {
        const key = format(t, "yyyy-MM-dd'T'HH:mm")
        if (key.startsWith(dateNorm)) occupied.add(key)
        t = addMinutes(t, 30)
      }
    }

    const steps = Math.ceil(durationMinutes / 30)
    const availableSlots = slots.filter((slotStr) => {
      const slotDate = new Date(slotStr)
      for (let i = 0; i < steps; i++) {
        const t = addMinutes(slotDate, i * 30)
        const key = format(t, "yyyy-MM-dd'T'HH:mm")
        if (occupied.has(key)) return false
        const h = t.getHours()
        const m = t.getMinutes()
        const v = h + m / 60
        if (v < dayStart || v >= dayEnd) return false
      }
      return true
    })

    return NextResponse.json({
      availableSlots,
      scheduleNotConfigured: false,
      ...(availableSlots.length === 0 && { reason: 'all_occupied' }),
    })
  } catch (err) {
    console.error('Availability error:', err)
    return NextResponse.json(
      { availableSlots: [], scheduleNotConfigured: true },
      { status: 200 }
    )
  }
}

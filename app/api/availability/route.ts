/**
 * GET /api/availability
 *
 * Режими:
 * 1) onlySchedule=1 + masterId + businessId — повертає робочі дні тижня: { workingWeekdays: [0..6] }
 * 2) from=YYYY-MM-DD&days=N&limit=M + masterId + businessId + durationMinutes — рекомендовані слоти: { recommendedSlots: [{ date, time, slot }] }
 * 3) date=YYYY-MM-DD + masterId + businessId + durationMinutes — слоти на день: { availableSlots: string[] }
 *
 * Формат слоту: "YYYY-MM-DDTHH:mm"
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format, addMinutes, addDays } from 'date-fns'

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function getDayOfWeekUTC(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month, day)).getUTCDay()
}

function parseWorkingHours(
  raw: string | null | undefined
): Record<string, { enabled: boolean; start: string; end: string }> | null {
  if (raw == null || typeof raw !== 'string' || !raw.trim()) return null
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  const result: Record<string, { enabled: boolean; start: string; end: string }> = {}
  for (const key of DAY_NAMES) {
    const k = Object.keys(obj).find((x) => x.toLowerCase() === key)
    if (!k) continue
    const dayVal = obj[k]
    if (!dayVal || typeof dayVal !== 'object' || Array.isArray(dayVal)) continue
    const d = dayVal as { enabled?: unknown; start?: unknown; end?: unknown }
    result[key] = {
      enabled: d.enabled === true,
      start: typeof d.start === 'string' ? d.start : '09:00',
      end: typeof d.end === 'string' ? d.end : '18:00',
    }
  }
  return Object.keys(result).length > 0 ? result : null
}

function getWindowForDay(
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
  return { start: Math.max(0, Math.floor(start)), end: Math.min(24, Math.ceil(end)) }
}

/** Виключення за датами: { "YYYY-MM-DD": { enabled, start?, end? } }. Якщо enabled: false — вихідний. */
function parseScheduleDateOverrides(
  raw: string | null | undefined
): Record<string, { enabled: boolean; start: string; end: string }> | null {
  if (raw == null || typeof raw !== 'string' || !raw.trim()) return null
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
    const result: Record<string, { enabled: boolean; start: string; end: string }> = {}
    for (const [dateKey, val] of Object.entries(obj)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !val || typeof val !== 'object' || Array.isArray(val)) continue
      const v = val as { enabled?: unknown; start?: unknown; end?: unknown }
      result[dateKey] = {
        enabled: v.enabled === true,
        start: typeof v.start === 'string' ? v.start : '09:00',
        end: typeof v.end === 'string' ? v.end : '18:00',
      }
    }
    return Object.keys(result).length > 0 ? result : null
  } catch {
    return null
  }
}

/** Вікно для конкретної дати: спочатку перевіряємо dateOverrides, потім weekly workingHours. */
function getWindowForDate(
  dateNorm: string,
  dateOverrides: Record<string, { enabled: boolean; start: string; end: string }> | null,
  wh: Record<string, { enabled: boolean; start: string; end: string }> | null,
  dayName: string
): { start: number; end: number } | null {
  const override = dateOverrides?.[dateNorm]
  if (override !== undefined) {
    if (!override.enabled) return null
    const [sh, sm] = override.start.split(':').map((x) => parseInt(x, 10) || 0)
    const [eh, em] = override.end.split(':').map((x) => parseInt(x, 10) || 0)
    const start = sh + sm / 60
    const end = eh + em / 60
    if (start >= end) return null
    return { start: Math.max(0, Math.floor(start)), end: Math.min(24, Math.ceil(end)) }
  }
  const w = getWindowForDay(wh, dayName)
  return w ?? null
}

type MasterRow = { workingHours: string | null; scheduleDateOverrides: string | null; blockedPeriods: string | null }

async function getAvailableSlotsForDate(
  master: MasterRow,
  dateNorm: string,
  businessId: string,
  masterId: string,
  durationMinutes: number,
  now: Date
): Promise<string[]> {
  const parts = dateNorm.split('-')
  if (parts.length !== 3) return []
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  if (isNaN(year) || isNaN(month) || isNaN(day) || month < 0 || month > 11 || day < 1 || day > 31) return []

  const dayOfWeek = getDayOfWeekUTC(year, month, day)
  const dayName = DAY_NAMES[dayOfWeek]
  const wh = parseWorkingHours(master.workingHours)
  const dateOverrides = parseScheduleDateOverrides(master.scheduleDateOverrides)
  const window = getWindowForDate(dateNorm, dateOverrides, wh, dayName)
  if (!window) return []
  const dayStart = Math.max(0, window.start)
  const dayEnd = Math.min(24, Math.max(dayStart + 1, window.end))

  const slots: string[] = []
  for (let h = dayStart; h < dayEnd; h++) {
    for (let m = 0; m < 60; m += 30) {
      slots.push(`${dateNorm}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }

  const startOfDayDate = new Date(year, month, day, 0, 0, 0, 0)
  const endOfDayDate = new Date(year, month, day, 23, 59, 59, 999)
  let appointments: Array<{ startTime: Date; endTime: Date }> = []
  try {
    appointments = await prisma.appointment.findMany({
      where: {
        businessId,
        masterId,
        startTime: { gte: startOfDayDate, lte: endOfDayDate },
        status: { not: 'Cancelled' },
      },
      select: { startTime: true, endTime: true },
    })
  } catch {
    // ignore
  }

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

  let blocked: Array<{ start: string; end: string }> = []
  if (master.blockedPeriods) {
    try {
      blocked = JSON.parse(master.blockedPeriods)
      if (!Array.isArray(blocked)) blocked = []
    } catch {
      blocked = []
    }
  }
  for (const b of blocked) {
    try {
      let t = new Date(b.start)
      const end = new Date(b.end)
      while (t < end) {
        const key = format(t, "yyyy-MM-dd'T'HH:mm")
        if (key.startsWith(dateNorm)) occupied.add(key)
        t = addMinutes(t, 30)
      }
    } catch {
      // skip
    }
  }

  const steps = Math.ceil(durationMinutes / 30)
  return slots
    .filter((slotStr) => {
      if (typeof slotStr !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slotStr)) return false
      const slotDate = new Date(slotStr)
      if (isNaN(slotDate.getTime())) return false
      if (slotDate <= now) return false
      for (let i = 0; i < steps; i++) {
        const t = addMinutes(slotDate, i * 30)
        const key = format(t, "yyyy-MM-dd'T'HH:mm")
        if (occupied.has(key)) return false
        const v = t.getHours() + t.getMinutes() / 60
        if (v < dayStart || v >= dayEnd) return false
      }
      return true
    })
    .filter((s) => s.startsWith(dateNorm))
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const masterId = String(searchParams.get('masterId') ?? '').trim()
    const businessId = String(searchParams.get('businessId') ?? '').trim()
    const dateStr = String(searchParams.get('date') ?? '').trim()
    const onlySchedule = searchParams.get('onlySchedule') === '1'
    const fromStr = String(searchParams.get('from') ?? '').trim()
    const daysParam = searchParams.get('days')
    const limitParam = searchParams.get('limit')
    const durationParam = searchParams.get('durationMinutes')
    const durationMinutes = durationParam
      ? Math.max(30, Math.min(480, parseInt(durationParam, 10) || 30))
      : 30

    if (!masterId || !businessId) {
      return NextResponse.json(
        { availableSlots: [], scheduleNotConfigured: true },
        { status: 200 }
      )
    }

    let master: MasterRow | null = null
    try {
    master = await prisma.master.findUnique({
      where: { id: masterId },
      select: { workingHours: true, scheduleDateOverrides: true, blockedPeriods: true },
    })
    } catch (e) {
      console.error('[availability] master fetch error', e)
      return NextResponse.json(
        { availableSlots: [], scheduleNotConfigured: true },
        { status: 200 }
      )
    }

    if (!master) {
      return NextResponse.json(
        { availableSlots: [], scheduleNotConfigured: true },
        { status: 200 }
      )
    }

    // Режим 1: тільки робочі дні тижня (для блокування вихідних в календарі)
    if (onlySchedule) {
      const wh = parseWorkingHours(master.workingHours)
      const workingWeekdays: number[] = []
      for (let i = 0; i <= 6; i++) {
        const dayName = DAY_NAMES[i]
        if (wh && wh[dayName] && wh[dayName].enabled) workingWeekdays.push(i)
      }
      return NextResponse.json({
        workingWeekdays: workingWeekdays.length > 0 ? workingWeekdays : [0, 1, 2, 3, 4, 5, 6],
        scheduleNotConfigured: false,
      })
    }

    // Режим 2: рекомендовані найближчі слоти (from + days + limit)
    if (fromStr && daysParam && limitParam) {
      const parts = fromStr.split('-')
      if (parts.length !== 3) {
        return NextResponse.json({ recommendedSlots: [] }, { status: 200 })
      }
      const fromYear = parseInt(parts[0], 10)
      const fromMonth = parseInt(parts[1], 10) - 1
      const fromDay = parseInt(parts[2], 10)
      if (isNaN(fromYear) || isNaN(fromMonth) || isNaN(fromDay)) {
        return NextResponse.json({ recommendedSlots: [] }, { status: 200 })
      }
      const days = Math.max(1, Math.min(60, parseInt(daysParam, 10) || 14))
      const limit = Math.max(1, Math.min(20, parseInt(limitParam, 10) || 8))
      const now = new Date()
      const recommendedSlots: Array<{ date: string; time: string; slot: string }> = []
      for (let d = 0; d < days && recommendedSlots.length < limit; d++) {
        const date = addDays(new Date(fromYear, fromMonth, fromDay), d)
        const dateNorm = format(date, 'yyyy-MM-dd')
        const daySlots = await getAvailableSlotsForDate(
          master,
          dateNorm,
          businessId,
          masterId,
          durationMinutes,
          now
        )
        for (const slot of daySlots) {
          if (recommendedSlots.length >= limit) break
          const time = slot.slice(11, 16)
          recommendedSlots.push({ date: dateNorm, time, slot })
        }
      }
      return NextResponse.json({ recommendedSlots })
    }

    // Режим 3: слоти на один день (date=YYYY-MM-DD)
    if (!dateStr) {
      return NextResponse.json(
        { availableSlots: [], scheduleNotConfigured: true },
        { status: 200 }
      )
    }

    const parts = dateStr.split('-')
    if (parts.length !== 3) {
      return NextResponse.json(
        { availableSlots: [], scheduleNotConfigured: true },
        { status: 200 }
      )
    }
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    if (isNaN(year) || isNaN(month) || isNaN(day) || month < 0 || month > 11 || day < 1 || day > 31) {
      return NextResponse.json(
        { availableSlots: [], scheduleNotConfigured: true },
        { status: 200 }
      )
    }

    const dateNorm = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayOfWeek = getDayOfWeekUTC(year, month, day)
    const dayName = DAY_NAMES[dayOfWeek]
    const wh = parseWorkingHours(master.workingHours)
    const dateOverrides = parseScheduleDateOverrides(master.scheduleDateOverrides)
    const window = getWindowForDate(dateNorm, dateOverrides, wh, dayName)
    if (!window) {
      return NextResponse.json({
        availableSlots: [],
        scheduleNotConfigured: false,
        reason: 'day_off',
      })
    }

    const now = new Date()
    const availableSlots = await getAvailableSlotsForDate(
      master,
      dateNorm,
      businessId,
      masterId,
      durationMinutes,
      now
    )

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

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

type DayHours = { enabled: boolean; start: string; end: string; breakStart?: string; breakEnd?: string }

function timeToHours(s: string): number {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10) || 0)
  return h + m / 60
}

function parseWorkingHours(
  raw: string | null | undefined
): Record<string, DayHours> | null {
  if (raw == null || typeof raw !== 'string' || !raw.trim()) return null
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  const result: Record<string, DayHours> = {}
  for (const key of DAY_NAMES) {
    const k = Object.keys(obj).find((x) => x.toLowerCase() === key)
    if (!k) continue
    const dayVal = obj[k]
    if (!dayVal || typeof dayVal !== 'object' || Array.isArray(dayVal)) continue
    const d = dayVal as { enabled?: unknown; start?: unknown; end?: unknown; breakStart?: unknown; breakEnd?: unknown }
    result[key] = {
      enabled: d.enabled === true,
      start: typeof d.start === 'string' ? d.start : '09:00',
      end: typeof d.end === 'string' ? d.end : '18:00',
      breakStart: typeof d.breakStart === 'string' ? d.breakStart : undefined,
      breakEnd: typeof d.breakEnd === 'string' ? d.breakEnd : undefined,
    }
  }
  return Object.keys(result).length > 0 ? result : null
}

/** Повертає масив робочих інтервалів на день (один або два, якщо є перерва). Значення в годинах (дробові), щоб коректно враховувати 09:30, 18:30 тощо. */
function getWindowsForDay(
  wh: Record<string, DayHours> | null,
  dayName: string
): Array<{ start: number; end: number }> | null {
  if (!wh || !wh[dayName] || !wh[dayName].enabled) return null
  const d = wh[dayName]
  const start = timeToHours(d.start)
  const end = timeToHours(d.end)
  if (start >= end) return null
  const startClamp = Math.max(0, start)
  const endClamp = Math.min(24, end)
  const hasBreak =
    d.breakStart != null &&
    d.breakEnd != null &&
    d.breakStart.trim() !== '' &&
    d.breakEnd.trim() !== ''
  if (hasBreak) {
    const bStart = timeToHours(d.breakStart!)
    const bEnd = timeToHours(d.breakEnd!)
    if (bStart < bEnd && bStart >= start && bEnd <= end) {
      return [
        { start: startClamp, end: bStart },
        { start: bEnd, end: endClamp },
      ]
    }
  }
  return [{ start: startClamp, end: endClamp }]
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

/** Вікно для конкретної дати (один інтервал). */
function getWindowForDate(
  dateNorm: string,
  dateOverrides: Record<string, { enabled: boolean; start: string; end: string }> | null,
  wh: Record<string, DayHours> | null,
  dayName: string
): { start: number; end: number } | null {
  const windows = getWindowsForDate(dateNorm, dateOverrides, wh, dayName)
  if (!windows || windows.length === 0) return null
  return windows.length === 1 ? windows[0] : { start: windows[0].start, end: windows[windows.length - 1].end }
}

/** Робочі інтервали для дати: спочатку dateOverrides, потім weekly workingHours (з перервою). */
function getWindowsForDate(
  dateNorm: string,
  dateOverrides: Record<string, { enabled: boolean; start: string; end: string }> | null,
  wh: Record<string, DayHours> | null,
  dayName: string
): Array<{ start: number; end: number }> | null {
  const override = dateOverrides?.[dateNorm]
  if (override !== undefined) {
    if (!override.enabled) return null
    const start = timeToHours(override.start)
    const end = timeToHours(override.end)
    if (start >= end) return null
    return [{ start: Math.max(0, start), end: Math.min(24, end) }]
  }
  return getWindowsForDay(wh, dayName)
}

type MasterRow = { workingHours: string | null; scheduleDateOverrides: string | null }

type BookingSlotsOptions = {
  slotStepMinutes: number
  bufferMinutes: number
  minAdvanceBookingMinutes: number
  maxDaysAhead: number
}

const DEFAULT_BOOKING_OPTIONS: BookingSlotsOptions = {
  slotStepMinutes: 30,
  bufferMinutes: 0,
  minAdvanceBookingMinutes: 60,
  maxDaysAhead: 60,
}

function parseBookingSlotsOptions(settingsRaw: string | null | undefined): BookingSlotsOptions {
  if (!settingsRaw || typeof settingsRaw !== 'string') return DEFAULT_BOOKING_OPTIONS
  try {
    const parsed = JSON.parse(settingsRaw) as Record<string, unknown>
    const b = parsed?.bookingSlots as Record<string, unknown> | undefined
    if (!b || typeof b !== 'object') return DEFAULT_BOOKING_OPTIONS
    return {
      slotStepMinutes: [15, 30, 60].includes(Number(b.slotStepMinutes)) ? Number(b.slotStepMinutes) : 30,
      bufferMinutes: Math.max(0, Math.min(30, Math.round(Number(b.bufferMinutes) || 0))),
      minAdvanceBookingMinutes: Math.max(0, Math.min(10080, Math.round(Number(b.minAdvanceBookingMinutes) || 60))),
      maxDaysAhead: Math.max(1, Math.min(365, Math.round(Number(b.maxDaysAhead) || 60))),
    }
  } catch {
    return DEFAULT_BOOKING_OPTIONS
  }
}

async function getAvailableSlotsForDate(
  master: MasterRow,
  dateNorm: string,
  businessId: string,
  masterId: string,
  durationMinutes: number,
  now: Date,
  options: BookingSlotsOptions = DEFAULT_BOOKING_OPTIONS
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
  const windows = getWindowsForDate(dateNorm, dateOverrides, wh, dayName)
  if (!windows || windows.length === 0) return []

  const { slotStepMinutes, bufferMinutes, minAdvanceBookingMinutes } = options
  const slotStepHours = slotStepMinutes / 60

  // Генерація слотів згідно з налаштуванням (15/30/60 хв)
  const slots: string[] = []
  for (const win of windows) {
    const startSlot = Math.ceil((Math.max(0, win.start) / slotStepHours)) * slotStepHours
    const endSlot = Math.floor((Math.min(24, win.end) / slotStepHours)) * slotStepHours
    for (let slot = startSlot; slot < endSlot; slot += slotStepHours) {
      const h = Math.floor(slot)
      const m = Math.round((slot % 1) * 60)
      slots.push(`${dateNorm}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }

  const startOfDayDate = new Date(year, month, day, 0, 0, 0, 0)
  const endOfDayDate = new Date(year, month, day, 23, 59, 59, 999)
  let appointments: Array<{ startTime: Date; endTime: Date }> = []
  try {
    // Записи, що перетинають день (включно з тими, що починаються вчора і закінчуються сьогодні)
    appointments = await prisma.appointment.findMany({
      where: {
        businessId,
        masterId,
        startTime: { lt: endOfDayDate },
        endTime: { gt: startOfDayDate },
        status: { not: 'Cancelled' },
      },
      select: { startTime: true, endTime: true },
    })
  } catch {
    // ignore
  }

  // Позначаємо зайняті слоти: запис + buffer перекриває слоти
  const occupied = new Set<string>()
  for (const apt of appointments) {
    const aptStart = new Date(apt.startTime)
    const aptEnd = new Date(apt.endTime)
    const effStart = addMinutes(aptStart, -bufferMinutes)
    const effEnd = addMinutes(aptEnd, bufferMinutes)
    const startMinutes = effStart.getHours() * 60 + effStart.getMinutes()
    const startSlotMinutes = Math.floor(startMinutes / slotStepMinutes) * slotStepMinutes
    let t = new Date(effStart)
    t.setHours(Math.floor(startSlotMinutes / 60), startSlotMinutes % 60, 0, 0)
    while (t < effEnd) {
      const key = format(t, "yyyy-MM-dd'T'HH:mm")
      if (key.startsWith(dateNorm)) occupied.add(key)
      t = addMinutes(t, slotStepMinutes)
    }
  }

  const minAdvanceDate = addMinutes(now, minAdvanceBookingMinutes)
  const steps = Math.ceil(durationMinutes / slotStepMinutes)
  const inAnyWindow = (hours: number) =>
    windows.some((w) => hours >= w.start && hours < w.end)
  return slots
    .filter((slotStr) => {
      if (typeof slotStr !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slotStr)) return false
      const slotDate = new Date(slotStr)
      if (isNaN(slotDate.getTime())) return false
      if (slotDate <= now) return false
      if (slotDate < minAdvanceDate) return false
      for (let i = 0; i < steps; i++) {
        const t = addMinutes(slotDate, i * slotStepMinutes)
        const key = format(t, "yyyy-MM-dd'T'HH:mm")
        if (occupied.has(key)) return false
        const v = t.getHours() + t.getMinutes() / 60
        if (!inAnyWindow(v)) return false
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
      select: { workingHours: true, scheduleDateOverrides: true },
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

    // Отримуємо налаштування слотів з бізнесу
    let bookingOptions = DEFAULT_BOOKING_OPTIONS
    try {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { settings: true },
      })
      if (business?.settings) {
        bookingOptions = parseBookingSlotsOptions(business.settings)
      }
    } catch {
      // ignore, use defaults
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
      const days = Math.max(1, Math.min(bookingOptions.maxDaysAhead, parseInt(daysParam, 10) || 14))
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
          now,
          bookingOptions
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
    const windows = getWindowsForDate(dateNorm, dateOverrides, wh, dayName)
    if (!windows || windows.length === 0) {
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
      now,
      bookingOptions
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

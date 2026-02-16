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
import { toZonedTime } from 'date-fns-tz'
import {
  DEFAULT_BOOKING_OPTIONS,
  type BookingSlotsOptions,
  getLocalDayRangeUtc,
  parseBookingSlotsOptions,
  parseBookingTimeZone,
  slotKeyToUtcDate,
} from '@/lib/utils/booking-settings'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' }

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

async function getAvailableSlotsForDate(
  master: MasterRow,
  dateNorm: string,
  businessId: string,
  masterId: string,
  durationMinutes: number,
  now: Date,
  options: BookingSlotsOptions = DEFAULT_BOOKING_OPTIONS,
  timeZone: string
): Promise<{ available: string[]; busySlots: string[] }> {
  const empty = { available: [] as string[], busySlots: [] as string[] }
  const parts = dateNorm.split('-')
  if (parts.length !== 3) return empty
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1
  const day = parseInt(parts[2], 10)
  if (isNaN(year) || isNaN(month) || isNaN(day) || month < 0 || month > 11 || day < 1 || day > 31) return empty

  const dayOfWeek = getDayOfWeekUTC(year, month, day)
  const dayName = DAY_NAMES[dayOfWeek]
  const wh = parseWorkingHours(master.workingHours)
  const dateOverrides = parseScheduleDateOverrides(master.scheduleDateOverrides)
  const windows = getWindowsForDate(dateNorm, dateOverrides, wh, dayName)
  if (!windows || windows.length === 0) return empty

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

  const dayRange = getLocalDayRangeUtc(dateNorm, timeZone)
  if (!dayRange) return empty
  const { startUtc: startOfDayUtc, endExclusiveUtc } = dayRange
  let appointments: Array<{ startTime: Date; endTime: Date }> = []
  try {
    // Записи, що перетинають локальний день у `timeZone`.
    appointments = await prisma.appointment.findMany({
      where: {
        businessId,
        masterId,
        startTime: { lt: endExclusiveUtc },
        endTime: { gt: startOfDayUtc },
        status: { notIn: ['Cancelled', 'Скасовано'] },
      },
      select: { startTime: true, endTime: true },
    })
  } catch {
    // ignore
  }

  // Позначаємо зайняті слоти: запис + buffer перекриває слоти
  const occupied = new Set<string>()
  for (const apt of appointments) {
    const aptStartUtc = new Date(apt.startTime)
    const aptEndUtc = new Date(apt.endTime)
    const effStartUtc = addMinutes(aptStartUtc, -bufferMinutes)
    const effEndUtc = addMinutes(aptEndUtc, bufferMinutes)

    // Convert to business TZ before rounding to step; otherwise server TZ can shift slot mapping.
    const effStartZoned = toZonedTime(effStartUtc, timeZone)
    const startMinutes = effStartZoned.getHours() * 60 + effStartZoned.getMinutes()
    const startSlotMinutes = Math.floor(startMinutes / slotStepMinutes) * slotStepMinutes

    const startDateNorm = format(effStartZoned, 'yyyy-MM-dd')
    const h = Math.floor(startSlotMinutes / 60)
    const m = startSlotMinutes % 60
    const startKey = `${startDateNorm}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    let tUtc = slotKeyToUtcDate(startKey, timeZone)
    if (!tUtc) continue

    while (tUtc < effEndUtc) {
      const key = format(toZonedTime(tUtc, timeZone), "yyyy-MM-dd'T'HH:mm")
      if (key.startsWith(dateNorm)) occupied.add(key)
      tUtc = addMinutes(tUtc, slotStepMinutes)
    }
  }

  const nowUtc = now
  const minAdvanceUtc = addMinutes(nowUtc, minAdvanceBookingMinutes)
  const steps = Math.ceil(durationMinutes / slotStepMinutes)
  const inAnyWindow = (hours: number) =>
    windows.some((w) => hours >= w.start && hours < w.end)
  const available = slots
    .filter((slotStr) => {
      if (typeof slotStr !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slotStr)) return false
      const slotStartUtc = slotKeyToUtcDate(slotStr, timeZone)
      if (!slotStartUtc || isNaN(slotStartUtc.getTime())) return false
      if (slotStartUtc <= nowUtc) return false
      if (slotStartUtc < minAdvanceUtc) return false
      for (let i = 0; i < steps; i++) {
        const tUtc = addMinutes(slotStartUtc, i * slotStepMinutes)
        const tZoned = toZonedTime(tUtc, timeZone)
        const key = format(tZoned, "yyyy-MM-dd'T'HH:mm")
        if (occupied.has(key)) return false
        const v = tZoned.getHours() + tZoned.getMinutes() / 60
        if (!inAnyWindow(v)) return false
      }
      return true
    })
    .filter((s) => s.startsWith(dateNorm))
  const busySlots = slots.filter((s) => s.startsWith(dateNorm) && occupied.has(s))
  return { available, busySlots }
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
        { status: 200, headers: NO_STORE_HEADERS }
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
        { status: 200, headers: NO_STORE_HEADERS }
      )
    }

    if (!master) {
      return NextResponse.json(
        { availableSlots: [], scheduleNotConfigured: true },
        { status: 200, headers: NO_STORE_HEADERS }
      )
    }

    // Отримуємо налаштування слотів з бізнесу
    let bookingOptions = DEFAULT_BOOKING_OPTIONS
    let timeZone = parseBookingTimeZone(null)
    try {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { settings: true },
      })
      if (business?.settings) {
        bookingOptions = parseBookingSlotsOptions(business.settings)
        timeZone = parseBookingTimeZone(business.settings)
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
      }, { headers: NO_STORE_HEADERS })
    }

    // Режим 2: рекомендовані найближчі слоти (from + days + limit)
    if (fromStr && daysParam && limitParam) {
      const parts = fromStr.split('-')
      if (parts.length !== 3) {
        return NextResponse.json({ recommendedSlots: [] }, { status: 200, headers: NO_STORE_HEADERS })
      }
      const fromYear = parseInt(parts[0], 10)
      const fromMonth = parseInt(parts[1], 10) - 1
      const fromDay = parseInt(parts[2], 10)
      if (isNaN(fromYear) || isNaN(fromMonth) || isNaN(fromDay)) {
        return NextResponse.json({ recommendedSlots: [] }, { status: 200, headers: NO_STORE_HEADERS })
      }
      const days = Math.max(1, Math.min(bookingOptions.maxDaysAhead, parseInt(daysParam, 10) || 14))
      const limit = Math.max(1, Math.min(20, parseInt(limitParam, 10) || 8))
      const now = new Date()
      const recommendedSlots: Array<{ date: string; time: string; slot: string }> = []
      for (let d = 0; d < days && recommendedSlots.length < limit; d++) {
        const date = addDays(new Date(fromYear, fromMonth, fromDay), d)
        const dateNorm = format(date, 'yyyy-MM-dd')
        const { available: daySlots } = await getAvailableSlotsForDate(
          master,
          dateNorm,
          businessId,
          masterId,
          durationMinutes,
          now,
          bookingOptions,
          timeZone
        )
        for (const slot of daySlots) {
          if (recommendedSlots.length >= limit) break
          const time = slot.slice(11, 16)
          recommendedSlots.push({ date: dateNorm, time, slot })
        }
      }
      return NextResponse.json({ recommendedSlots }, { headers: NO_STORE_HEADERS })
    }

    // Режим 3: слоти на один день (date=YYYY-MM-DD)
    if (!dateStr) {
      return NextResponse.json(
        { availableSlots: [], scheduleNotConfigured: true },
        { status: 200, headers: NO_STORE_HEADERS }
      )
    }

    const parts = dateStr.split('-')
    if (parts.length !== 3) {
      return NextResponse.json(
        { availableSlots: [], scheduleNotConfigured: true },
        { status: 200, headers: NO_STORE_HEADERS }
      )
    }
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    if (isNaN(year) || isNaN(month) || isNaN(day) || month < 0 || month > 11 || day < 1 || day > 31) {
      return NextResponse.json(
        { availableSlots: [], scheduleNotConfigured: true },
        { status: 200, headers: NO_STORE_HEADERS }
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
      }, { headers: NO_STORE_HEADERS })
    }

    const now = new Date()
    const { available: availableSlots, busySlots } = await getAvailableSlotsForDate(
      master,
      dateNorm,
      businessId,
      masterId,
      durationMinutes,
      now,
      bookingOptions,
      timeZone
    )

    return NextResponse.json({
      availableSlots,
      busySlots: busySlots || [],
      scheduleNotConfigured: false,
      ...(availableSlots.length === 0 && { reason: 'all_occupied' }),
    }, { headers: NO_STORE_HEADERS })
  } catch (err) {
    console.error('Availability error:', err)
    return NextResponse.json(
      { availableSlots: [], scheduleNotConfigured: true },
      { status: 200, headers: NO_STORE_HEADERS }
    )
  }
}

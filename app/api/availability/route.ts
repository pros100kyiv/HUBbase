/**
 * GET /api/availability?masterId=...&businessId=...&date=YYYY-MM-DD&durationMinutes=30
 *
 * Повертає вільні слоти для запису до майстра на вказану дату.
 * Логіка: графік майстра (workingHours) → вікно годин на день → слоти по 30 хв → мінус зайняті (записи + blockedPeriods).
 * Формат слоту: "YYYY-MM-DDTHH:mm" (локальний час без Z).
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format, addMinutes } from 'date-fns'

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
): { start: number; end: number } {
  if (!wh || !wh[dayName] || !wh[dayName].enabled) return { start: 9, end: 18 }
  const d = wh[dayName]
  const [sh, sm] = d.start.split(':').map((x) => parseInt(x, 10) || 0)
  const [eh, em] = d.end.split(':').map((x) => parseInt(x, 10) || 0)
  const start = sh + sm / 60
  const end = eh + em / 60
  if (start >= end) return { start: 9, end: 18 }
  return { start: Math.max(0, Math.floor(start)), end: Math.min(24, Math.ceil(end)) }
}

export async function GET(request: Request) {
  const url = request.url
  let masterId: string
  let businessId: string
  let dateStr: string
  let durationMinutes: number

  try {
    const { searchParams } = new URL(url)
    masterId = String(searchParams.get('masterId') ?? '').trim()
    businessId = String(searchParams.get('businessId') ?? '').trim()
    dateStr = String(searchParams.get('date') ?? '').trim()
    const durationParam = searchParams.get('durationMinutes')
    durationMinutes = durationParam
      ? Math.max(30, Math.min(480, parseInt(durationParam, 10) || 30))
      : 30
  } catch {
    return NextResponse.json(
      { availableSlots: [], scheduleNotConfigured: true },
      { status: 200 }
    )
  }

  if (!masterId || !businessId || !dateStr) {
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

  let master: { workingHours: string | null; blockedPeriods: string | null } | null = null
  try {
    master = await prisma.master.findUnique({
      where: { id: masterId },
      select: { workingHours: true, blockedPeriods: true },
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

  const dayOfWeek = getDayOfWeekUTC(year, month, day)
  const dayName = DAY_NAMES[dayOfWeek]
  const wh = parseWorkingHours(master.workingHours)
  const window = getWindowForDay(wh, dayName)
  const dayStart = Math.max(0, window.start)
  const dayEnd = Math.min(24, Math.max(dayStart + 1, window.end))

  const slots: string[] = []
  for (let h = dayStart; h < dayEnd; h++) {
    for (let m = 0; m < 60; m += 30) {
      slots.push(`${dateNorm}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }

  const startOfDay = new Date(year, month, day, 0, 0, 0, 0)
  const endOfDay = new Date(year, month, day, 23, 59, 59, 999)
  let appointments: Array<{ startTime: Date; endTime: Date }> = []
  try {
    appointments = await prisma.appointment.findMany({
      where: {
        businessId,
        masterId,
        startTime: { gte: startOfDay, lte: endOfDay },
        status: { not: 'Cancelled' },
      },
      select: { startTime: true, endTime: true },
    })
  } catch (e) {
    console.error('[availability] appointments fetch error', e)
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
      // skip invalid block
    }
  }

  const steps = Math.ceil(durationMinutes / 30)
  const availableSlots = slots
    .filter((slotStr) => {
      if (typeof slotStr !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slotStr)) return false
      const slotDate = new Date(slotStr)
      if (isNaN(slotDate.getTime())) return false
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

  return NextResponse.json({
    availableSlots,
    scheduleNotConfigured: false,
    ...(availableSlots.length === 0 && { reason: 'all_occupied' }),
  })
}

import { fromZonedTime } from 'date-fns-tz'

export type BookingSlotsOptions = {
  slotStepMinutes: number
  bufferMinutes: number
  minAdvanceBookingMinutes: number
  maxDaysAhead: number
}

export const DEFAULT_BOOKING_OPTIONS: BookingSlotsOptions = {
  slotStepMinutes: 30,
  bufferMinutes: 0,
  minAdvanceBookingMinutes: 60,
  maxDaysAhead: 60,
}

export const DEFAULT_BOOKING_TIME_ZONE = 'Europe/Kyiv'

function isValidTimeZone(tz: string): boolean {
  try {
    // Throws RangeError for unknown tz.
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date())
    return true
  } catch {
    return false
  }
}

export function parseBookingSlotsOptions(settingsRaw: string | null | undefined): BookingSlotsOptions {
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

export function parseBookingTimeZone(settingsRaw: string | null | undefined): string {
  if (!settingsRaw || typeof settingsRaw !== 'string') return DEFAULT_BOOKING_TIME_ZONE
  try {
    const parsed = JSON.parse(settingsRaw) as Record<string, unknown>
    const tzRaw =
      (typeof parsed.timeZone === 'string' && parsed.timeZone.trim()) ||
      (typeof (parsed.bookingSlots as any)?.timeZone === 'string' && String((parsed.bookingSlots as any).timeZone).trim()) ||
      ''
    const tz = String(tzRaw).trim()
    if (tz && isValidTimeZone(tz)) return tz
    return DEFAULT_BOOKING_TIME_ZONE
  } catch {
    return DEFAULT_BOOKING_TIME_ZONE
  }
}

export function addDaysToDateNorm(dateNorm: string, days: number): string | null {
  const parts = dateNorm.split('-')
  if (parts.length !== 3) return null
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10) - 1
  const d = parseInt(parts[2], 10)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  const dt = new Date(Date.UTC(y, m, d, 12, 0, 0, 0))
  dt.setUTCDate(dt.getUTCDate() + Math.trunc(days))
  const yy = dt.getUTCFullYear()
  const mm = dt.getUTCMonth() + 1
  const dd = dt.getUTCDate()
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

/**
 * slotKey: "YYYY-MM-DDTHH:mm" interpreted as wall-clock time in `timeZone`.
 * Returns the UTC Date (instant) or null if invalid.
 */
export function slotKeyToUtcDate(slotKey: string, timeZone: string): Date | null {
  if (typeof slotKey !== 'string') return null
  const s = slotKey.trim()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return null
  try {
    // Add seconds to make it explicit (still no tz -> treated by fromZonedTime).
    return fromZonedTime(`${s}:00`, timeZone)
  } catch {
    return null
  }
}

/**
 * Returns UTC instants that bound the local day in `timeZone`.
 * Use as [startUtc, endExclusiveUtc) for DB queries.
 */
export function getLocalDayRangeUtc(dateNorm: string, timeZone: string): { startUtc: Date; endExclusiveUtc: Date } | null {
  const next = addDaysToDateNorm(dateNorm, 1)
  if (!next) return null
  try {
    const startUtc = fromZonedTime(`${dateNorm}T00:00:00`, timeZone)
    const endExclusiveUtc = fromZonedTime(`${next}T00:00:00`, timeZone)
    return { startUtc, endExclusiveUtc }
  } catch {
    return null
  }
}


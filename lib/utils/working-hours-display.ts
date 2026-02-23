/**
 * Форматує workingHours (JSON) у людино-читабельний текст для відображення.
 */

type DaySchedule = { enabled?: boolean; start?: string; end?: string }
type WorkingHours = Record<string, DaySchedule>

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

function parseWorkingHours(raw: string | null | undefined): WorkingHours | null {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null
  try {
    const obj = JSON.parse(raw) as unknown
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
    return obj as WorkingHours
  } catch {
    return null
  }
}

/**
 * Повертає короткий опис графіку: "Пн–Пт 09:00–18:00", "Вихідні", "Графік не налаштовано"
 */
export function formatWorkingHoursSummary(workingHours?: string | null): string {
  const hours = parseWorkingHours(workingHours)
  if (!hours) return 'Графік не налаштовано'
  const enabled = DAY_KEYS.filter((key) => hours[key]?.enabled)
  if (enabled.length === 0) return 'Вихідні'
  const first = enabled[0]
  const last = enabled[enabled.length - 1]
  const firstDay = DAY_LABELS[DAY_KEYS.indexOf(first)]
  const lastDay = DAY_LABELS[DAY_KEYS.indexOf(last)]
  const start = hours[first]?.start ?? '09:00'
  const end = hours[first]?.end ?? '18:00'
  const sameHours = enabled.every(
    (k) => hours[k]?.start === start && hours[k]?.end === end
  )
  if (sameHours) return `${firstDay}–${lastDay} ${start}–${end}`
  return 'За графіком'
}

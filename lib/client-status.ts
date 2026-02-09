/**
 * Рекомендований статус клієнта за візитами, сумою та останнім візитом.
 * Пороги можна змінити під бізнес.
 */
export type ClientStatusValue = 'new' | 'regular' | 'vip' | 'inactive'

export interface ClientStatusThresholds {
  /** Мінімум візитів для "Постійний" */
  regularMinVisits: number
  /** Мінімум візитів АБО сума (грн) для "VIP" */
  vipMinVisits: number
  vipMinSpentGrn: number
  /** Днів без візиту → "Неактивний" */
  inactiveDaysWithoutVisit: number
}

const DEFAULT_THRESHOLDS: ClientStatusThresholds = {
  regularMinVisits: 3,
  vipMinVisits: 10,
  vipMinSpentGrn: 5000,
  inactiveDaysWithoutVisit: 90,
}

/**
 * Повертає рекомендований статус за кількістю візитів, сумою витрат (грн) та датою останнього візиту.
 * Пріоритет: inactive (якщо давно не було) → vip → regular → new.
 * totalSpentGrnOrCents: сума в гривнях (або в копійках — тоді передайте true в isCents).
 */
export function getSuggestedClientStatus(
  totalAppointments: number,
  totalSpentGrnOrCents: number,
  lastAppointmentDate: Date | string | null | undefined,
  thresholds: Partial<ClientStatusThresholds> = {},
  isCents = false
): ClientStatusValue {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds }
  const totalSpentGrn = isCents ? Math.round(Number(totalSpentGrnOrCents) / 100) : Math.round(Number(totalSpentGrnOrCents))

  // Неактивний: немає візитів або останній візит давно
  if (totalAppointments === 0) return 'new'
  const lastDate = lastAppointmentDate ? new Date(lastAppointmentDate) : null
  if (lastDate && !isNaN(lastDate.getTime())) {
    const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (24 * 60 * 60 * 1000))
    if (daysSince >= t.inactiveDaysWithoutVisit) return 'inactive'
  }

  // VIP: багато візитів або велика сума
  if (totalAppointments >= t.vipMinVisits || totalSpentGrn >= t.vipMinSpentGrn) return 'vip'
  // Постійний: кілька візитів
  if (totalAppointments >= t.regularMinVisits) return 'regular'
  return 'new'
}

'use client'

import { useBooking } from '@/contexts/BookingContext'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { formatInTimeZone } from 'date-fns-tz'

interface CompleteStepProps {
  businessName?: string
  businessLocation?: string | null
  /** Business booking timezone (from business settings). */
  timeZone?: string
}

function formatStatusLabel(status?: string | null): { label: string; tone: 'neutral' | 'success' | 'warning' | 'error' } {
  const s = (status || '').toLowerCase()
  if (!s) return { label: 'Статус невідомий', tone: 'neutral' }
  if (s === 'pending') return { label: 'Очікує підтвердження', tone: 'warning' }
  if (s === 'confirmed') return { label: 'Підтверджено', tone: 'success' }
  if (s === 'completed') return { label: 'Виконано', tone: 'success' }
  if (s === 'cancelled') return { label: 'Скасовано', tone: 'error' }
  // UA / other legacy statuses
  if (s.includes('очіку')) return { label: 'Очікує підтвердження', tone: 'warning' }
  if (s.includes('підтвер')) return { label: 'Підтверджено', tone: 'success' }
  if (s.includes('скас')) return { label: 'Скасовано', tone: 'error' }
  if (s.includes('викон')) return { label: 'Виконано', tone: 'success' }
  return { label: status || 'Статус', tone: 'neutral' }
}

export function CompleteStep({ businessName, businessLocation, timeZone }: CompleteStepProps) {
  const { state, reset, setStep } = useBooking()

  const isPriceAfterProcedure =
    state.bookingWithoutService || (state.customServiceName && state.customServiceName.trim().length > 0)
  const totalPrice = state.selectedServices.reduce((sum, s) => sum + s.price, 0)

  const servicesLabel = isPriceAfterProcedure
    ? (state.customServiceName?.trim() ? state.customServiceName.trim() : 'Без послуги — вартість після процедури')
    : (state.selectedServices.length ? state.selectedServices.map((s) => s.name).join(', ') : '—')

  const effectiveTimeZone =
    timeZone ||
    (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '') ||
    'Europe/Kyiv'

  const dateLabel = (() => {
    const startIso = state.confirmation?.startTime
    const endIso = state.confirmation?.endTime
    if (startIso) {
      const start = new Date(startIso)
      if (Number.isFinite(start.getTime())) {
        const day = formatInTimeZone(start, effectiveTimeZone, 'd MMMM yyyy', { locale: uk })
        const startHm = formatInTimeZone(start, effectiveTimeZone, 'HH:mm', { locale: uk })
        if (endIso) {
          const end = new Date(endIso)
          if (Number.isFinite(end.getTime())) {
            const endHm = formatInTimeZone(end, effectiveTimeZone, 'HH:mm', { locale: uk })
            return `${day}, ${startHm}–${endHm}`
          }
        }
        return `${day}, ${startHm}`
      }
    }
    if (state.selectedDate && state.selectedTime) {
      return `${format(state.selectedDate, 'd MMMM yyyy', { locale: uk })}, ${state.selectedTime}`
    }
    return '—'
  })()

  const statusInfo = formatStatusLabel(state.confirmation?.status)

  const handleNewBooking = () => {
    reset()
    setStep(0)
  }

  return (
    <div className="min-h-screen py-4 sm:py-6 px-3 md:px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 text-center text-foreground" style={{ letterSpacing: '-0.02em' }}>
          Ви записані
        </h2>

        <div className="rounded-xl p-4 mb-4 card-glass border border-black/10 dark:border-white/10">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">Статус:</span>
              <span
                className={cn(
                  'text-xs font-semibold px-2 py-1 rounded-full border whitespace-nowrap',
                  statusInfo.tone === 'success' && 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300',
                  statusInfo.tone === 'warning' && 'bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-200',
                  statusInfo.tone === 'error' && 'bg-rose-500/10 border-rose-500/25 text-rose-800 dark:text-rose-200',
                  statusInfo.tone === 'neutral' && 'bg-black/[0.03] dark:bg-white/5 border-black/10 dark:border-white/10 text-gray-700 dark:text-gray-300'
                )}
                title={state.confirmation?.status || undefined}
              >
                {statusInfo.label}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">Куди:</span>
              <span className="font-medium text-foreground dark:text-white text-right">
                {businessName || '—'}
              </span>
            </div>
            {businessLocation && businessLocation.trim() && (
              <div className="flex justify-between gap-3">
                <span className="text-gray-600 dark:text-gray-400">Адреса:</span>
                <span className="font-medium text-foreground dark:text-white text-right max-w-[65%]">
                  {businessLocation.trim()}
                </span>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">Спеціаліст:</span>
              <span className="font-medium text-foreground dark:text-white text-right">
                {state.selectedMaster?.name || '—'}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">Коли:</span>
              <span className="font-medium text-foreground dark:text-white text-right">{dateLabel}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">Що будете робити:</span>
              <span className="font-medium text-foreground dark:text-white text-right max-w-[65%]">
                {servicesLabel}
              </span>
            </div>
            <div className="flex justify-between gap-3 pt-2 border-t border-black/10 dark:border-white/10">
              <span className="text-gray-600 dark:text-gray-400">Сума:</span>
              <span className="text-lg font-bold text-purple-500">
                {isPriceAfterProcedure ? 'Узгоджується' : `${Math.round(totalPrice)} ₴`}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl p-4 mb-4 card-glass border border-black/10 dark:border-white/10">
          <p className="text-sm font-semibold text-foreground mb-2">Нагадування</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            Скоро додамо нагадування у Telegram / SMS. Поки що кнопка неактивна.
          </p>
          <button
            type="button"
            disabled
            className={cn(
              'w-full min-h-[48px] py-3 rounded-xl text-sm font-semibold transition-colors',
              'bg-black/[0.06] dark:bg-white/10 border border-black/10 dark:border-white/15',
              'text-gray-500 dark:text-gray-400 cursor-not-allowed'
            )}
            aria-disabled="true"
            title="Скоро"
          >
            Отримати нагадування (скоро)
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleNewBooking}
            className="flex-1 min-h-[48px] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors active:scale-[0.98]"
          >
            Створити ще один запис
          </button>
          <button
            type="button"
            onClick={() => { if (typeof window !== 'undefined') window.location.href = '/' }}
            className="flex-1 min-h-[48px] py-2.5 rounded-xl border border-black/10 dark:border-white/20 bg-black/[0.04] dark:bg-white/10 text-foreground dark:text-white text-sm font-medium hover:bg-black/[0.06] dark:hover:bg-white/20 transition-colors active:scale-[0.98]"
          >
            На головну
          </button>
        </div>
      </div>
    </div>
  )
}


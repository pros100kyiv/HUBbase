'use client'

import { useState, useEffect, useRef } from 'react'
import { useBooking } from '@/contexts/BookingContext'
import { cn } from '@/lib/utils'
import {
  format,
  isSameDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isPast,
  addMonths,
  subMonths,
  startOfDay,
  parse,
} from 'date-fns'
import { uk } from 'date-fns/locale'

interface TimeStepProps {
  businessId?: string
}

interface RecommendedSlot {
  date: string
  time: string
  slot: string
}

export function TimeStep({ businessId }: TimeStepProps) {
  const { state, setDate, setTime, setStep } = useBooking()
  const [slots, setSlots] = useState<string[]>([])
  const [scheduleNotConfigured, setScheduleNotConfigured] = useState(false)
  const [reason, setReason] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [calendarReady, setCalendarReady] = useState(false)
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null)
  const [workingWeekdays, setWorkingWeekdays] = useState<number[]>([])
  const [recommendedSlots, setRecommendedSlots] = useState<RecommendedSlot[]>([])
  const todayRef = useRef<Date | null>(null)

  const effectiveBusinessId = businessId ?? state.businessId ?? null
  const masterId =
    state.selectedMaster && typeof state.selectedMaster.id === 'string'
      ? state.selectedMaster.id.trim()
      : ''
  const totalDuration = Math.max(
    30,
    state.selectedServices.reduce((sum, s) => sum + s.duration, 0) || 30
  )

  useEffect(() => {
    const today = startOfDay(new Date())
    todayRef.current = today
    setCurrentMonth(today)
    setCalendarReady(true)
  }, [])

  const bid = typeof effectiveBusinessId === 'string' ? effectiveBusinessId.trim() : ''

  // Робочі дні тижня майстра (для блокування вихідних в календарі)
  useEffect(() => {
    if (!masterId || !bid) {
      setWorkingWeekdays([])
      return
    }
    const params = new URLSearchParams({
      masterId,
      businessId: bid,
      onlySchedule: '1',
    })
    fetch(`/api/availability?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        const w = data?.workingWeekdays
        setWorkingWeekdays(Array.isArray(w) && w.length > 0 ? w : [])
      })
      .catch(() => setWorkingWeekdays([]))
  }, [masterId, bid])

  // Рекомендовані найближчі слоти
  useEffect(() => {
    if (!masterId || !bid || !todayRef.current) {
      setRecommendedSlots([])
      return
    }
    const fromStr = format(todayRef.current, 'yyyy-MM-dd')
    const params = new URLSearchParams({
      masterId,
      businessId: bid,
      from: fromStr,
      days: '14',
      limit: '8',
      durationMinutes: String(totalDuration),
    })
    fetch(`/api/availability?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : {}))
      .then((data) => {
        const list = data?.recommendedSlots
        setRecommendedSlots(Array.isArray(list) ? list : [])
      })
      .catch(() => setRecommendedSlots([]))
  }, [masterId, bid, totalDuration])

  const requestIdRef = useRef<string>('')

  useEffect(() => {
    if (!calendarReady || !state.selectedDate) return
    if (!state.selectedMaster || !masterId || !bid) return

    const date = state.selectedDate
    const dateStr = format(date, 'yyyy-MM-dd')
    const id = `${dateStr}|${masterId}|${bid}`
    requestIdRef.current = id
    setLoading(true)
    setLoadError(false)
    setScheduleNotConfigured(false)
    setReason(null)

    const params = new URLSearchParams({
      masterId,
      businessId: bid,
      date: dateStr,
      durationMinutes: String(totalDuration),
    })
    const url = `/api/availability?${params.toString()}`
    const controller = new AbortController()

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) return res.text().then((t) => { throw new Error(t || `HTTP ${res.status}`) })
        return res.json()
      })
      .then((data) => {
        if (requestIdRef.current !== id) return
        if (!data || typeof data !== 'object') {
          setLoadError(true)
          setSlots([])
          return
        }
        if (data.error) {
          setLoadError(true)
          setSlots([])
          return
        }
        const raw = Array.isArray(data.availableSlots) ? data.availableSlots : []
        setScheduleNotConfigured(Boolean(data.scheduleNotConfigured))
        setReason(typeof data.reason === 'string' ? data.reason : null)

        const now = new Date()
        const today = todayRef.current ? startOfDay(todayRef.current) : startOfDay(new Date())
        const selectedDayStart = startOfDay(new Date(date))
        const futureOnly =
          selectedDayStart.getTime() === today.getTime()
            ? raw.filter((slotStr: string) => {
                const d = new Date(slotStr)
                return !isNaN(d.getTime()) && d > now
              })
            : raw.filter((slotStr: string) => {
                const d = new Date(slotStr)
                return !isNaN(d.getTime())
              })

        setSlots(futureOnly)
        if (futureOnly.length > 0) {
          const first = futureOnly[0]
          const timeStr = String(first).slice(11, 16)
          const currentKey = `${dateStr}T${state.selectedTime || ''}`
          if (!state.selectedTime || !futureOnly.includes(currentKey)) setTime(timeStr)
        } else {
          setTime('')
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        if (requestIdRef.current !== id) return
        setLoadError(true)
        setSlots([])
        setScheduleNotConfigured(false)
        setReason(null)
        setTime('')
      })
      .finally(() => {
        if (requestIdRef.current === id) setLoading(false)
      })

    return () => controller.abort()
  }, [
    state.selectedDate,
    state.selectedMaster,
    masterId,
    bid,
    totalDuration,
    calendarReady,
  ])

  useEffect(() => {
    if (!calendarReady || !todayRef.current) return
    if (state.selectedDate) return
    setDate(startOfDay(todayRef.current))
  }, [calendarReady, state.selectedDate, setDate])

  const monthStart = currentMonth ? startOfMonth(currentMonth) : null
  const monthEnd = currentMonth ? endOfMonth(currentMonth) : null
  const calendarStart = monthStart ? startOfWeek(monthStart, { weekStartsOn: 1 }) : null
  const calendarEnd = monthEnd ? endOfWeek(monthEnd, { weekStartsOn: 1 }) : null
  const calendarDays =
    calendarStart && calendarEnd
      ? eachDayOfInterval({ start: calendarStart, end: calendarEnd })
      : []

  const isDayOff = (day: Date) => {
    if (workingWeekdays.length === 0) return false
    return !workingWeekdays.includes(day.getDay())
  }

  const handleRecommendedClick = (rec: RecommendedSlot) => {
    try {
      const dateObj = parse(rec.date, 'yyyy-MM-dd', new Date())
      setDate(startOfDay(dateObj))
      setTime(rec.time)
    } catch {
      // ignore
    }
  }

  const handleTimeSelect = (time: string) => {
    const key = state.selectedDate ? `${format(state.selectedDate, 'yyyy-MM-dd')}T${time}` : ''
    if (slots.includes(key)) setTime(time)
  }

  const showNoSlotsMessage =
    !loading &&
    state.selectedDate &&
    state.selectedMaster &&
    effectiveBusinessId &&
    (loadError || scheduleNotConfigured || slots.length === 0)

  const noSlotsText = loadError
    ? 'Не вдалося завантажити доступні години. Перевірте зʼєднання та спробуйте ще раз або оберіть іншу дату.'
    : reason === 'day_off'
      ? 'Вихідний у майстра. Оберіть інший день у календарі.'
      : reason === 'all_occupied'
        ? 'Усі години на цей день зайняті записами. Оберіть іншу дату в календарі або спробуйте рекомендовані слоти вище.'
        : 'Графік майстра на цей день не налаштовано або немає робочого часу. Увімкніть день і години в кабінеті (Графік роботи та спеціалісти). Оберіть іншу дату.'

  const formatRecommendedLabel = (rec: RecommendedSlot) => {
    try {
      const d = parse(rec.date, 'yyyy-MM-dd', new Date())
      const today = todayRef.current
      if (today && isSameDay(d, today)) return `Сьогодні ${rec.time}`
      const tomorrow = today ? new Date(today) : new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      if (today && isSameDay(d, tomorrow)) return `Завтра ${rec.time}`
      return `${format(d, 'd MMM', { locale: uk })} ${rec.time}`
    } catch {
      return `${rec.date} ${rec.time}`
    }
  }

  return (
    <div className="min-h-screen py-4 sm:py-6 px-3 md:px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 text-center text-white" style={{ letterSpacing: '-0.02em' }}>
          Оберіть час
        </h2>

        {/* Найближчі вільні слоти — рекомендації */}
        {recommendedSlots.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-white mb-2">Найближчі вільні:</h3>
            <div className="flex flex-wrap gap-2">
              {recommendedSlots.map((rec) => {
                const isSelected =
                  state.selectedDate &&
                  state.selectedTime === rec.time &&
                  format(state.selectedDate, 'yyyy-MM-dd') === rec.date
                return (
                  <button
                    key={rec.slot}
                    type="button"
                    onClick={() => handleRecommendedClick(rec)}
                    className={cn(
                      'min-h-[40px] px-3 py-2 rounded-lg text-xs font-medium transition-colors active:scale-[0.98]',
                      isSelected
                        ? 'bg-white text-black shadow-md ring-2 ring-white/50'
                        : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                    )}
                  >
                    {formatRecommendedLabel(rec)}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="mb-3 sm:mb-4">
          <h3 className="text-sm font-semibold text-white mb-2">Оберіть дату:</h3>
          {!calendarReady || !currentMonth || !monthStart || !monthEnd ? (
            <div className="rounded-xl p-4 sm:p-6 card-glass text-center text-gray-400 text-sm">
              Завантаження календаря...
            </div>
          ) : (
            <>
              <div className="rounded-xl p-2.5 sm:p-3 mb-2 card-glass">
                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentMonth(subMonths(currentMonth!, 1))}
                    className="touch-target min-h-[40px] min-w-[40px] px-2 py-2 border border-white/20 bg-white/10 text-white rounded-lg text-xs font-medium hover:bg-white/20 transition-colors flex items-center justify-center"
                    title="Попередній місяць"
                  >
                    ←
                  </button>
                  <h4 className="text-xs sm:text-sm font-semibold text-white truncate flex-1 text-center px-1">
                    {format(currentMonth!, 'MMMM yyyy', { locale: uk })}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      if (todayRef.current) {
                        setCurrentMonth(todayRef.current)
                        setDate(startOfDay(todayRef.current))
                      }
                    }}
                    className="touch-target min-h-[40px] px-2 sm:px-2.5 py-2 bg-white text-black rounded-lg text-xs font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors flex-shrink-0"
                    style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
                    title="Сьогодні"
                  >
                    Сьогодні
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentMonth(addMonths(currentMonth!, 1))}
                    className="touch-target min-h-[40px] min-w-[40px] px-2 py-2 border border-white/20 bg-white/10 text-white rounded-lg text-xs font-medium hover:bg-white/20 transition-colors flex items-center justify-center"
                    title="Наступний місяць"
                  >
                    →
                  </button>
                </div>
              </div>
              <div className="rounded-xl p-2 card-glass w-full max-w-[320px] sm:max-w-xs mx-auto">
                <div className="grid grid-cols-7 gap-0.5 mb-1.5">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((d) => (
                    <div key={d} className="text-center text-[10px] font-semibold text-gray-400">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                  {calendarDays.map((day) => {
                    const isInMonth = day >= monthStart! && day <= monthEnd!
                    const isPastDate =
                      todayRef.current && isPast(day) && !isSameDay(day, todayRef.current)
                    const dayOff = isInMonth && isDayOff(day)
                    const isDisabled = isPastDate || !isInMonth || dayOff
                    const isSelected =
                      state.selectedDate && isSameDay(day, state.selectedDate)
                    const isToday =
                      todayRef.current && isSameDay(day, todayRef.current)
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => {
                          if (!isDisabled) setDate(new Date(day.getTime()))
                        }}
                        disabled={isDisabled}
                        title={dayOff ? 'Вихідний у майстра' : undefined}
                        className={cn(
                          'aspect-square min-h-[36px] sm:min-h-[32px] w-full flex items-center justify-center rounded-md text-[10px] sm:text-[10px] font-medium transition-colors active:scale-95',
                          isSelected && 'bg-white text-black shadow-md ring-2 ring-white/50',
                          isToday && isInMonth && !isSelected && !dayOff && 'ring-1 ring-white/30 bg-white/20 text-white',
                          (isPastDate || !isInMonth) && 'text-white/20 cursor-not-allowed bg-white/5',
                          dayOff && 'text-white/30 cursor-not-allowed bg-white/5 line-through',
                          !isSelected && !isPastDate && isInMonth && !isToday && !dayOff && 'bg-white/10 border border-white/10 text-white hover:bg-white/20'
                        )}
                      >
                        {format(day, 'd')}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {state.selectedDate && (
          <div className="mb-3 sm:mb-4">
            {showNoSlotsMessage && (
              <div className="rounded-xl p-4 mb-4 card-glass border border-white/20 bg-white/5">
                <p className="text-sm font-medium text-gray-300">Місць немає на цей день.</p>
                <p className="text-xs text-gray-400 mt-1">{noSlotsText}</p>
              </div>
            )}
            {!loading && slots.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-white mb-2">
                  Оберіть час (за графіком майстра):
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5 sm:gap-2">
                  {slots.map((slotStr) => {
                    const time = String(slotStr).slice(11, 16)
                    const isSelected = state.selectedTime === time
                    return (
                      <button
                        key={slotStr}
                        type="button"
                        onClick={() => handleTimeSelect(time)}
                        className={cn(
                          'min-h-[44px] sm:min-h-0 px-2 sm:px-3 py-2.5 sm:py-2.5 rounded-lg transition-colors text-xs font-medium active:scale-[0.98] bg-white/10 border border-white/10 text-white hover:bg-white/20',
                          isSelected && 'bg-white text-black shadow-md ring-2 ring-white/50'
                        )}
                      >
                        {time}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            {loading && (
              <div className="rounded-xl p-4 mb-4 card-glass border border-white/10 text-center text-gray-400 text-sm">
                Завантаження слотів...
              </div>
            )}
            {state.selectedTime && (
              <div className="mt-3 p-3 rounded-xl card-glass">
                <p className="text-sm font-medium text-white">
                  Обрано: <span className="text-white">{state.selectedTime}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {state.selectedTime && state.selectedDate && (
          <div className="rounded-xl p-4 mb-4 card-glass">
            <p className="text-xs mb-1 text-gray-400">Обрано:</p>
            <p className="text-sm font-semibold text-white">
              {format(state.selectedDate, 'd MMMM yyyy', { locale: uk })}, {state.selectedTime}
            </p>
            <p className="text-xs mt-1 text-gray-400">Тривалість: {totalDuration} хв</p>
          </div>
        )}

        <div className="flex gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="touch-target flex-1 min-h-[48px] py-2.5 rounded-lg border border-white/20 bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors active:scale-[0.98]"
          >
            Назад
          </button>
          <button
            type="button"
            onClick={() => setStep(4)}
            disabled={!state.selectedDate || !state.selectedTime}
            className="touch-target flex-1 min-h-[48px] py-2.5 rounded-lg bg-white text-black text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
          >
            Далі
          </button>
        </div>
      </div>
    </div>
  )
}

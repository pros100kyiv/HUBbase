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
} from 'date-fns'
import { uk } from 'date-fns/locale'

interface TimeStepProps {
  businessId?: string
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

  // Ініціалізація календаря та авто-вибір сьогодні при вході на крок
  useEffect(() => {
    const today = startOfDay(new Date())
    todayRef.current = today
    setCurrentMonth(today)
    setCalendarReady(true)
  }, [])

  useEffect(() => {
    if (!calendarReady || !state.selectedDate) return
    if (!state.selectedMaster || !masterId || !effectiveBusinessId) return
    const bid =
      typeof effectiveBusinessId === 'string' ? effectiveBusinessId.trim() : ''
    if (!bid) return

    const date = state.selectedDate
    const dateStr = format(date, 'yyyy-MM-dd')
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

    fetch(url)
      .then((res) => {
        if (!res.ok) {
          setLoadError(true)
          setSlots([])
          setScheduleNotConfigured(false)
          return
        }
        return res.json()
      })
      .then((data) => {
        if (!data || typeof data !== 'object') {
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
          const currentKey = `${format(state.selectedDate!, 'yyyy-MM-dd')}T${state.selectedTime || ''}`
          if (!state.selectedTime || !futureOnly.includes(currentKey)) {
            setTime(timeStr)
          }
        } else {
          setTime('')
        }
      })
      .catch(() => {
        setLoadError(true)
        setSlots([])
        setScheduleNotConfigured(false)
        setReason(null)
        setTime('')
      })
      .finally(() => setLoading(false))
  }, [
    state.selectedDate,
    state.selectedMaster,
    masterId,
    effectiveBusinessId,
    totalDuration,
    calendarReady,
  ])

  // Якщо зайшли на крок без дати — вибираємо сьогодні
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

  const allTimeSlots: string[] = []
  for (let h = 8; h <= 21; h++) {
    allTimeSlots.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 21) allTimeSlots.push(`${String(h).padStart(2, '0')}:30`)
  }

  const isSlotAvailable = (time: string) => {
    if (!state.selectedDate) return false
    const key = `${format(state.selectedDate, 'yyyy-MM-dd')}T${time}`
    return slots.includes(key)
  }

  const handleTimeSelect = (time: string) => {
    if (isSlotAvailable(time)) setTime(time)
  }

  const showNoSlotsMessage =
    !loading &&
    state.selectedDate &&
    state.selectedMaster &&
    effectiveBusinessId &&
    (loadError || scheduleNotConfigured || slots.length === 0)

  const noSlotsText = loadError
    ? 'Не вдалося завантажити доступні години. Перевірте зʼєднання та спробуйте ще раз або оберіть іншу дату.'
    : reason === 'all_occupied'
      ? 'Усі години на цей день зайняті записами. Оберіть іншу дату в календарі вище.'
      : 'Графік майстра на цей день не налаштовано або немає робочого часу. Увімкніть день і години в кабінеті (Графік роботи та спеціалісти). Оберіть іншу дату.'

  return (
    <div className="min-h-screen py-4 sm:py-6 px-3 md:px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 text-center text-white" style={{ letterSpacing: '-0.02em' }}>
          Оберіть час
        </h2>

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
                    const isSelected =
                      state.selectedDate && isSameDay(day, state.selectedDate)
                    const isToday =
                      todayRef.current && isSameDay(day, todayRef.current)
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => {
                          if (!isPastDate && isInMonth) setDate(new Date(day.getTime()))
                        }}
                        disabled={isPastDate || !isInMonth}
                        className={cn(
                          'aspect-square min-h-[36px] sm:min-h-[32px] w-full flex items-center justify-center rounded-md text-[10px] sm:text-[10px] font-medium transition-colors active:scale-95',
                          isSelected && 'bg-white text-black shadow-md ring-2 ring-white/50',
                          isToday && isInMonth && !isSelected && 'ring-1 ring-white/30 bg-white/20 text-white',
                          (isPastDate || !isInMonth) && 'text-white/20 cursor-not-allowed bg-white/5',
                          !isSelected && !isPastDate && isInMonth && !isToday && 'bg-white/10 border border-white/10 text-white hover:bg-white/20'
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-white">Оберіть час:</h3>
                  <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-green-500 flex-shrink-0" />
                      Доступно
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-white/10 border border-white/20 flex-shrink-0" />
                      Зайнято
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5 sm:gap-2">
                  {allTimeSlots.map((time) => {
                    const available = isSlotAvailable(time)
                    const isSelected = state.selectedTime === time
                    return (
                      <button
                        key={time}
                        type="button"
                        onClick={() => handleTimeSelect(time)}
                        disabled={!available}
                        className={cn(
                          'min-h-[44px] sm:min-h-0 px-2 sm:px-3 py-2.5 sm:py-2.5 rounded-lg transition-colors text-xs font-medium active:scale-[0.98]',
                          isSelected && 'bg-white text-black shadow-md ring-2 ring-white/50',
                          available && !isSelected && 'bg-white/10 border border-white/10 text-white hover:bg-white/20',
                          !available && 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed opacity-60'
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

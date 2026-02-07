'use client'

import { useState, useEffect } from 'react'
import { useBooking } from '@/contexts/BookingContext'
import { cn } from '@/lib/utils'
import { format, addDays, isSameDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isPast, isToday, addMonths, subMonths } from 'date-fns'
import { uk } from 'date-fns/locale'

interface TimeStepProps {
  businessId?: string
}

export function TimeStep({ businessId }: TimeStepProps) {
  const { state, setDate, setTime, setStep } = useBooking()
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [scheduleNotConfigured, setScheduleNotConfigured] = useState(false)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [calendarReady, setCalendarReady] = useState(false)
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null)
  const [clientToday, setClientToday] = useState<Date | null>(null)

  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    setCurrentMonth(today)
    setClientToday(today)
    setCalendarReady(true)
  }, [])

  // Generate calendar days for current month (only when mounted)
  const monthStart = currentMonth ? startOfMonth(currentMonth) : null
  const monthEnd = currentMonth ? endOfMonth(currentMonth) : null
  const calendarStart = monthStart ? startOfWeek(monthStart, { weekStartsOn: 1 }) : null
  const calendarEnd = monthEnd ? endOfWeek(monthEnd, { weekStartsOn: 1 }) : null
  const calendarDays = calendarStart && calendarEnd ? eachDayOfInterval({ start: calendarStart, end: calendarEnd }) : []

  // Quick dates for horizontal scroll (client-only)
  const quickDates = clientToday ? Array.from({ length: 14 }, (_, i) => {
    const date = addDays(clientToday, i)
    date.setHours(0, 0, 0, 0)
    return date
  }) : []

  // Усі можливі слоти для відображення (від 8:00 до 21:00 — узгоджено з графіком)
  const generateTimeSlots = () => {
    const slots: string[] = []
    for (let hour = 8; hour <= 21; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`)
      if (hour < 21) slots.push(`${hour.toString().padStart(2, '0')}:30`)
    }
    return slots
  }

  const allTimeSlots = generateTimeSlots()

  const isSlotAvailable = (time: string) => {
    if (!state.selectedDate) return false
    // Format time slot key to match API format (YYYY-MM-DDTHH:mm)
    const dateStr = format(state.selectedDate, 'yyyy-MM-dd')
    const slotKey = `${dateStr}T${time}`
    return availableSlots.includes(slotKey)
  }

  const handleTimeSelect = (time: string) => {
    if (isSlotAvailable(time)) {
      setTime(time)
    }
  }

  const totalDurationFromServices = state.selectedServices.reduce((sum, s) => sum + s.duration, 0)
  const totalDuration = totalDurationFromServices > 0 ? totalDurationFromServices : 30

  useEffect(() => {
    if (state.selectedDate && state.selectedMaster && businessId) {
      setSlotsLoading(true)
      const dateStr = format(state.selectedDate, 'yyyy-MM-dd')
      const url = `/api/availability?masterId=${state.selectedMaster.id}&businessId=${businessId}&date=${dateStr}&durationMinutes=${totalDuration}`
      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch availability')
          return res.json()
        })
        .then(data => {
          const raw = data.availableSlots || []
          const now = new Date()
          const futureOnly = raw.filter((slotStr: string) => new Date(slotStr) > now)
          setAvailableSlots(futureOnly)
          setScheduleNotConfigured(Boolean(data.scheduleNotConfigured))
        })
        .catch(error => {
          console.error('Error fetching availability:', error)
          setAvailableSlots([])
          setScheduleNotConfigured(false)
        })
        .finally(() => setSlotsLoading(false))
    } else {
      setAvailableSlots([])
      setScheduleNotConfigured(false)
      setSlotsLoading(false)
    }
  }, [state.selectedDate, state.selectedMaster, businessId, totalDuration])

  return (
    <div className="min-h-screen py-4 sm:py-6 px-3 md:px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 text-center text-white" style={{ letterSpacing: '-0.02em' }}>
          Оберіть час
        </h2>

        <div className="mb-3 sm:mb-4">
          <h3 className="text-sm font-semibold text-white mb-2">Оберіть дату:</h3>
          {!calendarReady || !currentMonth || !monthStart || !monthEnd ? (
            <div className="rounded-xl p-4 sm:p-6 card-glass text-center text-gray-400 text-sm">Завантаження календаря...</div>
          ) : (
            <>
              <div className="rounded-xl p-2.5 sm:p-3 mb-2 card-glass">
                <div className="flex items-center justify-between gap-1">
                  <button type="button" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="touch-target min-h-[40px] min-w-[40px] px-2 py-2 border border-white/20 bg-white/10 text-white rounded-lg text-xs font-medium hover:bg-white/20 transition-colors flex items-center justify-center" title="Попередній місяць">←</button>
                  <h4 className="text-xs sm:text-sm font-semibold text-white truncate flex-1 text-center px-1">{format(currentMonth, 'MMMM yyyy', { locale: uk })}</h4>
                  <button type="button" onClick={() => { if (clientToday) { setCurrentMonth(clientToday); setDate(clientToday) } }} className="touch-target min-h-[40px] px-2 sm:px-2.5 py-2 bg-white text-black rounded-lg text-xs font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors flex-shrink-0" style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }} title="Сьогодні">Сьогодні</button>
                  <button type="button" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="touch-target min-h-[40px] min-w-[40px] px-2 py-2 border border-white/20 bg-white/10 text-white rounded-lg text-xs font-medium hover:bg-white/20 transition-colors flex items-center justify-center" title="Наступний місяць">→</button>
                </div>
              </div>
              <div className="rounded-xl p-2 card-glass w-full max-w-[320px] sm:max-w-xs mx-auto">
                <div className="grid grid-cols-7 gap-0.5 mb-1.5">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day) => (
                    <div key={day} className="text-center text-[10px] font-semibold text-gray-400">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                  {calendarDays.map((day) => {
                    const isDayInMonth = day >= monthStart! && day <= monthEnd!
                    const isPastDate = clientToday ? isPast(day) && !isSameDay(day, clientToday) : false
                    const isSelected = state.selectedDate && isSameDay(day, state.selectedDate)
                    const isTodayDate = clientToday ? isSameDay(day, clientToday) : false
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => { if (!isPastDate && isDayInMonth) setDate(new Date(day.getTime())) }}
                        disabled={isPastDate || !isDayInMonth}
                        className={cn(
                          'aspect-square min-h-[36px] sm:min-h-[32px] w-full flex items-center justify-center rounded-md text-[10px] sm:text-[10px] font-medium transition-colors active:scale-95',
                          isSelected && 'bg-white text-black shadow-md ring-2 ring-white/50',
                          isTodayDate && isDayInMonth && !isSelected && 'ring-1 ring-white/30 bg-white/20 text-white',
                          (isPastDate || !isDayInMonth) && 'text-white/20 cursor-not-allowed bg-white/5',
                          !isSelected && !isPastDate && isDayInMonth && !isTodayDate && 'bg-white/10 border border-white/10 text-white hover:bg-white/20'
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
            {scheduleNotConfigured && !slotsLoading && (
              <div className="rounded-xl p-4 mb-4 card-glass border border-amber-500/30 bg-amber-500/10">
                <p className="text-sm font-medium text-amber-200">Графік не налаштовано або на цей день немає робочого часу.</p>
                <p className="text-xs text-gray-400 mt-1">Оберіть іншу дату або зверніться до закладу для уточнення графіка.</p>
              </div>
            )}
            {!scheduleNotConfigured && !slotsLoading && availableSlots.length === 0 && state.selectedDate && state.selectedMaster && businessId && (
              <div className="rounded-xl p-4 mb-4 card-glass border border-white/20 bg-white/5">
                <p className="text-sm font-medium text-gray-300">На цей день немає вільних годин або не вдалося їх завантажити.</p>
                <p className="text-xs text-gray-400 mt-1">Спробуйте іншу дату або оновіть сторінку. Якщо графік майстра не налаштовано — налаштуйте його в кабінеті.</p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-white">Оберіть час:</h3>
              <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                {slotsLoading && <span className="text-gray-400">Завантаження слотів...</span>}
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-500 flex-shrink-0" />Доступно</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-white/10 border border-white/20 flex-shrink-0" />Зайнято</span>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5 sm:gap-2">
              {allTimeSlots.map((time) => {
                const available = !slotsLoading && isSlotAvailable(time)
                const isSelected = state.selectedTime === time
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => handleTimeSelect(time)}
                    disabled={slotsLoading || !isSlotAvailable(time)}
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
            {state.selectedTime && (
              <div className="mt-3 p-3 rounded-xl card-glass">
                <p className="text-sm font-medium text-white">Обрано: <span className="text-white">{state.selectedTime}</span></p>
              </div>
            )}
          </div>
        )}

        {state.selectedTime && state.selectedDate && (
          <div className="rounded-xl p-4 mb-4 card-glass">
            <p className="text-xs mb-1 text-gray-400">Обрано:</p>
            <p className="text-sm font-semibold text-white">{format(state.selectedDate, 'd MMMM yyyy', { locale: uk })}, {state.selectedTime}</p>
            <p className="text-xs mt-1 text-gray-400">Тривалість: {totalDuration} хв</p>
          </div>
        )}

        <div className="flex gap-2 sm:gap-3">
          <button type="button" onClick={() => setStep(2)} className="touch-target flex-1 min-h-[48px] py-2.5 rounded-lg border border-white/20 bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors active:scale-[0.98]">Назад</button>
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


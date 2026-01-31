'use client'

import { useState, useEffect } from 'react'
import { useBooking } from '@/contexts/BookingContext'
import { Button } from '@/components/ui/button'
import { format, addDays, isSameDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, getDay, isPast, isToday, addMonths, subMonths } from 'date-fns'
import { uk } from 'date-fns/locale'

interface TimeStepProps {
  businessId?: string
}

export function TimeStep({ businessId }: TimeStepProps) {
  const { state, setDate, setTime, setStep } = useBooking()
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Generate calendar days for current month
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday as first day
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Quick dates for horizontal scroll
  const quickDates = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(today, i)
    date.setHours(0, 0, 0, 0)
    return date
  })

  // Generate all time slots from 09:00 to 20:30 with 30-minute intervals
  const generateTimeSlots = () => {
    const slots: string[] = []
    for (let hour = 9; hour <= 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`)
      if (hour < 20) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`)
      }
    }
    return slots
  }

  const allTimeSlots = generateTimeSlots()

  useEffect(() => {
    if (state.selectedDate && state.selectedMaster && businessId) {
      // Format date as YYYY-MM-DD for API
      const dateStr = format(state.selectedDate, 'yyyy-MM-dd')
      fetch(
        `/api/availability?masterId=${state.selectedMaster.id}&businessId=${businessId}&date=${dateStr}`
      )
        .then(res => {
          if (!res.ok) {
            throw new Error('Failed to fetch availability')
          }
          return res.json()
        })
        .then(data => setAvailableSlots(data.availableSlots || []))
        .catch(error => {
          console.error('Error fetching availability:', error)
          setAvailableSlots([])
        })
    } else {
      setAvailableSlots([])
    }
  }, [state.selectedDate, state.selectedMaster, businessId])

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

  const totalDuration = state.selectedServices.reduce((sum, s) => sum + s.duration, 0)

  return (
    <div className="min-h-screen bg-gray-900 dark:bg-gray-950 py-6 px-3">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-black mb-4 text-center text-white">
          ОБЕРІТЬ ЧАС
        </h2>

        {/* Date Selection with Month Navigation */}
        <div className="mb-4">
          <h3 className="text-base font-black text-white mb-2">Оберіть дату:</h3>
          
          {/* Month Navigation */}
          <div className="bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-candy-sm p-2 mb-2">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="px-2 py-1 bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 text-white rounded-candy-xs text-xs font-bold hover:bg-white/20 dark:hover:bg-white/10 transition-all"
                title="Попередній місяць"
              >
                ←
              </button>
              <h4 className="text-xs font-black text-white">
                {format(currentMonth, 'MMMM yyyy', { locale: uk })}
              </h4>
              <button
                onClick={() => {
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  setCurrentMonth(today)
                  setDate(today)
                }}
                className="px-2 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded-candy-xs text-[10px] font-bold transition-all"
                title="Сьогодні"
              >
                Сьогодні
              </button>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="px-2 py-1 bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 text-white rounded-candy-xs text-xs font-bold hover:bg-white/20 dark:hover:bg-white/10 transition-all"
                title="Наступний місяць"
              >
                →
              </button>
            </div>
          </div>

          {/* Date Selection Grid */}
          <div className="bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-candy-sm p-2">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day) => (
                <div key={day} className="text-center text-[10px] font-bold text-white/60">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, idx) => {
                const isCurrentMonth = day >= monthStart && day <= monthEnd
                const isPastDate = isPast(day) && !isToday(day)
                const isSelected = state.selectedDate && isSameDay(day, state.selectedDate)
                const isTodayDate = isToday(day)

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => {
                      if (!isPastDate && isCurrentMonth) {
                        setDate(day)
                      }
                    }}
                    disabled={isPastDate || !isCurrentMonth}
                    className={`
                      aspect-square flex items-center justify-center rounded-candy-xs text-[10px] font-bold transition-all
                      ${isSelected
                        ? 'bg-purple-500 text-white shadow-lg scale-105 ring-2 ring-purple-300'
                        : isTodayDate && isCurrentMonth
                        ? 'bg-purple-500/30 text-white border border-purple-400'
                        : isPastDate || !isCurrentMonth
                        ? 'text-white/20 cursor-not-allowed bg-white/5'
                        : 'bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 text-white hover:bg-white/20 dark:hover:bg-white/10 hover:scale-105'
                      }
                    `}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {state.selectedDate && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Оберіть час:</h3>
              <div className="flex items-center gap-2 text-xs text-white/60">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-500"></div>
                  <span>Доступно</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-gray-600 border border-gray-500"></div>
                  <span>Зайнято</span>
                </div>
              </div>
            </div>

            {/* Time slots grid - more compact and intuitive */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {allTimeSlots.map((time) => {
                const available = isSlotAvailable(time)
                const isSelected = state.selectedTime === time
                
                return (
                  <button
                    key={time}
                    onClick={() => handleTimeSelect(time)}
                    disabled={!available}
                    className={`
                      px-3 py-2.5 rounded-candy-sm transition-all text-xs font-bold
                      ${isSelected
                        ? 'bg-purple-500 text-white shadow-lg scale-105 ring-2 ring-purple-300'
                        : available
                        ? 'bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 text-white hover:bg-white/20 dark:hover:bg-white/10 hover:scale-105'
                        : 'bg-gray-800/50 dark:bg-gray-900/50 border border-gray-700 dark:border-gray-800 text-gray-400 cursor-not-allowed opacity-50'
                      }
                    `}
                  >
                    {time}
                  </button>
                )
              })}
            </div>
            
            {/* Selected time highlight */}
            {state.selectedTime && (
              <div className="mt-4 p-3 bg-purple-500/20 border border-purple-400/30 rounded-candy-sm">
                <p className="text-sm text-white font-bold">
                  Обрано: <span className="text-white">{state.selectedTime}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {state.selectedTime && state.selectedDate && (
          <div className="bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-candy-sm p-3 mb-4">
            <p className="text-xs mb-1 text-white/70">Обрано:</p>
            <p className="text-sm font-bold text-white">
              {format(state.selectedDate, 'd MMMM yyyy', { locale: uk })}, {state.selectedTime}
            </p>
            <p className="text-xs mt-1 text-white/60">
              Тривалість: {totalDuration} хв
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep(2)} className="btn-secondary flex-1">
            Назад
          </Button>
          <Button
            onClick={() => setStep(4)}
            disabled={!state.selectedDate || !state.selectedTime}
            className="btn-primary flex-1"
          >
            Далі
          </Button>
        </div>
      </div>
    </div>
  )
}


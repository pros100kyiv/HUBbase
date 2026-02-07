'use client'

import { useEffect, useState } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameDay, eachDayOfInterval, isSameMonth } from 'date-fns'
import { uk } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { UserIcon, ClockIcon } from '@/components/icons'

interface WeeklyProcessCardProps {
  businessId?: string
}

interface Appointment {
  id: string
  startTime: string
  endTime: string
  status: string
  clientName: string
  clientPhone: string
  master?: {
    id: string
    name: string
  }
  services?: string
}

export function WeeklyProcessCard({ businessId }: WeeklyProcessCardProps) {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  useEffect(() => {
    if (!businessId) {
      // Try to get from localStorage
      const businessData = localStorage.getItem('business')
      if (businessData) {
        try {
          const parsed = JSON.parse(businessData)
          loadAppointments(parsed.id)
        } catch {
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
      return
    }
    loadAppointments(businessId)
  }, [businessId, currentMonth])

  const loadAppointments = async (id: string) => {
    try {
      setLoading(true)
      const start = startOfMonth(currentMonth)
      const end = endOfMonth(currentMonth)
      const startStr = format(start, 'yyyy-MM-dd')
      const endStr = format(end, 'yyyy-MM-dd')
      
      const response = await fetch(`/api/appointments?businessId=${id}&startDate=${startStr}&endDate=${endStr}`)
      if (response.ok) {
        const data = await response.json()
        setAppointments(data || [])
      }
    } catch (error) {
      console.error('Error loading appointments:', error)
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter((apt) => isSameDay(new Date(apt.startTime), day))
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Pending': case 'Очікує': return 'Очікує'
      case 'Confirmed': case 'Підтверджено': return 'Підтверджено'
      case 'Done': case 'Виконано': return 'Виконано'
      case 'Cancelled': case 'Скасовано': return 'Скасовано'
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
      case 'Очікує':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      case 'Confirmed':
      case 'Підтверджено':
        return 'bg-green-500/20 text-green-400 border-green-500/50'
      case 'Done':
      case 'Виконано':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'Cancelled':
      case 'Скасовано':
        return 'bg-red-500/20 text-red-400 border-red-500/50'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
    }
  }

  /** Колір бейджа кількості записів за домінантним статусом дня (як на сторінці Записи) */
  const getDayBadgeStyle = (dayAppointments: Appointment[]) => {
    if (dayAppointments.length === 0) return ''
    const hasPending = dayAppointments.some(a => a.status === 'Pending' || a.status === 'Очікує')
    const hasConfirmed = dayAppointments.some(a => a.status === 'Confirmed' || a.status === 'Підтверджено')
    const hasDone = dayAppointments.some(a => a.status === 'Done' || a.status === 'Виконано')
    if (hasPending) return 'bg-orange-500/90 text-white'
    if (hasConfirmed) return 'bg-green-500/90 text-white'
    if (hasDone) return 'bg-blue-500/90 text-white'
    return 'bg-white/25 text-white'
  }

  const handleDayClick = (day: Date) => {
    if (!isSameMonth(day, currentMonth)) return
    if (selectedDay && isSameDay(selectedDay, day)) {
      setSelectedDay(null)
    } else {
      setSelectedDay(day)
    }
  }

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const handleToday = () => {
    setCurrentMonth(new Date())
  }

  return (
    <div className="rounded-xl p-4 md:p-6 card-glass">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="text-base md:text-lg font-semibold text-white" style={{ letterSpacing: '-0.01em' }}>
          Календар записів
        </h3>
        <div className="flex items-center gap-1.5 md:gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={handleToday}
            className="px-2 py-1 text-xs font-medium text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            Сьогодні
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mb-2 md:mb-3">
        <h4 className="text-xs md:text-sm font-semibold text-white">
          {format(currentMonth, 'LLLL yyyy', { locale: uk })}
        </h4>
      </div>

      {/* Calendar Grid — той самий стиль, що на сторінці Записи */}
      <div className="grid grid-cols-7 gap-1.5 md:gap-2">
        {/* Day headers */}
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-gray-400 py-1.5">
            {day}
          </div>
        ))}
        {/* Calendar days */}
        {calendarDays.map((day) => {
          const dayAppointments = getAppointmentsForDay(day)
          const isToday = isSameDay(day, new Date())
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isSelected = selectedDay !== null && isSameDay(day, selectedDay)
          const appointmentCount = dayAppointments.length

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              className={cn(
                'relative p-1.5 md:p-2 rounded-lg border transition-all min-h-[40px] md:min-h-[40px] flex flex-col items-center justify-start active:scale-[0.98] touch-manipulation',
                !isCurrentMonth && 'opacity-30',
                isSelected
                  ? 'border-white bg-white/25 text-white shadow-lg shadow-black/20'
                  : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10 text-white',
                isToday && !isSelected && 'ring-1 ring-white/40 ring-offset-2 ring-offset-transparent',
                isCurrentMonth && 'cursor-pointer'
              )}
            >
              <span className={cn('text-xs md:text-sm font-semibold leading-tight', isToday && !isSelected && 'font-bold')}>
                {format(day, 'd')}
              </span>
              {appointmentCount > 0 && (
                <span className={cn('mt-0.5 text-[9px] md:text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[16px]', getDayBadgeStyle(dayAppointments))}>
                  {appointmentCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="mt-4 text-center">
          <div className="text-xs text-gray-400">Завантаження...</div>
        </div>
      )}

      {/* Розгорнутий блок вибраного дня — той самий стиль, що на сторінці Записи */}
      {selectedDay && (() => {
        const dayAppointments = getAppointmentsForDay(selectedDay)

        return (
          <div className="mt-4 pt-4 border-t border-white/10 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm md:text-base font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
                {format(selectedDay, 'd MMMM yyyy', { locale: uk })}
              </h4>
              <button
                onClick={() => setSelectedDay(null)}
                className="px-3 py-1.5 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-xs font-medium transition-colors"
              >
                Закрити
              </button>
            </div>
            {dayAppointments.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-300 text-sm font-medium mb-1">Немає записів на цей день</p>
                <p className="text-xs text-gray-400">Оберіть іншу дату або створіть запис на сторінці Записи</p>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/appointments')}
                  className="mt-3 px-3 py-2 bg-white/10 border border-white/20 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors"
                >
                  Відкрити Записи
                </button>
              </div>
            ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {dayAppointments.map((apt) => {
                const startTime = new Date(apt.startTime)
                const endTime = new Date(apt.endTime)
                const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / 60000)
                return (
                  <button
                    key={apt.id}
                    type="button"
                    onClick={() => router.push('/dashboard/appointments')}
                    className="w-full text-left bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/10 transition-all active:scale-[0.99] touch-manipulation min-h-[56px]"
                  >
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="flex flex-col items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-[#2A2A2A] rounded-lg border border-white/10 flex-shrink-0 shadow-inner">
                        <span className="text-xs md:text-sm font-bold text-blue-400 leading-none">
                          {format(startTime, 'HH:mm')}
                        </span>
                        <div className="w-0.5 h-0.5 rounded-full bg-gray-600 mt-0.5" />
                      </div>
                      <div className="flex-1 min-w-0 py-0.5">
                        <div className="text-sm font-bold text-white truncate leading-tight">
                          {apt.clientName}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-gray-500 truncate">
                          <UserIcon className="w-3 h-3 flex-shrink-0" />
                          <span>{apt.master?.name || 'Невідомий майстер'}</span>
                        </div>
                      </div>
                      <div className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-medium border flex-shrink-0',
                        getStatusColor(apt.status)
                      )}>
                        {getStatusLabel(apt.status)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                      <ClockIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="text-[10px] text-gray-400 font-medium">
                        {format(startTime, 'HH:mm')} – {format(endTime, 'HH:mm')}
                        <span className="text-gray-500 ml-1">({durationMin} хв)</span>
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}


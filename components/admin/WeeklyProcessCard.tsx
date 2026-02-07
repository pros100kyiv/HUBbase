'use client'

import { useEffect, useState } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameDay, eachDayOfInterval, isSameMonth } from 'date-fns'
import { uk } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

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

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {/* Day headers */}
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day) => (
          <div key={day} className="text-center text-[9px] font-semibold text-gray-400 py-0.5">
            {day}
          </div>
        ))}
        {/* Calendar days */}
        {calendarDays.map((day) => {
          const dayAppointments = getAppointmentsForDay(day)
          const isToday = isSameDay(day, new Date())
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const appointmentCount = dayAppointments.length

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              className={cn(
                'relative p-0.5 rounded-md border transition-all min-h-[24px] flex flex-col items-center justify-center',
                !isCurrentMonth && 'opacity-30',
                isToday
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10',
                isCurrentMonth && 'cursor-pointer active:scale-95'
              )}
            >
              <div className={cn(
                'text-[9px] font-semibold mb-0.5 leading-tight',
                isToday ? 'text-blue-400' : isCurrentMonth ? 'text-white' : 'text-gray-500'
              )}>
                {format(day, 'd')}
              </div>
              {appointmentCount > 0 && (
                <div className="w-full mt-auto">
                  <div className={cn(
                    'text-[7px] font-semibold text-center rounded-full py-0.5 leading-tight',
                    isToday 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white/20 text-white'
                  )}>
                    {appointmentCount}
                  </div>
                </div>
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

      {/* Список записів для вибраного дня */}
      {selectedDay && (() => {
        const dayAppointments = getAppointmentsForDay(selectedDay)
        if (dayAppointments.length === 0) return null

        return (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white">
                {format(selectedDay, 'd MMMM yyyy', { locale: uk })}
              </h4>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {dayAppointments.map((apt) => {
                const startTime = new Date(apt.startTime)
                const endTime = new Date(apt.endTime)
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

                return (
                  <div
                    key={apt.id}
                    className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-white mb-1">
                          {apt.clientName}
                        </div>
                        <div className="text-xs text-gray-400 mb-1">
                          {apt.master?.name || 'Невідомий майстер'}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-300">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
                        </div>
                      </div>
                      <div className={cn(
                        'px-2 py-1 rounded text-xs font-medium border',
                        getStatusColor(apt.status)
                      )}>
                        {apt.status}
                      </div>
                    </div>
                    {apt.services && (
                      <div className="text-xs text-gray-400 mt-2">
                        {(() => {
                          try {
                            const services = JSON.parse(apt.services)
                            return Array.isArray(services) 
                              ? services.map((s: any) => s.name || s).join(', ')
                              : apt.services
                          } catch {
                            return apt.services
                          }
                        })()}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}
    </div>
  )
}


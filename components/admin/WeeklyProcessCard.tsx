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
  status: string
}

export function WeeklyProcessCard({ businessId }: WeeklyProcessCardProps) {
  const router = useRouter()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

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

  const handleDayClick = (day: Date) => {
    if (isSameMonth(day, currentMonth)) {
      router.push(`/dashboard/appointments?date=${format(day, 'yyyy-MM-dd')}`)
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
    <div className="rounded-xl p-6 card-floating">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white" style={{ letterSpacing: '-0.01em' }}>
          Календар записів
        </h3>
        <div className="flex items-center gap-2">
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

      <div className="mb-3">
        <h4 className="text-sm font-semibold text-white">
          {format(currentMonth, 'LLLL yyyy', { locale: uk })}
        </h4>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day) => (
          <div key={day} className="text-center text-[10px] font-bold text-gray-400 py-1">
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
                'relative p-1.5 rounded-lg border transition-all min-h-[32px] flex flex-col items-center justify-center',
                !isCurrentMonth && 'opacity-30',
                isToday
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10',
                isCurrentMonth && 'cursor-pointer active:scale-95'
              )}
            >
              <div className={cn(
                'text-[11px] font-bold mb-0.5',
                isToday ? 'text-blue-400' : isCurrentMonth ? 'text-white' : 'text-gray-500'
              )}>
                {format(day, 'd')}
              </div>
              {appointmentCount > 0 && (
                <div className="w-full mt-auto">
                  <div className={cn(
                    'text-[9px] font-bold text-center rounded-full py-0.5',
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
    </div>
  )
}


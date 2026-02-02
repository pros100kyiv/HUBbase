'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, eachDayOfInterval, getDay } from 'date-fns'
import { uk } from 'date-fns/locale'
import { MobileAppointmentCard } from '@/components/admin/MobileAppointmentCard'
import { CreateAppointmentForm } from '@/components/admin/CreateAppointmentForm'
import { cn } from '@/lib/utils'

interface Appointment {
  id: string
  masterId: string
  masterName?: string
  master?: {
    id: string
    name: string
  }
  clientName: string
  clientPhone: string
  startTime: string
  endTime: string
  status: string
  services?: string
}

export default function AppointmentsPage() {
  const router = useRouter()
  const [business, setBusiness] = useState<any>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [masters, setMasters] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)

  useEffect(() => {
    const businessData = localStorage.getItem('business')
    if (!businessData) {
      router.push('/login')
      return
    }
    try {
      const parsed = JSON.parse(businessData)
      setBusiness(parsed)
    } catch {
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    if (!business) return

    // Load masters and services
    Promise.all([
      fetch(`/api/masters?businessId=${business.id}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch masters')
          return res.json()
        })
        .then((data) => setMasters(data || []))
        .catch((error) => {
          console.error('Error loading masters:', error)
          setMasters([])
        }),
      fetch(`/api/services?businessId=${business.id}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch services')
          return res.json()
        })
        .then((data) => setServices(data || []))
        .catch((error) => {
          console.error('Error loading services:', error)
          setServices([])
        }),
    ])
  }, [business])

  useEffect(() => {
    if (!business) return

    // Load appointments for current month
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    
    // Format dates properly for API
    const startStr = format(start, 'yyyy-MM-dd')
    const endStr = format(end, 'yyyy-MM-dd')
    
    fetch(`/api/appointments?businessId=${business.id}&startDate=${startStr}&endDate=${endStr}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch appointments: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        // Map appointments with master names
        const withMasters = (data || []).map((apt: Appointment) => {
          const master = masters.find((m) => m.id === apt.masterId)
          return { ...apt, masterName: master?.name || apt.master?.name || 'Невідомий майстер' }
        })
        setAppointments(withMasters)
      })
      .catch((error) => {
        console.error('Error loading appointments:', error)
        setAppointments([])
      })
  }, [business, currentMonth, masters])

  const handleAppointmentCreated = () => {
    setShowCreateForm(false)
    // Reload appointments
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const startStr = format(start, 'yyyy-MM-dd')
    const endStr = format(end, 'yyyy-MM-dd')
    
    fetch(`/api/appointments?businessId=${business.id}&startDate=${startStr}&endDate=${endStr}`)
      .then((res) => res.json())
      .then((data) => {
        const withMasters = (data || []).map((apt: Appointment) => {
          const master = masters.find((m) => m.id === apt.masterId)
          return { ...apt, masterName: master?.name || apt.master?.name || 'Невідомий майстер' }
        })
        setAppointments(withMasters)
      })
      .catch((error) => {
        console.error('Error reloading appointments:', error)
      })
  }

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (response.ok) {
        setAppointments((prev) =>
          prev.map((apt) => (apt.id === id ? { ...apt, status } : apt))
        )
      }
    } catch (error) {
      console.error('Error updating appointment:', error)
    }
  }

  const filteredAppointments = appointments.filter((apt) => {
    if (filterStatus !== 'all' && apt.status !== filterStatus) return false
    return true
  })

  // Get all days in current month
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday as first day
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Get appointments count for each day
  const getAppointmentsForDay = (day: Date) => {
    return filteredAppointments.filter((apt) => isSameDay(new Date(apt.startTime), day))
  }

  // Get appointments for selected date grouped by hour
  const getAppointmentsByHour = (date: Date) => {
    const dayAppointments = filteredAppointments.filter((apt) => 
      isSameDay(new Date(apt.startTime), date)
    )
    
    // Group by hour
    const byHour: Record<number, Appointment[]> = {}
    dayAppointments.forEach((apt) => {
      const hour = new Date(apt.startTime).getHours()
      if (!byHour[hour]) {
        byHour[hour] = []
      }
      byHour[hour].push(apt)
    })
    
    return byHour
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-gray-500">Завантаження...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 md:mb-2">
          <h1 className="text-xl md:text-lg font-black text-gray-900 dark:text-white">Записи</h1>
          <button
            onClick={() => {
              setShowCreateForm(true)
              if (!selectedDate) {
                setSelectedDate(new Date())
              }
            }}
            className="w-full sm:w-auto px-4 py-3 md:px-3 md:py-1.5 text-sm md:text-xs font-bold rounded-candy-sm bg-gradient-to-r from-candy-blue to-candy-purple text-white hover:shadow-soft-2xl transition-all active:scale-[0.98] whitespace-nowrap"
          >
            + Додати запис
          </button>
        </div>

        {/* Month Navigation */}
        <div className="card-candy p-4 md:p-3 mb-4 md:mb-3 overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 md:mb-3">
            <h2 className="text-lg md:text-base font-black text-gray-900 dark:text-white">
              {format(currentMonth, 'LLLL yyyy', { locale: uk })}
            </h2>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  const prev = new Date(currentMonth)
                  prev.setMonth(prev.getMonth() - 1)
                  setCurrentMonth(prev)
                  setSelectedDate(null)
                }}
                className="flex-1 sm:flex-none px-3 py-2 md:px-2 md:py-1 text-sm md:text-xs font-bold rounded-candy-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-[0.98]"
              >
                Попередній
              </button>
              <button
                onClick={() => {
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  setCurrentMonth(today)
                  setSelectedDate(today)
                }}
                className="flex-1 sm:flex-none px-3 py-2 md:px-2 md:py-1 text-sm md:text-xs font-bold rounded-candy-sm bg-gradient-to-r from-candy-blue to-candy-purple text-white hover:shadow-soft-2xl transition-all active:scale-[0.98]"
              >
                Сьогодні
              </button>
              <button
                onClick={() => {
                  const next = new Date(currentMonth)
                  next.setMonth(next.getMonth() + 1)
                  setCurrentMonth(next)
                  setSelectedDate(null)
                }}
                className="flex-1 sm:flex-none px-3 py-2 md:px-2 md:py-1 text-sm md:text-xs font-bold rounded-candy-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-[0.98]"
              >
                Наступний
              </button>
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex gap-1.5 mb-4 md:mb-3 flex-wrap overflow-x-auto pb-1">
            {['all', 'Pending', 'Confirmed', 'Done', 'Cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={cn(
                  'px-3 py-1.5 md:px-2 md:py-1 text-xs md:text-[10px] font-bold rounded-candy-xs transition-all active:scale-97 whitespace-nowrap flex-shrink-0',
                  filterStatus === status
                    ? 'bg-gradient-to-r from-candy-purple to-candy-blue text-white shadow-soft-lg'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                {status === 'all' ? 'Всі' : status === 'Pending' ? 'Очікує' : status === 'Confirmed' ? 'Підтверджено' : status === 'Done' ? 'Виконано' : 'Скасовано'}
              </button>
            ))}
          </div>

          {/* Month Calendar Grid */}
          <div className="w-full overflow-x-hidden">
            <div className="grid grid-cols-7 gap-1">
              {/* Day headers */}
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day) => (
                <div key={day} className="text-center text-xs md:text-[10px] font-bold text-gray-500 dark:text-gray-400 py-1">
                  {day}
                </div>
              ))}
              
              {/* Calendar days */}
              {calendarDays.map((day) => {
                const dayAppointments = getAppointmentsForDay(day)
                const isToday = isSameDay(day, new Date())
                const isSelected = selectedDate && isSameDay(day, selectedDate)
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth()

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => {
                      if (isCurrentMonth) {
                        setSelectedDate(day)
                      }
                    }}
                    className={cn(
                      'relative p-1.5 md:p-2 rounded-candy-xs border transition-all min-h-[50px] md:min-h-[60px] flex flex-col items-center justify-start',
                      !isCurrentMonth && 'opacity-30',
                      isSelected
                        ? 'border-candy-purple bg-candy-purple/10 dark:bg-candy-purple/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600',
                      isToday && !isSelected && 'ring-2 ring-candy-purple/50',
                      isCurrentMonth && 'cursor-pointer active:scale-95'
                    )}
                  >
                    <div className={cn(
                      'text-xs md:text-sm font-black mb-1',
                      isToday ? 'text-candy-purple' : 'text-gray-900 dark:text-white'
                    )}>
                      {format(day, 'd')}
                    </div>
                    {dayAppointments.length > 0 && (
                      <div className="w-full mt-auto">
                        <div className="text-[10px] font-black text-candy-purple text-center bg-candy-purple/10 dark:bg-candy-purple/20 rounded-full py-0.5">
                          {dayAppointments.length}
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Selected Date Details */}
        {selectedDate && (
          <div className="card-candy p-4 md:p-3 mb-4 md:mb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 md:mb-3">
              <h3 className="text-lg md:text-base font-black text-gray-900 dark:text-white">
                {format(selectedDate, 'd MMMM yyyy', { locale: uk })}
              </h3>
              <button
                onClick={() => setSelectedDate(null)}
                className="w-full sm:w-auto px-4 py-2 md:px-3 md:py-1.5 text-sm md:text-xs font-bold rounded-candy-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-[0.98]"
              >
                ✕ Закрити
              </button>
            </div>

              {/* Appointments by Hour */}
              {(() => {
                const byHour = getAppointmentsByHour(selectedDate)
                const hours = Object.keys(byHour).map(Number).sort((a, b) => a - b)

                if (hours.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Немає записів на цей день</p>
                    </div>
                  )
                }

                return (
                  <div className="space-y-4">
                    {hours.map((hour) => (
                      <div key={hour} className="border-l-4 border-candy-purple pl-4">
                        <div className="text-sm font-black text-candy-purple mb-2">
                          {String(hour).padStart(2, '0')}:00
                        </div>
                        <div className="space-y-2">
                          {byHour[hour]
                            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                            .map((appointment) => (
                              <MobileAppointmentCard
                                key={appointment.id}
                                appointment={appointment}
                                onStatusChange={handleStatusChange}
                              />
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}

        {!selectedDate && !showCreateForm && (
          <div className="card-candy p-6 md:p-4 text-center">
            <p className="text-sm md:text-xs text-gray-600 dark:text-gray-400 font-medium">
              Оберіть дату в календарі, щоб переглянути записи
            </p>
          </div>
        )}

        {/* Create Appointment Form */}
        {showCreateForm && (
          <div className="mb-4 md:mb-3">
            <CreateAppointmentForm
              businessId={business.id}
              masters={masters}
              services={services}
              selectedDate={selectedDate || undefined}
              onSuccess={handleAppointmentCreated}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}



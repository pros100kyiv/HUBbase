'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, eachDayOfInterval, getDay } from 'date-fns'
import { uk } from 'date-fns/locale'
import { MobileAppointmentCard } from '@/components/admin/MobileAppointmentCard'
import { CreateAppointmentForm } from '@/components/admin/CreateAppointmentForm'
import { EditAppointmentForm } from '@/components/admin/EditAppointmentForm'
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
  clientEmail?: string | null
  startTime: string
  endTime: string
  status: string
  services?: string
  customPrice?: number | null
  notes?: string | null
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
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)

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

    // Load appointments for current month and extended range to include recurring appointments
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    
    // Extend range to 3 months before and after to catch all recurring appointments
    const extendedStart = new Date(start)
    extendedStart.setMonth(extendedStart.getMonth() - 3)
    const extendedEnd = new Date(end)
    extendedEnd.setMonth(extendedEnd.getMonth() + 3)
    
    // Format dates properly for API
    const startStr = format(extendedStart, 'yyyy-MM-dd')
    const endStr = format(extendedEnd, 'yyyy-MM-dd')
    
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
    // Reload appointments with extended range
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    
    // Extend range to 3 months before and after to catch all recurring appointments
    const extendedStart = new Date(start)
    extendedStart.setMonth(extendedStart.getMonth() - 3)
    const extendedEnd = new Date(end)
    extendedEnd.setMonth(extendedEnd.getMonth() + 3)
    
    const startStr = format(extendedStart, 'yyyy-MM-dd')
    const endStr = format(extendedEnd, 'yyyy-MM-dd')
    
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

  const handlePriceChange = async (id: string, price: number | null) => {
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrice: price }),
      })

      if (response.ok) {
        const updated = await response.json()
        setAppointments((prev) =>
          prev.map((apt) => (apt.id === id ? { ...apt, customPrice: updated.customPrice } : apt))
        )
      }
    } catch (error) {
      console.error('Error updating price:', error)
      throw error
    }
  }

  const handleEdit = (appointment: Appointment) => {
    setEditingAppointment(appointment)
  }

  const handleEditSuccess = () => {
    setEditingAppointment(null)
    // Reload appointments with extended range
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    
    // Extend range to 3 months before and after to catch all recurring appointments
    const extendedStart = new Date(start)
    extendedStart.setMonth(extendedStart.getMonth() - 3)
    const extendedEnd = new Date(end)
    extendedEnd.setMonth(extendedEnd.getMonth() + 3)
    
    const startStr = format(extendedStart, 'yyyy-MM-dd')
    const endStr = format(extendedEnd, 'yyyy-MM-dd')
    
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
    <div className="min-h-screen bg-background">
      <div className="p-3">
        <div className="max-w-7xl mx-auto">
          <div className="spacing-item">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h1 className="text-heading">Записи</h1>
                <p className="text-caption font-medium">Управління записами</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateForm(true)
                  if (!selectedDate) {
                    setSelectedDate(new Date())
                  }
                }}
                className="btn-primary whitespace-nowrap"
              >
                + Додати запис
              </button>
            </div>
          </div>

          {/* Month Navigation */}
          <div className="card-candy p-3 spacing-section overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <h2 className="text-subheading text-center sm:text-left">
                {format(currentMonth, 'LLLL yyyy', { locale: uk })}
              </h2>
              <div className="flex gap-1.5 justify-center sm:justify-end flex-wrap">
                <button
                  onClick={() => {
                    const prev = new Date(currentMonth)
                    prev.setMonth(prev.getMonth() - 1)
                    setCurrentMonth(prev)
                    setSelectedDate(null)
                  }}
                  className="btn-secondary text-xs px-2 py-1.5 whitespace-nowrap"
                >
                  ← Попередній
                </button>
                <button
                  onClick={() => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    setCurrentMonth(today)
                    setSelectedDate(today)
                  }}
                  className="btn-primary text-xs px-2 py-1.5 whitespace-nowrap"
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
                  className="btn-secondary text-xs px-2 py-1.5 whitespace-nowrap"
                >
                  Наступний →
                </button>
              </div>
            </div>

            {/* Status Filters */}
            <div className="flex gap-1 mb-3 flex-wrap">
              {['all', 'Pending', 'Confirmed', 'Done', 'Cancelled'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    'px-2 py-1 text-[10px] font-bold rounded-candy-xs transition-all active:scale-97 whitespace-nowrap',
                    filterStatus === status
                      ? 'candy-purple text-white shadow-soft-lg'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  )}
                >
                  {status === 'all' ? 'Всі' : status === 'Pending' ? 'Очікує' : status === 'Confirmed' ? 'Підтверджено' : status === 'Done' ? 'Виконано' : 'Скасовано'}
                </button>
              ))}
            </div>

            {/* Month Calendar Grid */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {/* Day headers */}
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day) => (
                <div key={day} className="text-center text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 py-1">
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
                      'relative p-1 sm:p-2 rounded-candy-xs border transition-all min-h-[40px] sm:min-h-[60px] flex flex-col items-center justify-start',
                      !isCurrentMonth && 'opacity-30',
                      isSelected
                        ? 'border-candy-purple bg-candy-purple/10 dark:bg-candy-purple/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600',
                      isToday && !isSelected && 'ring-2 ring-candy-purple/50',
                      isCurrentMonth && 'cursor-pointer active:scale-95'
                    )}
                  >
                    <div className={cn(
                      'text-[10px] sm:text-sm font-black mb-0.5 sm:mb-1',
                      isToday ? 'text-candy-purple' : 'text-foreground'
                    )}>
                      {format(day, 'd')}
                    </div>
                    {dayAppointments.length > 0 && (
                      <div className="w-full mt-auto">
                        <div className="text-[8px] sm:text-[10px] font-black text-candy-purple text-center bg-candy-purple/10 dark:bg-candy-purple/20 rounded-full py-0.5 px-1">
                          {dayAppointments.length}
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected Date Details */}
          {selectedDate && (
            <div className="card-candy p-4 spacing-section">
              <div className="flex items-center justify-between spacing-item">
                <h3 className="text-subheading">
                  {format(selectedDate, 'd MMMM yyyy', { locale: uk })}
                </h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="btn-secondary"
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
                                onPriceChange={handlePriceChange}
                                onEdit={handleEdit}
                                servicesCache={services}
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
            <div className="card-candy p-6 text-center">
              <p className="text-caption font-medium">
                Оберіть дату в календарі, щоб переглянути записи
              </p>
            </div>
          )}

          {/* Create Appointment Form */}
          {showCreateForm && (
            <div className="mb-4">
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

          {/* Edit Appointment Form */}
          {editingAppointment && (
            <div className="mb-4">
              <EditAppointmentForm
                appointment={editingAppointment}
                businessId={business.id}
                masters={masters}
                services={services}
                onSuccess={handleEditSuccess}
                onCancel={() => setEditingAppointment(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}



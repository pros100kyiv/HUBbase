'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameDay, eachDayOfInterval } from 'date-fns'
import { uk } from 'date-fns/locale'
import { MobileAppointmentCard } from '@/components/admin/MobileAppointmentCard'
import { CreateAppointmentForm } from '@/components/admin/CreateAppointmentForm'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon, FilterIcon, DownloadIcon, CheckIcon } from '@/components/icons'
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
  const [filterMaster, setFilterMaster] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedAppointments, setSelectedAppointments] = useState<Set<string>>(new Set())
  const [masters, setMasters] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')

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

    Promise.all([
      fetch(`/api/masters?businessId=${business.id}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch masters')
          return res.json()
        })
        .then((data) => setMasters(data || []))
        .catch(() => setMasters([])),
      fetch(`/api/services?businessId=${business.id}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch services')
          return res.json()
        })
        .then((data) => setServices(data || []))
        .catch(() => setServices([])),
    ])
  }, [business])

  useEffect(() => {
    if (!business) return

    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const startStr = format(start, 'yyyy-MM-dd')
    const endStr = format(end, 'yyyy-MM-dd')
    
    fetch(`/api/appointments?businessId=${business.id}&startDate=${startStr}&endDate=${endStr}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch appointments: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        const withMasters = (data || []).map((apt: Appointment) => {
          const master = masters.find((m: any) => m.id === apt.masterId)
          return { ...apt, masterName: master?.name || apt.master?.name || 'Невідомий спеціаліст' }
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
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const startStr = format(start, 'yyyy-MM-dd')
    const endStr = format(end, 'yyyy-MM-dd')
    
    fetch(`/api/appointments?businessId=${business.id}&startDate=${startStr}&endDate=${endStr}`)
      .then((res) => res.json())
      .then((data) => {
        const withMasters = (data || []).map((apt: Appointment) => {
          const master = masters.find((m: any) => m.id === apt.masterId)
          return { ...apt, masterName: master?.name || apt.master?.name || 'Невідомий спеціаліст' }
        })
        setAppointments(withMasters)
      })
      .catch((error) => console.error('Error reloading appointments:', error))
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

  const handleBulkStatusChange = async (status: string) => {
    if (selectedAppointments.size === 0) return
    
    try {
      const promises = Array.from(selectedAppointments).map(id =>
        fetch(`/api/appointments/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
      )
      
      await Promise.all(promises)
      setAppointments((prev) =>
        prev.map((apt) => 
          selectedAppointments.has(apt.id) ? { ...apt, status } : apt
        )
      )
      setSelectedAppointments(new Set())
    } catch (error) {
      console.error('Error updating appointments:', error)
    }
  }

  const handleExportCSV = () => {
    const csvHeaders = ['Дата', 'Час', 'Клієнт', 'Телефон', 'Спеціаліст', 'Послуги', 'Статус', 'Примітки']
    const csvRows = filteredAppointments.map(apt => {
      const start = new Date(apt.startTime)
      const end = new Date(apt.endTime)
      let servicesList: string[] = []
      try {
        if (apt.services) {
          servicesList = JSON.parse(apt.services)
        }
      } catch (e) {
        // Ignore
      }
      return [
        format(start, 'dd.MM.yyyy'),
        `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`,
        apt.clientName,
        apt.clientPhone,
        apt.masterName || 'Невідомий',
        servicesList.join(', '),
        apt.status,
        (apt as any).notes || ''
      ]
    })
    
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `записи_${format(currentMonth, 'MM_yyyy', { locale: uk })}.csv`
    link.click()
  }

  const toggleSelectAppointment = (id: string) => {
    setSelectedAppointments(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedAppointments.size === filteredAppointments.length) {
      setSelectedAppointments(new Set())
    } else {
      setSelectedAppointments(new Set(filteredAppointments.map(apt => apt.id)))
    }
  }

  const filteredAppointments = appointments.filter((apt) => {
    if (filterStatus !== 'all' && apt.status !== filterStatus) return false
    if (filterMaster !== 'all' && apt.masterId !== filterMaster) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesName = apt.clientName.toLowerCase().includes(query)
      const matchesPhone = apt.clientPhone.includes(query)
      let matchesService = false
      try {
        if (apt.services) {
          const servicesList = JSON.parse(apt.services)
          matchesService = servicesList.some((s: string) => s.toLowerCase().includes(query))
        }
      } catch (e) {
        // Ignore
      }
      if (!matchesName && !matchesPhone && !matchesService) return false
    }
    return true
  })

  // Calculate statistics
  const stats = {
    total: filteredAppointments.length,
    pending: filteredAppointments.filter(a => a.status === 'Pending').length,
    confirmed: filteredAppointments.filter(a => a.status === 'Confirmed').length,
    done: filteredAppointments.filter(a => a.status === 'Done').length,
    cancelled: filteredAppointments.filter(a => a.status === 'Cancelled').length,
    revenue: filteredAppointments
      .filter(a => a.status === 'Done')
      .reduce((sum, apt) => {
        try {
          if (apt.services) {
            const servicesList = JSON.parse(apt.services)
            const total = servicesList.reduce((acc: number, serviceName: string) => {
              const service = services.find(s => s.name === serviceName)
              return acc + (service?.price || 0)
            }, 0)
            return sum + total
          }
        } catch (e) {
          // Ignore
        }
        return sum
      }, 0)
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const getAppointmentsForDay = (day: Date) => {
    return filteredAppointments.filter((apt) => isSameDay(new Date(apt.startTime), day))
  }

  const getAppointmentsByHour = (date: Date) => {
    const dayAppointments = filteredAppointments.filter((apt) => 
      isSameDay(new Date(apt.startTime), date)
    )
    
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
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
          <div>
            <h1 className="text-lg md:text-xl font-black text-gray-900 dark:text-white mb-1">
              Записи та Візити
            </h1>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
              Управління записами та розкладом
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 rounded-candy-xs text-xs font-bold"
            >
              {viewMode === 'calendar' ? '📋 Список' : '📅 Календар'}
            </button>
            <button
              onClick={handleExportCSV}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 rounded-candy-xs text-xs font-bold flex items-center gap-1"
            >
              <DownloadIcon className="w-3 h-3" />
              Експорт
            </button>
            <button
              onClick={() => {
                setShowCreateForm(true)
                if (!selectedDate) {
                  setSelectedDate(new Date())
                }
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-candy-purple to-candy-blue text-white font-bold rounded-candy-xs text-xs shadow-soft-lg hover:shadow-soft-xl transition-all active:scale-95 whitespace-nowrap"
            >
              + Додати запис
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="card-candy p-2 mb-2">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search */}
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Пошук по клієнту, телефону, послузі..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-candy-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-candy-purple"
              />
            </div>
            
            {/* Master Filter */}
            <select
              value={filterMaster}
              onChange={(e) => setFilterMaster(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-candy-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-candy-purple"
            >
              <option value="all">Всі спеціалісти</option>
              {masters.map((master) => (
                <option key={master.id} value={master.id}>{master.name}</option>
              ))}
            </select>
          </div>

          {/* Bulk Actions */}
          {selectedAppointments.size > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Вибрано: {selectedAppointments.size}
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleBulkStatusChange('Confirmed')}
                  className="px-2 py-1 text-[10px] bg-candy-mint text-white rounded-candy-xs font-bold hover:opacity-80 transition-all"
                >
                  Підтвердити
                </button>
                <button
                  onClick={() => handleBulkStatusChange('Done')}
                  className="px-2 py-1 text-[10px] bg-candy-blue text-white rounded-candy-xs font-bold hover:opacity-80 transition-all"
                >
                  Виконано
                </button>
                <button
                  onClick={() => handleBulkStatusChange('Cancelled')}
                  className="px-2 py-1 text-[10px] bg-red-500 text-white rounded-candy-xs font-bold hover:opacity-80 transition-all"
                >
                  Скасувати
                </button>
                <button
                  onClick={() => setSelectedAppointments(new Set())}
                  className="px-2 py-1 text-[10px] border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white rounded-candy-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                  Скасувати вибір
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
          <div className="card-candy p-2 text-center">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Всього</div>
            <div className="text-sm font-black text-gray-900 dark:text-white">{stats.total}</div>
          </div>
          <div className="card-candy p-2 text-center">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Очікує</div>
            <div className="text-sm font-black text-candy-orange">{stats.pending}</div>
          </div>
          <div className="card-candy p-2 text-center">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Підтверджено</div>
            <div className="text-sm font-black text-candy-mint">{stats.confirmed}</div>
          </div>
          <div className="card-candy p-2 text-center">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Виконано</div>
            <div className="text-sm font-black text-candy-blue">{stats.done}</div>
          </div>
          <div className="card-candy p-2 text-center">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Дохід</div>
            <div className="text-sm font-black text-candy-purple">{stats.revenue} грн</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-3">
          {/* Month Navigation */}
          <div className="card-candy p-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
              <h2 className="text-base font-black text-gray-900 dark:text-white">
                {format(currentMonth, 'LLLL yyyy', { locale: uk })}
              </h2>
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    const prev = new Date(currentMonth)
                    prev.setMonth(prev.getMonth() - 1)
                    setCurrentMonth(prev)
                    setSelectedDate(null)
                  }}
                  className="p-1 rounded-candy-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    setCurrentMonth(today)
                    setSelectedDate(today)
                  }}
                  className="px-2.5 py-1 bg-gradient-to-r from-candy-blue to-candy-purple text-white font-bold rounded-candy-xs text-xs shadow-soft-lg hover:shadow-soft-xl transition-all active:scale-95"
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
                  className="p-1 rounded-candy-xs border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Status Filters */}
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {['all', 'Pending', 'Confirmed', 'Done', 'Cancelled'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    'px-2.5 py-1 rounded-candy-xs text-xs font-bold transition-all active:scale-95 whitespace-nowrap',
                    filterStatus === status
                      ? 'bg-gradient-to-r from-candy-purple to-candy-blue text-white shadow-soft-lg'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                  )}
                >
                  {status === 'all' ? 'Всі' : status === 'Pending' ? 'Очікує' : status === 'Confirmed' ? 'Підтверджено' : status === 'Done' ? 'Виконано' : 'Скасовано'}
                </button>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day) => (
                <div key={day} className="text-center text-xs font-bold text-gray-500 dark:text-gray-400 py-1">
                  {day}
                </div>
              ))}
              
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
                      'relative p-1 rounded-candy-xs border transition-all min-h-[40px] flex flex-col items-center justify-start',
                      !isCurrentMonth && 'opacity-30',
                      isSelected
                        ? 'border-candy-purple bg-gradient-to-br from-candy-purple/20 to-candy-blue/20 shadow-soft-lg'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600',
                      isToday && !isSelected && 'ring-1 ring-candy-purple/50',
                      isCurrentMonth && 'cursor-pointer active:scale-95'
                    )}
                  >
                    <div className={cn(
                      'text-xs font-black mb-0.5',
                      isToday ? 'text-candy-purple' : 'text-gray-900 dark:text-white'
                    )}>
                      {format(day, 'd')}
                    </div>
                    {dayAppointments.length > 0 && (
                      <div className="w-full mt-auto">
                        <div className="text-[10px] font-black text-candy-purple text-center bg-gradient-to-r from-candy-purple/20 to-candy-blue/20 rounded-full py-0.5">
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
            <div className="card-candy p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  {format(selectedDate, 'd MMMM yyyy', { locale: uk })}
                </h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="px-2.5 py-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 rounded-candy-xs text-xs font-bold"
                >
                  ✕ Закрити
                </button>
              </div>

              {(() => {
                const byHour = getAppointmentsByHour(selectedDate)
                const hours = Object.keys(byHour).map(Number).sort((a, b) => a - b)

                if (hours.length === 0) {
                  return (
                    <div className="text-center py-6">
                      <div className="mb-2 flex justify-center">
                        <CalendarIcon className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">
                        Немає записів на цей день
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Створіть новий запис, щоб почати
                      </p>
                    </div>
                  )
                }

                return (
                  <div className="space-y-2">
                    {hours.map((hour) => (
                      <div key={hour} className="border-l-2 border-candy-purple pl-2">
                        <div className="text-sm font-black text-candy-purple mb-1.5">
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
            <div className="card-candy p-12 text-center">
              <div className="mb-6 flex justify-center">
                <div className="w-32 h-32 bg-gradient-to-br from-candy-purple/20 to-candy-blue/20 rounded-full flex items-center justify-center">
                  <CalendarIcon className="w-16 h-16 text-candy-purple" />
                </div>
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">
                Оберіть дату в календарі
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Щоб переглянути записи на конкретну дату
              </p>
              <button
                onClick={() => {
                  setShowCreateForm(true)
                  setSelectedDate(new Date())
                }}
                className="px-6 py-3 bg-gradient-to-r from-candy-purple to-candy-blue text-white font-bold rounded-candy-sm shadow-soft-xl hover:shadow-soft-2xl transition-all active:scale-95"
              >
                Створити новий запис
              </button>
            </div>
          )}

          {/* Create Appointment Form */}
          {showCreateForm && (
            <div className="card-candy p-3">
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

        {/* Right Sidebar */}
        <div className="space-y-3">
          {/* Quick Stats */}
          <div className="card-candy p-3 bg-gradient-to-br from-candy-purple/10 to-candy-blue/10">
            <h3 className="text-sm font-black text-gray-900 dark:text-white mb-2">
              Статистика місяця
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-candy-xs">
                <span className="text-xs text-gray-600 dark:text-gray-400">Всього записів</span>
                <span className="text-sm font-black text-candy-purple">{appointments.length}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-candy-xs">
                <span className="text-xs text-gray-600 dark:text-gray-400">Підтверджено</span>
                <span className="text-sm font-black text-candy-mint">
                  {appointments.filter(a => a.status === 'Confirmed').length}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-candy-xs">
                <span className="text-xs text-gray-600 dark:text-gray-400">Виконано</span>
                <span className="text-sm font-black text-candy-blue">
                  {appointments.filter(a => a.status === 'Done').length}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card-candy p-3">
            <h3 className="text-sm font-black text-gray-900 dark:text-white mb-2">
              Швидкі дії
            </h3>
            <div className="space-y-1.5">
              <button
                onClick={() => {
                  setShowCreateForm(true)
                  setSelectedDate(new Date())
                }}
                className="w-full px-2.5 py-1.5 bg-gradient-to-r from-candy-purple to-candy-blue text-white font-bold rounded-candy-xs text-xs shadow-soft-lg hover:shadow-soft-xl transition-all active:scale-95 text-left"
              >
                + Створити запис на сьогодні
              </button>
              <button
                onClick={() => router.push('/dashboard/clients')}
                className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 rounded-candy-xs text-xs font-bold text-left"
              >
                Переглянути клієнтів
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

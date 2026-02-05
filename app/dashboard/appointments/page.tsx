'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameDay, eachDayOfInterval } from 'date-fns'
import { uk } from 'date-fns/locale'
import { MobileAppointmentCard } from '@/components/admin/MobileAppointmentCard'
import { CreateAppointmentForm } from '@/components/admin/CreateAppointmentForm'
import { EditAppointmentForm } from '@/components/admin/EditAppointmentForm'
import { QuickClientCard } from '@/components/admin/QuickClientCard'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon, FilterIcon, DownloadIcon, CheckIcon, UserIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/toast'

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
  const [calendarReady, setCalendarReady] = useState(false)
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  // Initialize calendar dates only on client to avoid hydration mismatch
  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    setCurrentMonth(today)
    setCalendarReady(true)
  }, [])
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterMaster, setFilterMaster] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedAppointments, setSelectedAppointments] = useState<Set<string>>(new Set())
  const [masters, setMasters] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [showQuickClientCard, setShowQuickClientCard] = useState(false)
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

  // Check for create parameter in URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('create') === 'true') {
        setShowCreateForm(true)
        // Remove parameter from URL
        router.replace('/dashboard/appointments', { scroll: false })
      }
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
    if (!business || !currentMonth) return

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
    reloadAppointments()
  }

  const handleAppointmentUpdated = () => {
    setShowEditForm(false)
    setEditingAppointment(null)
    reloadAppointments()
  }

  const reloadAppointments = async () => {
    if (!business || !currentMonth) return
    
    try {
      // Спочатку завантажуємо masters, якщо їх немає
      let currentMasters = masters
      if (currentMasters.length === 0) {
        const mastersRes = await fetch(`/api/masters?businessId=${business.id}`)
        if (mastersRes.ok) {
          currentMasters = await mastersRes.json()
          setMasters(currentMasters)
        }
      }
      
      const start = startOfMonth(currentMonth)
      const end = endOfMonth(currentMonth)
      const startStr = format(start, 'yyyy-MM-dd')
      const endStr = format(end, 'yyyy-MM-dd')
      
      const res = await fetch(`/api/appointments?businessId=${business.id}&startDate=${startStr}&endDate=${endStr}`)
      if (!res.ok) throw new Error(`Failed to fetch appointments: ${res.status}`)
      
      const data = await res.json()
      const withMasters = (data || []).map((apt: Appointment) => {
        const master = currentMasters.find((m: any) => m.id === apt.masterId)
        return { ...apt, masterName: master?.name || apt.master?.name || 'Невідомий спеціаліст' }
      })
      setAppointments(withMasters)
    } catch (error) {
      console.error('Error reloading appointments:', error)
      toast({
        title: 'Помилка',
        description: 'Не вдалося завантажити записи',
        type: 'error',
      })
    }
  }

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment)
    setShowEditForm(true)
  }

  const handleStatusChange = async (id: string, status: string) => {
    if (!business) return
    
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, businessId: business.id }),
      })

      if (response.ok) {
        setAppointments((prev) =>
          prev.map((apt) => (apt.id === id ? { ...apt, status } : apt))
        )
        toast({ title: 'Статус оновлено', type: 'success' })
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update status')
      }
    } catch (error) {
      console.error('Error updating appointment:', error)
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося оновити статус',
        type: 'error',
      })
    }
  }

  const handleBulkStatusChange = async (status: string) => {
    if (selectedAppointments.size === 0 || !business) return
    
    try {
      const promises = Array.from(selectedAppointments).map(id =>
        fetch(`/api/appointments/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, businessId: business.id }),
        })
      )
      
      const results = await Promise.allSettled(promises)
      const failed = results.filter(r => r.status === 'rejected')
      
      if (failed.length > 0) {
        toast({
          title: 'Помилка',
          description: `Не вдалося оновити ${failed.length} записів`,
          type: 'error',
        })
      } else {
        setAppointments((prev) =>
          prev.map((apt) => 
            selectedAppointments.has(apt.id) ? { ...apt, status } : apt
          )
        )
        setSelectedAppointments(new Set())
        toast({ title: 'Статуси оновлено', type: 'success' })
      }
    } catch (error) {
      console.error('Error updating appointments:', error)
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося оновити записи',
        type: 'error',
      })
    }
  }

  const handleExportCSV = () => {
    const monthForFilename = currentMonth ?? new Date()
    const csvHeaders = ['Дата', 'Час', 'Клієнт', 'Телефон', 'Спеціаліст', 'Послуги', 'Статус', 'Примітки']
    const csvRows = filteredAppointments.map(apt => {
      const start = new Date(apt.startTime)
      const end = new Date(apt.endTime)
      let servicesList: string[] = []
      try {
        if (apt.services) {
          const serviceIds = JSON.parse(apt.services)
          // Конвертуємо ID в назви послуг
          servicesList = serviceIds.map((serviceId: string) => {
            const service = services.find(s => s.id === serviceId)
            return service?.name || serviceId
          })
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
    link.download = `записи_${format(monthForFilename, 'MM_yyyy', { locale: uk })}.csv`
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
          // servicesList містить ID послуг, перевіряємо по назвах
          matchesService = servicesList.some((serviceId: string) => {
            const service = services.find(s => s.id === serviceId)
            return service?.name.toLowerCase().includes(query) || false
          })
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
            const total = servicesList.reduce((acc: number, serviceId: string) => {
              const service = services.find(s => s.id === serviceId)
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

  const monthStart = currentMonth ? startOfMonth(currentMonth) : null
  const monthEnd = currentMonth ? endOfMonth(currentMonth) : null
  const calendarStart = monthStart ? startOfWeek(monthStart, { weekStartsOn: 1 }) : null
  const calendarEnd = monthEnd ? endOfWeek(monthEnd, { weekStartsOn: 1 }) : null
  const calendarDays = calendarStart && calendarEnd ? eachDayOfInterval({ start: calendarStart, end: calendarEnd }) : []

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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-6">
        {/* Left Column - Main Content (3 columns) - same as Dashboard */}
        <div className="lg:col-span-3 space-y-3 md:space-y-6">
          {/* Header - same style as Dashboard */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
              Записи
            </h1>
            <button
              onClick={() => {
                setShowCreateForm(true)
                if (!selectedDate) setSelectedDate(new Date())
              }}
              className="px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors active:scale-[0.98] flex-shrink-0"
              style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
            >
              Записати
            </button>
          </div>

          {/* Search and Filters - stacked on mobile, row on desktop */}
          <div className="rounded-xl p-3 sm:p-4 md:p-6 card-floating">
            <div className="flex flex-col gap-2 md:gap-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div className="flex-1 relative min-w-0">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Пошук..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 sm:py-2 text-sm border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 min-h-[44px] sm:min-h-0"
                  />
                </div>
                <select
                  value={filterMaster}
                  onChange={(e) => setFilterMaster(e.target.value)}
                  className="px-3 py-2.5 sm:py-2 text-sm border border-white/20 rounded-lg bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30 min-h-[44px] sm:min-h-0"
                >
                  <option value="all">Всі спеціалісти</option>
                  {masters.map((master) => (
                    <option key={master.id} value={master.id}>{master.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 flex-shrink-0">
                <button
                  onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
                  className="touch-target min-h-[44px] px-3 py-2.5 sm:py-2 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-colors active:scale-[0.98]"
                >
                  {viewMode === 'calendar' ? 'Список' : 'Календар'}
                </button>
                <button
                  onClick={handleExportCSV}
                  className="touch-target min-h-[44px] px-3 py-2.5 sm:py-2 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 active:scale-[0.98]"
                >
                  <DownloadIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">Експорт</span>
                </button>
                <button
                  onClick={() => setShowQuickClientCard(true)}
                  className="touch-target min-h-[44px] px-3 py-2.5 sm:py-2 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 active:scale-[0.98]"
                >
                  <UserIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">Клієнт</span>
                </button>
              </div>
            </div>
            {selectedAppointments.size > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-300">Вибрано: {selectedAppointments.size}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleBulkStatusChange('Confirmed')} className="px-2.5 py-1.5 text-xs bg-green-500/90 text-white rounded-lg font-medium hover:opacity-90 transition-all">Підтвердити</button>
                  <button onClick={() => handleBulkStatusChange('Done')} className="px-2.5 py-1.5 text-xs bg-blue-500/90 text-white rounded-lg font-medium hover:opacity-90 transition-all">Виконано</button>
                  <button onClick={() => handleBulkStatusChange('Cancelled')} className="px-2.5 py-1.5 text-xs bg-red-500/90 text-white rounded-lg font-medium hover:opacity-90 transition-all">Скасувати</button>
                  <button onClick={() => setSelectedAppointments(new Set())} className="px-2.5 py-1.5 text-xs border border-white/20 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-all">Скасувати вибір</button>
                </div>
              </div>
            )}
          </div>
          {/* Month Navigation & Calendar */}
          <div className="rounded-xl p-4 md:p-6 card-floating">
            {!calendarReady || !currentMonth ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <span className="text-sm">Завантаження календаря...</span>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                  <h2 className="text-lg md:text-xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
                    {format(currentMonth, 'LLLL yyyy', { locale: uk })}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const prev = new Date(currentMonth)
                        prev.setMonth(prev.getMonth() - 1)
                        setCurrentMonth(prev)
                        setSelectedDate(null)
                      }}
                      className="p-2 rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
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
                      className="px-3 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors active:scale-[0.98]"
                      style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
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
                      className="p-2 rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
                    >
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4 flex-wrap">
                  {['all', 'Pending', 'Confirmed', 'Done', 'Cancelled'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={cn(
                        'touch-target min-h-[40px] px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap active:scale-[0.98]',
                        filterStatus === status
                          ? 'bg-white text-black'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white border border-white/10'
                      )}
                      style={filterStatus === status ? { boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' } : {}}
                    >
                      {status === 'all' ? 'Всі' : status === 'Pending' ? 'Очікує' : status === 'Confirmed' ? 'Підтверджено' : status === 'Done' ? 'Виконано' : 'Скасовано'}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1 sm:gap-1.5 max-w-md mx-auto w-full">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day) => (
                    <div key={day} className="text-center text-xs font-semibold text-gray-400 py-1">
                      {day}
                    </div>
                  ))}
                  {calendarDays.map((day) => {
                    const dayAppointments = getAppointmentsForDay(day)
                    const isToday = isSameDay(day, new Date())
                    const isSelected = selectedDate && isSameDay(day, selectedDate)
                    const isDayInCurrentMonth = currentMonth !== null && day.getMonth() === currentMonth.getMonth()

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => {
                          if (isDayInCurrentMonth) {
                            setSelectedDate(new Date(day.getTime()))
                          }
                        }}
                        className={cn(
                          'relative p-1 sm:p-1.5 rounded-md border transition-colors min-h-[40px] sm:min-h-[36px] flex flex-col items-center justify-start active:scale-[0.98]',
                          !isDayInCurrentMonth && 'opacity-30',
                          isSelected
                            ? 'border-white bg-white/20 text-white shadow-md'
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 text-white',
                          isToday && !isSelected && 'ring-1 ring-white/30',
                          isDayInCurrentMonth && 'cursor-pointer active:scale-[0.98]'
                        )}
                      >
                        <div className={cn('text-xs font-semibold mb-0.5', isToday ? 'text-white' : 'text-white')}>
                          {format(day, 'd')}
                        </div>
                        {dayAppointments.length > 0 && (
                          <div className="w-full mt-auto">
                            <div className="text-[10px] font-semibold text-white text-center bg-white/20 rounded-full py-0.5 leading-tight">
                              {dayAppointments.length}
                            </div>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Selected Date Details — базовий стиль */}
          {selectedDate && (
            <div className="rounded-xl p-4 md:p-6 bg-[#1A1A1A] border border-white/10 text-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
                  {format(selectedDate, 'd MMMM yyyy', { locale: uk })}
                </h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="px-3 py-2 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                >
                  Закрити
                </button>
              </div>

              {(() => {
                const byHour = getAppointmentsByHour(selectedDate)
                const hours = Object.keys(byHour).map(Number).sort((a, b) => a - b)

                if (hours.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <div className="mb-3 flex justify-center">
                        <CalendarIcon className="w-12 h-12 text-gray-400" />
                      </div>
                      <p className="text-gray-300 text-sm font-medium mb-1">
                        Немає записів на цей день
                      </p>
                      <p className="text-xs text-gray-400">
                        Створіть новий запис, щоб почати
                      </p>
                    </div>
                  )
                }

                return (
                  <div className="space-y-3">
                    {hours.map((hour) => (
                      <div key={hour} className="border-l-2 border-white/30 pl-3">
                        <div className="text-sm font-semibold text-gray-300 mb-2">
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
                                onEdit={handleEditAppointment}
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

          {/* List View */}
          {viewMode === 'list' && !showCreateForm && (
            <div className="rounded-xl p-4 md:p-6 card-floating">
              <h3 className="text-lg font-bold text-white mb-4" style={{ letterSpacing: '-0.02em' }}>
                Всі записи ({filteredAppointments.length})
              </h3>
              {filteredAppointments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mb-4 flex justify-center">
                    <CalendarIcon className="w-16 h-16 text-gray-400" />
                  </div>
                  <p className="text-gray-300 text-sm font-medium mb-2">
                    Немає записів
                  </p>
                  <p className="text-xs text-gray-400 mb-4">
                    Створіть новий запис, щоб почати
                  </p>
                  <button
                    onClick={() => {
                      setShowCreateForm(true)
                      setSelectedDate(new Date())
                    }}
                    className="px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors active:scale-[0.98]"
                    style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
                  >
                    Створити запис
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredAppointments
                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                    .map((appointment) => (
                      <MobileAppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        onStatusChange={handleStatusChange}
                        onEdit={handleEditAppointment}
                      />
                    ))}
                </div>
              )}
            </div>
          )}

          {viewMode === 'calendar' && !selectedDate && !showCreateForm && (
            <div className="rounded-xl p-8 md:p-12 text-center card-floating">
              <div className="mb-6 flex justify-center">
                <div className="w-24 h-24 md:w-32 md:h-32 bg-white/10 rounded-full flex items-center justify-center">
                  <CalendarIcon className="w-12 h-12 md:w-16 md:h-16 text-gray-400" />
                </div>
              </div>
              <h3 className="text-lg md:text-xl font-bold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>
                Оберіть дату в календарі
              </h3>
              <p className="text-gray-300 text-sm mb-6">
                Щоб переглянути записи на конкретну дату
              </p>
              <button
                onClick={() => {
                  setShowCreateForm(true)
                  setSelectedDate(new Date())
                }}
                className="px-4 py-2 md:px-6 md:py-3 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors active:scale-[0.98]"
                style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
              >
                Створити запис
              </button>
            </div>
          )}

          {/* Create Appointment Form */}
          {showCreateForm && (
            <div className="rounded-xl p-4 md:p-6 card-floating">
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

        {/* Right Column - Sidebar (1 column) - same as Dashboard */}
        <div className="lg:col-span-1 space-y-3 md:space-y-6">
          {/* Quick Stats - same card style as Dashboard sidebar */}
          <div className="rounded-xl p-4 md:p-6 card-floating">
            <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4" style={{ letterSpacing: '-0.01em' }}>
              Статистика
            </h3>
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">Всього</span>
                <span className="text-sm font-semibold text-white">{stats.total}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">Очікує</span>
                <span className="text-sm font-semibold text-orange-400">{stats.pending}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">Підтверджено</span>
                <span className="text-sm font-semibold text-green-400">{stats.confirmed}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">Виконано</span>
                <span className="text-sm font-semibold text-blue-400">{stats.done}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">Дохід</span>
                <span className="text-sm font-semibold text-purple-400">{stats.revenue} грн</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-4 md:p-6 card-floating">
            <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4" style={{ letterSpacing: '-0.01em' }}>
              Швидкі дії
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowCreateForm(true)
                  setSelectedDate(new Date())
                }}
                className="w-full px-3 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors active:scale-[0.98] text-left"
                style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
              >
                + Запис на сьогодні
              </button>
              <button
                onClick={() => router.push('/dashboard/clients')}
                className="w-full px-3 py-2 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-colors text-left"
              >
                Клієнти
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Client Card Modal */}
      {showQuickClientCard && business && (
        <QuickClientCard
          businessId={business.id}
          onSuccess={(client) => {
            setShowQuickClientCard(false)
            // Можна автоматично відкрити форму створення запису з даними клієнта
            setShowCreateForm(true)
            if (!selectedDate) {
              setSelectedDate(new Date())
            }
          }}
          onCancel={() => setShowQuickClientCard(false)}
        />
      )}

      {/* Edit Appointment Form Modal */}
      {showEditForm && editingAppointment && business && (
        <EditAppointmentForm
          appointment={editingAppointment}
          businessId={business.id}
          masters={masters}
          services={services}
          onSuccess={handleAppointmentUpdated}
          onCancel={() => {
            setShowEditForm(false)
            setEditingAppointment(null)
          }}
        />
      )}
    </div>
  )
}

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
    reloadAppointments()
  }

  const handleAppointmentUpdated = () => {
    setShowEditForm(false)
    setEditingAppointment(null)
    reloadAppointments()
  }

  const reloadAppointments = async () => {
    if (!business) return
    
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
            <h1 className="text-lg md:text-xl font-black text-white mb-1" style={{ letterSpacing: '-0.01em' }}>
              Записи та Візити
            </h1>
            <p className="text-xs md:text-sm text-gray-300">
              Управління записами та розкладом
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setShowQuickClientCard(true)}
              className="px-3 py-1.5 bg-white text-black font-black rounded-lg text-xs hover:bg-gray-100 transition-all active:scale-95 whitespace-nowrap flex items-center gap-1.5"
              style={{ boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.1)' }}
            >
              <UserIcon className="w-4 h-4" />
              ЗАПИС
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
              className="px-2.5 py-1.5 border border-gray-700 bg-[#1A1A1A] text-white hover:bg-gray-800 transition-all active:scale-95 rounded-lg text-xs font-bold"
            >
              {viewMode === 'calendar' ? '📋 Список' : '📅 Календар'}
            </button>
            <button
              onClick={handleExportCSV}
              className="px-2.5 py-1.5 border border-gray-700 bg-[#1A1A1A] text-white hover:bg-gray-800 transition-all active:scale-95 rounded-lg text-xs font-bold flex items-center gap-1"
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
              className="px-3 py-1.5 bg-white text-black font-bold rounded-lg text-xs hover:bg-gray-100 transition-all active:scale-95 whitespace-nowrap"
              style={{ boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.1)' }}
            >
              + Додати запис
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="rounded-xl p-4 mb-2 card-floating">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search */}
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Пошук по клієнту, телефону, послузі..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/15"
              />
            </div>
            
            {/* Master Filter */}
            <select
              value={filterMaster}
              onChange={(e) => setFilterMaster(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-white/20 rounded-lg bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white/15"
            >
              <option value="all">Всі спеціалісти</option>
              {masters.map((master) => (
                <option key={master.id} value={master.id}>{master.name}</option>
              ))}
            </select>
          </div>

          {/* Bulk Actions */}
          {selectedAppointments.size > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-600">
                Вибрано: {selectedAppointments.size}
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleBulkStatusChange('Confirmed')}
                  className="px-2 py-1 text-[10px] bg-green-500 text-white rounded-lg font-bold hover:opacity-80 transition-all"
                >
                  Підтвердити
                </button>
                <button
                  onClick={() => handleBulkStatusChange('Done')}
                  className="px-2 py-1 text-[10px] bg-blue-500 text-white rounded-lg font-bold hover:opacity-80 transition-all"
                >
                  Виконано
                </button>
                <button
                  onClick={() => handleBulkStatusChange('Cancelled')}
                  className="px-2 py-1 text-[10px] bg-red-500 text-white rounded-lg font-bold hover:opacity-80 transition-all"
                >
                  Скасувати
                </button>
                <button
                  onClick={() => setSelectedAppointments(new Set())}
                  className="px-2 py-1 text-[10px] border border-white/20 bg-white/10 text-white rounded-lg font-bold hover:bg-white/20 transition-all"
                >
                  Скасувати вибір
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
          <div className="rounded-xl p-3 text-center card-floating">
            <div className="text-xs text-gray-300 mb-0.5">Всього</div>
            <div className="text-sm font-black text-white">{stats.total}</div>
          </div>
          <div className="rounded-xl p-3 text-center card-floating">
            <div className="text-xs text-gray-300 mb-0.5">Очікує</div>
            <div className="text-sm font-black text-orange-400">{stats.pending}</div>
          </div>
          <div className="rounded-xl p-3 text-center card-floating">
            <div className="text-xs text-gray-300 mb-0.5">Підтверджено</div>
            <div className="text-sm font-black text-green-400">{stats.confirmed}</div>
          </div>
          <div className="rounded-xl p-3 text-center card-floating">
            <div className="text-xs text-gray-300 mb-0.5">Виконано</div>
            <div className="text-sm font-black text-blue-400">{stats.done}</div>
          </div>
          <div className="rounded-xl p-3 text-center card-floating">
            <div className="text-xs text-gray-300 mb-0.5">Дохід</div>
            <div className="text-sm font-black text-purple-400">{stats.revenue} грн</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-3">
          {/* Month Navigation */}
          <div className="rounded-xl p-4 card-floating">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
              <h2 className="text-base font-black text-white">
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
                  className="p-1 rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95"
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
                  className="px-2.5 py-1 bg-white text-black font-bold rounded-lg text-xs hover:bg-gray-100 transition-all active:scale-95"
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
                  className="p-1 rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95"
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
                    'px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95 whitespace-nowrap',
                    filterStatus === status
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white border border-white/10'
                  )}
                  style={filterStatus === status ? { boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' } : {}}
                >
                  {status === 'all' ? 'Всі' : status === 'Pending' ? 'Очікує' : status === 'Confirmed' ? 'Підтверджено' : status === 'Done' ? 'Виконано' : 'Скасовано'}
                </button>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day) => (
                <div key={day} className="text-center text-xs font-bold text-gray-400 py-1">
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
                      'relative p-1 rounded-lg border transition-all min-h-[40px] flex flex-col items-center justify-start',
                      !isCurrentMonth && 'opacity-30',
                      isSelected
                        ? 'border-blue-500 bg-blue-500/20 shadow-md'
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10',
                      isToday && !isSelected && 'ring-1 ring-blue-500/50',
                      isCurrentMonth && 'cursor-pointer active:scale-95'
                    )}
                  >
                    <div className={cn(
                      'text-xs font-black mb-0.5',
                      isToday ? 'text-blue-400' : 'text-white'
                    )}>
                      {format(day, 'd')}
                    </div>
                    {dayAppointments.length > 0 && (
                      <div className="w-full mt-auto">
                        <div className="text-[10px] font-black text-blue-400 text-center bg-blue-500/20 rounded-full py-0.5">
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
            <div className="rounded-xl p-4 card-floating">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-black text-white">
                  {format(selectedDate, 'd MMMM yyyy', { locale: uk })}
                </h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="px-2.5 py-1 border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95 rounded-lg text-xs font-bold"
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
                        <CalendarIcon className="w-10 h-10 text-gray-300" />
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
                  <div className="space-y-2">
                    {hours.map((hour) => (
                      <div key={hour} className="border-l-2 border-blue-500 pl-2">
                        <div className="text-sm font-black text-blue-500 mb-1.5">
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
            <div className="rounded-xl p-4 card-floating">
              <h3 className="text-base font-black text-white mb-3">
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
                    className="px-4 py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-100 transition-all active:scale-95"
                    style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
                  >
                    Створити новий запис
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
            <div className="rounded-xl p-12 text-center card-floating">
              <div className="mb-6 flex justify-center">
                <div className="w-32 h-32 bg-blue-50 rounded-full flex items-center justify-center">
                  <CalendarIcon className="w-16 h-16 text-blue-500" />
                </div>
              </div>
              <h3 className="text-xl font-black text-white mb-2">
                Оберіть дату в календарі
              </h3>
              <p className="text-gray-300 mb-6">
                Щоб переглянути записи на конкретну дату
              </p>
              <button
                onClick={() => {
                  setShowCreateForm(true)
                  setSelectedDate(new Date())
                }}
                className="px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-100 transition-all active:scale-95"
                style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
              >
                Створити новий запис
              </button>
            </div>
          )}

          {/* Create Appointment Form */}
          {showCreateForm && (
            <div className="rounded-xl p-4 card-floating">
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
          <div className="rounded-xl p-4 card-floating">
            <h3 className="text-sm font-black text-white mb-2">
              Статистика місяця
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/10">
                <span className="text-xs text-gray-300">Всього записів</span>
                <span className="text-sm font-black text-purple-400">{appointments.length}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/10">
                <span className="text-xs text-gray-300">Підтверджено</span>
                <span className="text-sm font-black text-green-400">
                  {appointments.filter(a => a.status === 'Confirmed').length}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/10">
                <span className="text-xs text-gray-300">Виконано</span>
                <span className="text-sm font-black text-blue-400">
                  {appointments.filter(a => a.status === 'Done').length}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl p-4 card-floating">
            <h3 className="text-sm font-black text-white mb-2">
              Швидкі дії
            </h3>
            <div className="space-y-1.5">
              <button
                onClick={() => {
                  setShowCreateForm(true)
                  setSelectedDate(new Date())
                }}
                className="w-full px-2.5 py-1.5 bg-white text-black font-bold rounded-lg text-xs hover:bg-gray-100 transition-all active:scale-95 text-left"
                style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
              >
                + Створити запис на сьогодні
              </button>
              <button
                onClick={() => router.push('/dashboard/clients')}
                className="w-full px-2.5 py-1.5 border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95 rounded-lg text-xs font-bold text-left"
              >
                Переглянути клієнтів
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

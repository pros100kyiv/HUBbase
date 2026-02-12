'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameDay, eachDayOfInterval, isValid } from 'date-fns'
import { uk } from 'date-fns/locale'
import { MobileAppointmentCard } from '@/components/admin/MobileAppointmentCard'
import { CreateAppointmentForm } from '@/components/admin/CreateAppointmentForm'
import { EditAppointmentForm } from '@/components/admin/EditAppointmentForm'
import { QuickClientCard } from '@/components/admin/QuickClientCard'
import { QuickRecordByPhoneModal } from '@/components/admin/QuickRecordByPhoneModal'
import { Modal } from '@/components/ui/modal'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon, FilterIcon, CheckIcon, UserIcon } from '@/components/icons'
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
  customServiceName?: string | null
  customPrice?: number | null
  isFromBooking?: boolean
}

export default function AppointmentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [business, setBusiness] = useState<any>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [calendarReady, setCalendarReady] = useState(false)
  const [currentMonth, setCurrentMonth] = useState<Date | null>(null)
  const [clientToday, setClientToday] = useState<Date | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const safeFormat = (date: Date | null, pattern: string, options?: any) => {
    if (!date) return ''
    return isValid(date) ? format(date, pattern, options) : ''
  }

  // Initialize calendar dates only on client to avoid hydration mismatch
  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    setCurrentMonth(today)
    setClientToday(today)
    setCalendarReady(true)
  }, [])
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterMaster, setFilterMaster] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedAppointments, setSelectedAppointments] = useState<Set<string>>(new Set())
  const [masters, setMasters] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [initialCreateTime, setInitialCreateTime] = useState<string | null>(null)
  const [initialMasterId, setInitialMasterId] = useState<string | null>(null)
  const [initialClientPhone, setInitialClientPhone] = useState<string>('')
  const [initialClientName, setInitialClientName] = useState<string>('')
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [showQuickClientCard, setShowQuickClientCard] = useState(false)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  // Показувати дохід у клітинках календаря, у блоці дня та в підсумку списку (зберігається в localStorage)
  const [showRevenue, setShowRevenue] = useState(true)
  /** Модалка «Вказати вартість» перед перемиканням на Виконано */
  const [showDonePriceModalForId, setShowDonePriceModalForId] = useState<string | null>(null)
  const [donePriceInputGrn, setDonePriceInputGrn] = useState<number | ''>('')
  const [donePriceServiceName, setDonePriceServiceName] = useState('')
  const [donePriceSaving, setDonePriceSaving] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('appointments_showRevenue')
      if (saved !== null) setShowRevenue(saved === '1')
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (showDonePriceModalForId) {
      setDonePriceInputGrn('')
      const apt = appointments.find((a) => a.id === showDonePriceModalForId)
      setDonePriceServiceName(apt?.customServiceName?.trim() ?? '')
    }
  }, [showDonePriceModalForId, appointments])

  const toggleShowRevenue = () => {
    setShowRevenue(prev => {
      const next = !prev
      try {
        localStorage.setItem('appointments_showRevenue', next ? '1' : '0')
      } catch {
        // ignore
      }
      return next
    })
  }

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

  // Встановити фільтри з URL при переході з аналітики (?status=...&masterId=...)
  useEffect(() => {
    if (searchParams.get('create') === 'true') return
    const statusParam = searchParams.get('status')
    const masterParam = searchParams.get('masterId')
    if (statusParam && ['Pending', 'Confirmed', 'Done', 'Cancelled'].includes(statusParam)) {
      setFilterStatus(statusParam)
    }
    if (masterParam && typeof masterParam === 'string' && masterParam.trim()) {
      setFilterMaster(masterParam.trim())
    }
  }, [searchParams])

  // Відкрити модалку «Записати» при переході з верхньої панелі (?create=true) або з «Вільні години» (?date=...&time=...)
  useEffect(() => {
    if (searchParams.get('create') !== 'true') return
    setShowCreateForm(true)
    const dateParam = searchParams.get('date')
    const timeParam = searchParams.get('time')
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [y, m, d] = dateParam.split('-').map(Number)
      const dObj = new Date(y, m - 1, d)
      if (!isNaN(dObj.getTime())) {
        setSelectedDate(dObj)
        setCurrentMonth(dObj)
      }
    }
    if (timeParam && /^\d{1,2}:\d{2}$/.test(decodeURIComponent(timeParam))) {
      setInitialCreateTime(decodeURIComponent(timeParam))
    }
    const masterParam = searchParams.get('masterId')
    if (masterParam && typeof masterParam === 'string' && masterParam.trim()) {
      setInitialMasterId(masterParam.trim())
    } else {
      setInitialMasterId(null)
    }
    router.replace('/dashboard/appointments', { scroll: false })
  }, [searchParams, router])

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
        const list = Array.isArray(data) ? data : []
        const withMasters = list.map((apt: Appointment) => {
          const master = masters.find((m: any) => m.id === apt.masterId)
          return { ...apt, masterName: master?.name || apt.master?.name || 'Невідомий спеціаліст' }
        })
        setAppointments(withMasters)
      })
      .catch((error) => {
        console.error('Error loading appointments:', error)
        setAppointments([])
      })
    // Intentionally NOT depending on `masters` to avoid refetch loops.
    // Master names will be patched in a separate effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business, currentMonth])

  // Patch masterName when masters list arrives/changes (without refetching appointments)
  useEffect(() => {
    if (masters.length === 0) return
    setAppointments((prev) =>
      prev.map((apt) => {
        const master = masters.find((m: any) => m.id === apt.masterId)
        const nextName = master?.name || apt.master?.name || apt.masterName || 'Невідомий спеціаліст'
        return apt.masterName === nextName ? apt : { ...apt, masterName: nextName }
      })
    )
  }, [masters])

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
    const prevAppointments = appointments
    setAppointments((prev) => prev.map((apt) => (apt.id === id ? { ...apt, status } : apt)))
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, businessId: business.id }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        toast({ title: 'Статус оновлено', type: 'success' })
        reloadAppointments()
      } else {
        setAppointments(prevAppointments)
        toast({ title: 'Помилка', description: data?.error || 'Не вдалося оновити статус', type: 'error' })
      }
    } catch (error) {
      setAppointments(prevAppointments)
      console.error('Error updating appointment:', error)
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося оновити статус',
        type: 'error',
      })
    }
  }

  const handleDoneWithPriceSubmit = async () => {
    if (!business || !showDonePriceModalForId) return
    const grn = donePriceInputGrn === '' ? NaN : Number(donePriceInputGrn)
    if (Number.isNaN(grn) || grn < 0) {
      toast({ title: 'Вкажіть вартість', type: 'error' })
      return
    }
    setDonePriceSaving(true)
    try {
      const res = await fetch(`/api/appointments/${showDonePriceModalForId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          status: 'Done',
          customPrice: Math.round(grn * 100),
          ...(donePriceServiceName.trim() && { customServiceName: donePriceServiceName.trim() }),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setShowDonePriceModalForId(null)
        reloadAppointments()
        toast({ title: 'Вартість збережено, статус: Виконано', type: 'success' })
      } else {
        toast({ title: 'Помилка', description: data?.error || 'Не вдалося зберегти', type: 'error' })
      }
    } catch (error) {
      console.error('Done with price failed:', error)
      toast({ title: 'Помилка', description: 'Не вдалося зберегти', type: 'error' })
    } finally {
      setDonePriceSaving(false)
    }
  }

  const handleBulkStatusChange = async (status: string) => {
    if (selectedAppointments.size === 0 || !business) return
    
    try {
      const ids = Array.from(selectedAppointments)
      const results = await Promise.all(
        ids.map(async (id) => {
          const res = await fetch(`/api/appointments/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, businessId: business.id }),
          })
          return { id, ok: res.ok }
        })
      )
      const succeeded = results.filter(r => r.ok).length
      const failed = results.filter(r => !r.ok).length
      if (failed > 0) {
        toast({
          title: failed === ids.length ? 'Помилка' : 'Частково оновлено',
          description: failed === ids.length
            ? 'Не вдалося оновити записи'
            : `Оновлено ${succeeded}, не вдалося ${failed}`,
          type: failed === ids.length ? 'error' : 'success',
        })
      } else {
        toast({ title: 'Статуси оновлено', type: 'success' })
      }
      setSelectedAppointments(new Set())
      reloadAppointments()
    } catch (error) {
      console.error('Error updating appointments:', error)
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося оновити записи',
        type: 'error',
      })
    }
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

  /** Сума за запис: customPrice (копійки) / 100 або сума цін послуг */
  const getAppointmentDisplayPrice = (apt: Appointment): number => {
    if (apt.customPrice != null && apt.customPrice > 0) return Math.round(apt.customPrice / 100)
    try {
      const ids = apt.services ? JSON.parse(apt.services) : []
      if (!Array.isArray(ids)) return 0
      return ids.reduce((acc: number, id: string) => {
        const s = services.find((x: { id: string; price?: number }) => x.id === id)
        return acc + (s?.price ?? 0)
      }, 0)
    } catch {
      return 0
    }
  }

  // Дохід тільки по виконаних записах (статус Виконано) — для календаря, дня та підсумку
  const doneRevenue = filteredAppointments
    .filter(a => a.status === 'Done' || a.status === 'Виконано')
    .reduce((sum, apt) => sum + getAppointmentDisplayPrice(apt), 0)

  // Calculate statistics (Очікує тільки для записів від клієнта — isFromBooking)
  const stats = {
    total: filteredAppointments.length,
    pending: filteredAppointments.filter(a => (a.status === 'Pending' || a.status === 'Очікує') && a.isFromBooking === true).length,
    confirmed: filteredAppointments.filter(a => a.status === 'Confirmed' || a.status === 'Підтверджено' || ((a.status === 'Pending' || a.status === 'Очікує') && a.isFromBooking !== true)).length,
    done: filteredAppointments.filter(a => a.status === 'Done' || a.status === 'Виконано').length,
    cancelled: filteredAppointments.filter(a => a.status === 'Cancelled' || a.status === 'Скасовано').length,
    revenue: doneRevenue,
  }

  const monthStart = currentMonth ? startOfMonth(currentMonth) : null
  const monthEnd = currentMonth ? endOfMonth(currentMonth) : null
  const calendarStart = monthStart ? startOfWeek(monthStart, { weekStartsOn: 1 }) : null
  const calendarEnd = monthEnd ? endOfWeek(monthEnd, { weekStartsOn: 1 }) : null
  const calendarDays = calendarStart && calendarEnd ? eachDayOfInterval({ start: calendarStart, end: calendarEnd }) : []

  const getAppointmentsForDay = (day: Date) => {
    if (!isValid(day)) return []
    return filteredAppointments.filter((apt) => {
      const start = new Date(apt.startTime)
      if (!isValid(start)) return false
      return isSameDay(start, day)
    })
  }

  // Статистика за обраний день (тільки в режимі календаря, коли вибрано дату)
  const dayAppointmentsForStats = viewMode === 'calendar' && selectedDate && isValid(selectedDate) ? getAppointmentsForDay(selectedDate) : []
  const dayStats = viewMode === 'calendar' && selectedDate && isValid(selectedDate) ? (() => {
    const list = dayAppointmentsForStats
    const dayDoneRevenue = list
      .filter(a => a.status === 'Done' || a.status === 'Виконано')
      .reduce((sum, apt) => sum + getAppointmentDisplayPrice(apt), 0)
    return {
      total: list.length,
      pending: list.filter(a => (a.status === 'Pending' || a.status === 'Очікує') && a.isFromBooking === true).length,
      confirmed: list.filter(a => a.status === 'Confirmed' || a.status === 'Підтверджено' || ((a.status === 'Pending' || a.status === 'Очікує') && a.isFromBooking !== true)).length,
      done: list.filter(a => a.status === 'Done' || a.status === 'Виконано').length,
      cancelled: list.filter(a => a.status === 'Cancelled' || a.status === 'Скасовано').length,
      revenue: dayDoneRevenue,
    }
  })() : null

  /** Колір бейджа кількості записів за домінантним статусом дня */
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

  if (!business) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-gray-500">Завантаження...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto min-w-0 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-6 min-w-0 w-full">
        {/* Left Column - Main Content (3 columns) - same as Dashboard */}
        <div className="lg:col-span-3 space-y-3 md:space-y-6 min-w-0">
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
              className="touch-target px-4 py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98] flex-shrink-0"
              style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
            >
              Записати
            </button>
          </div>

          {/* Search and Filters — все в одному рядку */}
          <div className="rounded-xl p-3 sm:p-4 md:p-6 card-glass">
            <div className="flex flex-col gap-2 md:gap-3">
              <div className="flex flex-row flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex-1 min-w-[140px] relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Пошук..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 min-h-[42px]"
                  />
                </div>
                <select
                  value={filterMaster}
                  onChange={(e) => setFilterMaster(e.target.value)}
                  className="shrink-0 min-w-[140px] max-w-[200px] px-3 py-2.5 text-sm border border-white/20 rounded-lg bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30 min-h-[42px]"
                >
                  <option value="all">Всі спеціалісти</option>
                  {masters.map((master) => (
                    <option key={master.id} value={master.id}>{master.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
                  className="touch-target min-h-[44px] px-3 py-2.5 sm:py-2 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-colors active:scale-[0.98]"
                >
                  {viewMode === 'calendar' ? 'Список' : 'Календар'}
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
                  <button onClick={() => handleBulkStatusChange('Confirmed')} className="touch-target min-h-[44px] px-3 py-2 text-xs bg-green-500/90 text-white rounded-lg font-medium hover:opacity-90 transition-all">Підтвердити</button>
                  <button onClick={() => handleBulkStatusChange('Done')} className="touch-target min-h-[44px] px-3 py-2 text-xs bg-blue-500/90 text-white rounded-lg font-medium hover:opacity-90 transition-all">Виконано</button>
                  <button onClick={() => handleBulkStatusChange('Cancelled')} className="touch-target min-h-[44px] px-3 py-2 text-xs bg-red-500/90 text-white rounded-lg font-medium hover:opacity-90 transition-all">Скасувати</button>
                  <button onClick={() => setSelectedAppointments(new Set())} className="px-2.5 py-1.5 text-xs border border-white/20 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-all">Скасувати вибір</button>
                </div>
              </div>
            )}
          </div>
          {/* Month Navigation & Calendar — картка календаря */}
          <div className="rounded-xl p-4 md:p-6 card-glass">
            {!calendarReady || !currentMonth ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <span className="text-sm">Завантаження календаря...</span>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                  <h2 className="text-lg md:text-xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
                    {safeFormat(currentMonth, 'LLLL yyyy', { locale: uk }) || '—'}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const prev = new Date(currentMonth)
                        prev.setMonth(prev.getMonth() - 1)
                        setCurrentMonth(prev)
                        setSelectedDate(null)
                      }}
                      className="touch-target p-2.5 rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
                      aria-label="Попередній місяць"
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
                      className="touch-target px-3 py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98]"
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
                      className="touch-target p-2.5 rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
                      aria-label="Наступний місяць"
                    >
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Компактні фільтри над календарем (дубль у блоці дати) */}
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {['all', 'Pending', 'Confirmed', 'Done', 'Cancelled'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={cn(
                        'touch-target min-h-[40px] px-2.5 py-2 sm:py-1 rounded-md text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap active:scale-[0.98]',
                        filterStatus === status ? 'bg-white text-black' : 'bg-white/10 text-gray-400 hover:bg-white/15 hover:text-white border border-white/10'
                      )}
                      style={filterStatus === status ? { boxShadow: '0 1px 2px rgba(0,0,0,0.2)' } : {}}
                    >
                      {status === 'all' ? 'Всі' : status === 'Pending' ? 'Очікує' : status === 'Confirmed' ? 'Підтверджено' : status === 'Done' ? 'Виконано' : 'Скасовано'}
                    </button>
                  ))}
                </div>

                {/* Календар — збільшений; min-w-0 щоб не вилітав за екран */}
                <div className="grid grid-cols-7 gap-2 w-full min-w-0">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((day) => (
                    <div key={day} className="text-center text-xs font-semibold text-gray-400 py-1.5">
                      {day}
                    </div>
                  ))}
                  {calendarDays.map((day, idx) => {
                    const dayAppointments = getAppointmentsForDay(day)
                    const isToday = clientToday ? isSameDay(day, clientToday) : false
                    const isSelected = selectedDate && isSameDay(day, selectedDate)
                    const isDayInCurrentMonth = currentMonth !== null && day.getMonth() === currentMonth.getMonth()
                    const dayKey = Number.isFinite(day.getTime()) ? day.toISOString() : `invalid-day-${idx}`

                    return (
                      <button
                        key={dayKey}
                        onClick={() => {
                          if (!isDayInCurrentMonth) return
                          const next = new Date(day.getTime())
                          if (!isValid(next)) return
                          setSelectedDate(next)
                        }}
                        className={cn(
                          'touch-target relative p-2 rounded-lg border transition-all min-h-[48px] flex flex-col items-center justify-start active:scale-[0.98]',
                          !isDayInCurrentMonth && 'opacity-30',
                          isSelected
                            ? 'border-white bg-white/25 text-white shadow-lg shadow-black/20'
                            : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10 text-white',
                          isToday && !isSelected && 'ring-1 ring-white/40 ring-offset-2 ring-offset-[#2A2A2A]',
                          isDayInCurrentMonth && 'cursor-pointer'
                        )}
                      >
                        <span className={cn("text-sm font-semibold", isToday ? "text-white font-bold" : "")}>
                          {format(day, 'd')}
                        </span>
                        {dayAppointments.length > 0 && (
                          <>
                            <span className={cn("mt-1 text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px]", getDayBadgeStyle(dayAppointments))}>
                              {dayAppointments.length}
                            </span>
                            {showRevenue && (() => {
                              const dayRev = dayAppointments
                                .filter(a => a.status === 'Done' || a.status === 'Виконано')
                                .reduce((s, apt) => s + getAppointmentDisplayPrice(apt), 0)
                              return dayRev > 0 ? (
                                <span className="mt-0.5 text-[9px] text-emerald-400/90 font-medium" title="Дохід за день (виконано)">
                                  {dayRev} грн
                                </span>
                              ) : null
                            })()}
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Розгорнутий блок обраної дати — компактно, без видимого скролбару */}
          {selectedDate && (() => {
            const dayAppointments = getAppointmentsForDay(selectedDate)
            const sorted = [...dayAppointments].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
            const dayRevenue = sorted
              .filter(a => a.status === 'Done' || a.status === 'Виконано')
              .reduce((sum, apt) => sum + getAppointmentDisplayPrice(apt), 0)
            return (
              <div className="dashboard-card">
                <div className="flex flex-col gap-2 mb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="dashboard-card-title-lg text-base md:text-lg">
                      {safeFormat(selectedDate, 'd MMMM yyyy', { locale: uk }) || 'Некоректна дата'}
                    </h3>
                    <button
                      onClick={() => setSelectedDate(null)}
                      className="touch-target dashboard-btn-secondary px-3 py-2 text-sm"
                    >
                      Закрити
                    </button>
                  </div>
                  {showRevenue && dayRevenue > 0 && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30">
                      <span className="text-sm text-gray-300">Дохід за день</span>
                      <span className="text-lg font-bold text-emerald-400">{dayRevenue} грн</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {['all', 'Pending', 'Confirmed', 'Done', 'Cancelled'].map((status) => (
                      <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={cn(
                          'touch-target min-h-[44px] px-3 py-2 rounded text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap active:scale-[0.98]',
                          filterStatus === status
                            ? 'bg-white text-black'
                            : 'bg-white/10 text-gray-400 hover:bg-white/15 hover:text-white border border-white/10'
                        )}
                        style={filterStatus === status ? { boxShadow: '0 1px 2px rgba(0,0,0,0.2)' } : {}}
                      >
                        {status === 'all' ? 'Всі' : status === 'Pending' ? 'Очікує' : status === 'Confirmed' ? 'Підтверджено' : status === 'Done' ? 'Виконано' : 'Скасовано'}
                      </button>
                    ))}
                  </div>
                </div>

                {sorted.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="mb-3 flex justify-center">
                      <CalendarIcon className="w-12 h-12 text-gray-400" />
                    </div>
                    <p className="text-gray-300 text-sm font-medium mb-1">Немає записів на цей день</p>
                    <p className="text-xs text-gray-400 mb-3">Створіть новий запис, щоб почати</p>
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="dashboard-btn-primary text-sm px-3 py-2"
                    >
                      Створити запис
                    </button>
                  </div>
                ) : (
                  <div className="max-h-[50vh] md:max-h-[55vh] overflow-y-auto scrollbar-hide pr-0.5 -mr-0.5">
                    <div className="space-y-1.5 md:space-y-2">
                      {sorted.map((appointment) => (
                        <MobileAppointmentCard
                          key={appointment.id}
                          appointment={appointment}
                          services={services}
                          onStatusChange={handleStatusChange}
                          onEdit={handleEditAppointment}
                          onOpenClientHistory={(phone) => router.push(`/dashboard/clients?phone=${encodeURIComponent(phone)}`)}
                          onDoneWithoutPrice={(id) => {
                          toast({
                            title: 'Статус не змінено',
                            description: 'Щоб позначити запис як Виконано, спочатку вкажіть вартість послуги в формі нижче.',
                            type: 'info',
                            duration: 4000,
                          })
                          setShowDonePriceModalForId(id)
                        }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* List View */}
          {viewMode === 'list' && !showCreateForm && (
            <div className="dashboard-card">
              <h3 className="dashboard-card-title-lg mb-3 text-base md:text-lg">
                Всі записи ({filteredAppointments.length})
              </h3>
              {filteredAppointments.length === 0 ? (
                <div className="text-center py-8">
                  <div className="mb-3 flex justify-center">
                    <CalendarIcon className="w-14 h-14 text-gray-400" />
                  </div>
                  <p className="text-gray-300 text-sm font-medium mb-2">Немає записів</p>
                  <p className="text-xs text-gray-400 mb-3">Створіть новий запис, щоб почати</p>
                  <button
                    onClick={() => {
                      setShowCreateForm(true)
                      setSelectedDate(new Date())
                    }}
                    className="dashboard-btn-primary text-sm px-3 py-2"
                  >
                    Створити запис
                  </button>
                </div>
              ) : (
                <>
                  <div className="max-h-[60vh] overflow-y-auto scrollbar-hide pr-0.5 -mr-0.5">
                    <div className="space-y-1.5 md:space-y-2">
                      {filteredAppointments
                        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                        .map((appointment) => (
                          <MobileAppointmentCard
                            key={appointment.id}
                            appointment={appointment}
                            services={services}
                            onStatusChange={handleStatusChange}
                            onEdit={handleEditAppointment}
                            onOpenClientHistory={(phone) => router.push(`/dashboard/clients?phone=${encodeURIComponent(phone)}`)}
                            onDoneWithoutPrice={(id) => {
                          toast({
                            title: 'Статус не змінено',
                            description: 'Щоб позначити запис як Виконано, спочатку вкажіть вартість послуги в формі нижче.',
                            type: 'info',
                            duration: 4000,
                          })
                          setShowDonePriceModalForId(id)
                        }}
                          />
                        ))}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-white/10 text-center text-xs text-gray-400">
                    Показано {filteredAppointments.length} записів
                    {showRevenue && ` · Дохід: ${stats.revenue} грн`}
                  </div>
                </>
              )}
            </div>
          )}

          {viewMode === 'calendar' && !selectedDate && !showCreateForm && (
            <div className="rounded-xl p-8 md:p-12 text-center card-glass">
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
                className="dashboard-btn-primary md:px-6 md:py-3"
              >
                Створити запис
              </button>
            </div>
          )}

        </div>

        {/* Right Column - Sidebar (1 column) - same as Dashboard */}
        <div className="lg:col-span-1 space-y-3 md:space-y-6 flex flex-col min-w-0 w-full max-w-full overflow-hidden">
          {/* Quick Stats — за період або за обраний день (коли в календарі натиснуто дату) */}
          <div className="rounded-xl p-4 md:p-6 card-glass min-w-0 overflow-hidden">
            <div className="mb-3 md:mb-4 flex flex-col gap-1">
              <h3 className="text-base md:text-lg font-semibold text-white" style={{ letterSpacing: '-0.01em' }}>
                Статистика
              </h3>
              {dayStats ? (
                <p className="text-xs text-emerald-400/90 font-medium">
                  За обраний день · {safeFormat(selectedDate, 'd MMM yyyy', { locale: uk })}
                </p>
              ) : (
                <p className="text-xs text-gray-500">За період (фільтри)</p>
              )}
            </div>
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">Всього</span>
                <span className="text-sm font-semibold text-white">{dayStats ? dayStats.total : stats.total}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">Очікує</span>
                <span className="text-sm font-semibold text-orange-400">{dayStats ? dayStats.pending : stats.pending}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">Підтверджено</span>
                <span className="text-sm font-semibold text-green-400">{dayStats ? dayStats.confirmed : stats.confirmed}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">Виконано</span>
                <span className="text-sm font-semibold text-blue-400">{dayStats ? dayStats.done : stats.done}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">{dayStats ? 'Дохід за день' : 'Дохід за період'}</span>
                <span className="text-sm font-semibold text-emerald-400">{dayStats ? dayStats.revenue : stats.revenue} грн</span>
              </div>
            </div>
          </div>

          {/* Повзунок: показувати дохід у календарі та списку */}
          <div className="rounded-xl p-4 md:p-6 card-glass min-w-0 overflow-hidden">
            <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4" style={{ letterSpacing: '-0.01em' }}>
              Відображення
            </h3>
            <div className="flex items-center justify-between gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
              <span className="text-sm text-gray-300 flex-1">
                Дохід у календарі та списку
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={showRevenue}
                onClick={toggleShowRevenue}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-[#2A2A2A]',
                  showRevenue ? 'bg-emerald-500' : 'bg-white/20'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    showRevenue ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                  style={{ marginTop: 2 }}
                />
              </button>
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              {showRevenue ? 'Увімкнено' : 'Вимкнено'} — суми в клітинках календаря, блоці дня та підсумку списку
            </p>
          </div>

          <div className="rounded-xl p-4 md:p-6 card-glass min-w-0 overflow-hidden">
            <div className="mb-3 md:mb-4 flex flex-col gap-1">
              <h3 className="text-base md:text-lg font-semibold text-white" style={{ letterSpacing: '-0.01em' }}>
                Швидкі дії
              </h3>
              {viewMode === 'calendar' && selectedDate && isValid(selectedDate) ? (
                <p className="text-xs text-emerald-400/90 font-medium">
                  Обрано: {safeFormat(selectedDate, 'd MMM yyyy', { locale: uk })}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              {viewMode === 'calendar' && selectedDate && isValid(selectedDate) ? (
                <>
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="w-full px-3 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98] text-left"
                    style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
                  >
                    + Запис на обраний день
                  </button>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="w-full px-3 py-2 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-colors text-left"
                  >
                    Зняти вибір дати
                  </button>
                </>
              ) : null}
              <button
                onClick={() => {
                  setShowCreateForm(true)
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  setSelectedDate(today)
                }}
                className={cn(
                  'w-full px-3 py-2 rounded-lg text-sm font-semibold transition-colors active:scale-[0.98] text-left',
                  viewMode === 'calendar' && selectedDate
                    ? 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
                    : 'bg-white text-black hover:bg-gray-100 hover:text-gray-900'
                )}
                style={viewMode === 'calendar' && selectedDate ? undefined : { boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
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

      {/* Записати — спочатку телефон: якщо клієнт є в базі → швидкий запис, якщо немає → картка клієнта */}
      {showCreateForm && business && (
        <QuickRecordByPhoneModal
          isOpen={showCreateForm}
          onClose={() => {
            setShowCreateForm(false)
            setInitialCreateTime(null)
            setInitialMasterId(null)
            setInitialClientPhone('')
            setInitialClientName('')
          }}
          businessId={business.id}
          masters={masters}
          services={services}
          selectedDate={selectedDate || undefined}
          initialStartTime={initialCreateTime ?? undefined}
          initialMasterId={initialMasterId ?? undefined}
          initialClientPhone={initialClientPhone || undefined}
          initialClientName={initialClientName || undefined}
          onAppointmentCreated={handleAppointmentCreated}
        />
      )}

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

      {/* Модалка: вказати вартість перед перемиканням на Виконано */}
      {showDonePriceModalForId && business && (() => {
        const apt = appointments.find((a) => a.id === showDonePriceModalForId)
        return (
          <Modal
            isOpen
            onClose={() => setShowDonePriceModalForId(null)}
            title="Вказати вартість послуги"
            subtitle={apt ? `${apt.clientName} · ${format(new Date(apt.startTime), 'd MMM, HH:mm', { locale: uk })}` : undefined}
            size="md"
            footer={
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDonePriceModalForId(null)}
                  className="flex-1 px-4 py-3 rounded-xl border border-white/20 bg-white/10 text-white text-sm font-medium hover:bg-white/15"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={handleDoneWithPriceSubmit}
                  disabled={donePriceSaving || donePriceInputGrn === '' || Number(donePriceInputGrn) < 0}
                  className="flex-1 px-4 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {donePriceSaving ? 'Збереження...' : 'Зберегти та Виконано'}
                </button>
              </div>
            }
          >
            <p className="text-sm text-amber-400/90 mb-4">Статус не змінено. Заповніть вартість нижче, щоб позначити запис як Виконано.</p>
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-gray-400 block mb-1.5">Вартість, грн</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={donePriceInputGrn === '' ? '' : donePriceInputGrn}
                  onChange={(e) => setDonePriceInputGrn(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                  placeholder="0"
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-400 block mb-1.5">Послуга (необов'язково)</span>
                <input
                  type="text"
                  value={donePriceServiceName}
                  onChange={(e) => setDonePriceServiceName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30 placeholder-gray-500"
                  placeholder="Наприклад: Стрижка, Манікюр"
                />
              </label>
            </div>
          </Modal>
        )
      })()}

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

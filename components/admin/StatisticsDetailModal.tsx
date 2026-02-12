'use client'

import { useEffect, useState } from 'react'
import { ModalPortal } from '@/components/ui/modal-portal'
import { XIcon, CalendarIcon, CheckIcon, UsersIcon, MoneyIcon, ClockIcon } from '@/components/icons'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { cn, fixMojibake } from '@/lib/utils'

interface StatisticsDetailModalProps {
  isOpen: boolean
  onClose: () => void
  businessId: string
  period: 'day' | 'week' | 'month'
  metricType: 'total' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'revenue' | 'clients'
  title: string
  icon: React.ReactNode
  iconColor: string
}

interface Appointment {
  id: string
  clientName: string
  clientPhone: string
  masterId: string
  master?: { id: string; name: string }
  startTime: string
  endTime: string
  status: string
  services?: string
  customServiceName?: string | null
  customPrice?: number
}

interface DailyStats {
  date: string
  count: number
  revenue?: number
}

interface Client {
  id: string
  name: string
  phone: string
  email?: string | null
  appointments?: Appointment[]
}

export function StatisticsDetailModal({
  isOpen,
  onClose,
  businessId,
  period,
  metricType,
  title,
  icon,
  iconColor,
}: StatisticsDetailModalProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [masters, setMasters] = useState<Array<{ id: string; name: string }>>([])
  const [services, setServices] = useState<Array<{ id: string; name: string; price: number }>>([])
  const [loading, setLoading] = useState(true)
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [masterStats, setMasterStats] = useState<Array<{ masterId: string; count: number; revenue?: number }>>([])

  useEffect(() => {
    if (!isOpen) return

    setLoading(true)
    
    // Для метрики "clients" завантажуємо клієнтів, а не записи
    if (metricType === 'clients') {
      fetch(`/api/clients?businessId=${businessId}&limit=200`)
        .then(res => res.json())
        .then(data => {
          const list = data?.clients ?? (Array.isArray(data) ? data : [])
          setClients(list)
          setAppointments([])
          setMasters([])
          setServices([])
          setDailyStats([])
          setMasterStats([])
          setLoading(false)
        })
        .catch(error => {
          console.error('Error loading clients:', error)
          setLoading(false)
        })
      return
    }
    
    // Визначаємо діапазон дат
    const now = new Date()
    let startDate: Date, endDate: Date
    
    switch (period) {
      case 'day':
        startDate = new Date(now)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'week':
        startDate = new Date(now)
        startDate.setDate(startDate.getDate() - 7)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now)
        endDate.setHours(23, 59, 59, 999)
        break
      case 'month':
        startDate = new Date(now)
        startDate.setMonth(startDate.getMonth() - 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now)
        endDate.setHours(23, 59, 59, 999)
        break
    }

    const startStr = format(startDate, 'yyyy-MM-dd')
    const endStr = format(endDate, 'yyyy-MM-dd')

    // Визначаємо статус для фільтрації
    const statusMap: Record<string, string> = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      completed: 'Done',
      cancelled: 'Cancelled',
    }
    const statusFilter = statusMap[metricType] || undefined

    // Завантажуємо дані
    Promise.all([
      fetch(`/api/appointments?businessId=${businessId}&startDate=${startStr}&endDate=${endStr}${statusFilter ? `&status=${statusFilter}` : ''}`)
        .then(res => res.json())
        .then(data => Array.isArray(data) ? data : []),
      fetch(`/api/masters?businessId=${businessId}`)
        .then(res => res.json())
        .then(data => Array.isArray(data) ? data : []),
      fetch(`/api/services?businessId=${businessId}`)
        .then(res => res.json())
        .then(data => Array.isArray(data) ? data : []),
    ])
      .then(([appts, mastersData, servicesData]) => {
        setAppointments(appts)
        setMasters(mastersData)
        setServices(servicesData)

        // Розраховуємо статистику по днях
        const dailyMap = new Map<string, { count: number; revenue: number }>()
        appts.forEach((apt: Appointment) => {
          const dateKey = format(new Date(apt.startTime), 'yyyy-MM-dd')
          const existing = dailyMap.get(dateKey) || { count: 0, revenue: 0 }
          existing.count++
          
          if (apt.status === 'Done' && metricType === 'revenue') {
            let revenue = 0
            try {
              const servicesList = JSON.parse(apt.services || '[]') as string[]
              revenue = servicesList.reduce((sum: number, sid: string) => {
                const service = servicesData.find((s: any) => s.id === sid)
                return sum + (service?.price || 0)
              }, 0)
              if (apt.customPrice) revenue += Number(apt.customPrice) / 100
            } catch {}
            existing.revenue += revenue
          }
          dailyMap.set(dateKey, existing)
        })
        
        const daily = Array.from(dailyMap.entries())
          .map(([date, data]) => ({
            date,
            count: data.count,
            revenue: data.revenue,
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
        
        setDailyStats(daily)

        // Розраховуємо статистику по спеціалістах
        const masterMap = new Map<string, { count: number; revenue: number }>()
        appts.forEach((apt: Appointment) => {
          const existing = masterMap.get(apt.masterId) || { count: 0, revenue: 0 }
          existing.count++
          
          if (apt.status === 'Done' && metricType === 'revenue') {
            let revenue = 0
            try {
              const servicesList = JSON.parse(apt.services || '[]') as string[]
              revenue = servicesList.reduce((sum: number, sid: string) => {
                const service = servicesData.find((s: any) => s.id === sid)
                return sum + (service?.price || 0)
              }, 0)
              if (apt.customPrice) revenue += Number(apt.customPrice) / 100
            } catch {}
            existing.revenue += revenue
          }
          masterMap.set(apt.masterId, existing)
        })
        
        const masterStatsData = Array.from(masterMap.entries())
          .map(([masterId, data]) => ({
            masterId,
            count: data.count,
            revenue: data.revenue || undefined,
          }))
          .sort((a, b) => b.count - a.count)
        
        setMasterStats(masterStatsData)
        setLoading(false)
      })
      .catch(error => {
        console.error('Error loading detail statistics:', error)
        setLoading(false)
      })
  }, [isOpen, businessId, period, metricType])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(amount))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      case 'Confirmed':
        return 'bg-green-500/20 text-green-400 border-green-500/50'
      case 'Done':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'Cancelled':
        return 'bg-red-500/20 text-red-400 border-red-500/50'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'Очікує'
      case 'Confirmed':
        return 'Підтверджено'
      case 'Done':
        return 'Виконано'
      case 'Cancelled':
        return 'Скасовано'
      default:
        return status
    }
  }

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <ModalPortal>
      <div className="modal-overlay sm:!p-4" onClick={onClose} role="presentation">
        <div className="relative w-[95%] sm:w-full sm:max-w-2xl sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onClose}
            className="modal-close touch-target text-gray-400 hover:text-white rounded-xl"
            aria-label="Закрити"
          >
            <XIcon className="w-5 h-5" />
          </button>
          <div className="pr-10 mb-2 flex-shrink-0 flex items-center gap-3">
            <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0', iconColor)}>
              {icon}
            </div>
            <div>
              <h2 className="modal-title">{title}</h2>
              <p className="modal-subtitle">
                {period === 'day' ? 'За сьогодні' : period === 'week' ? 'За тиждень' : 'За місяць'}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-400">Завантаження...</p>
            </div>
          ) : (
            <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
              {/* Загальна статистика */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-gray-400 mb-1">Всього</div>
                  <div className="text-2xl font-bold">
                    {metricType === 'clients' ? clients.length : appointments.length}
                  </div>
                </div>
                {metricType === 'revenue' && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="text-xs text-gray-400 mb-1">Дохід</div>
                    <div className="text-2xl font-bold text-green-400">
                      {formatCurrency(
                        appointments
                          .filter(a => a.status === 'Done')
                          .reduce((sum, apt) => {
                            let revenue = 0
                            try {
                              const servicesList = JSON.parse(apt.services || '[]') as string[]
                              revenue = servicesList.reduce((s: number, sid: string) => {
                                const service = services.find(sv => sv.id === sid)
                                return s + (service?.price || 0)
                              }, 0)
                              if (apt.customPrice) revenue += Number(apt.customPrice) / 100
                            } catch {}
                            return sum + revenue
                          }, 0)
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Статистика по днях (тільки для записів, не для клієнтів) */}
              {metricType !== 'clients' && dailyStats.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Розподіл по днях</h3>
                  <div className="space-y-2">
                    {dailyStats.map((day) => (
                      <div key={day.date} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                        <div className="flex items-center gap-3">
                          <CalendarIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">
                            {format(new Date(day.date), 'd MMMM yyyy', { locale: uk })}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-semibold">{day.count} записів</span>
                          {day.revenue !== undefined && day.revenue > 0 && (
                            <span className="text-sm font-semibold text-green-400">{formatCurrency(day.revenue)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Статистика по спеціалістах (тільки для записів, не для клієнтів) */}
              {metricType !== 'clients' && masterStats.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Розподіл по спеціалістах</h3>
                  <div className="space-y-2">
                    {masterStats.map((stat) => {
                      const master = masters.find(m => m.id === stat.masterId)
                      return (
                        <div key={stat.masterId} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                          <div className="flex items-center gap-3">
                            <UsersIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">{master?.name || 'Невідомий спеціаліст'}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-semibold">{stat.count} записів</span>
                            {stat.revenue !== undefined && stat.revenue > 0 && (
                              <span className="text-sm font-semibold text-green-400">{formatCurrency(stat.revenue)}</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Список клієнтів (для метрики clients) */}
              {metricType === 'clients' ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Список клієнтів</h3>
                  <div className="space-y-2">
                    {clients.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <p>Немає клієнтів</p>
                      </div>
                    ) : (
                      clients.map((client) => (
                        <a
                          key={client.id}
                          href={`/dashboard/clients?id=${encodeURIComponent(client.id)}`}
                          className="block p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <UsersIcon className="w-4 h-4 text-gray-400" />
                                <span className="text-sm font-semibold text-white">{client.name}</span>
                              </div>
                              <div className="text-xs text-gray-400 mb-1">{client.phone}</div>
                              {client.email && (
                                <div className="text-xs text-gray-500">{client.email}</div>
                              )}
                              {client.appointments && client.appointments.length > 0 && (
                                <div className="text-xs text-gray-500 mt-2">
                                  Останні записи: {client.appointments.length}
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-emerald-400 hover:underline">Відкрити</span>
                          </div>
                        </a>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* Список записів */
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-3">Список записів</h3>
                  <div className="space-y-2">
                    {appointments.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <p>Немає записів за вибраний період</p>
                      </div>
                    ) : (
                      appointments
                        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                        .map((apt) => {
                          const master = masters.find(m => m.id === apt.masterId)
                          const startTime = new Date(apt.startTime)
                          const endTime = new Date(apt.endTime)
                          
                          return (
                            <div key={apt.id} className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white tabular-nums">
                                      <ClockIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                      {format(startTime, 'HH:mm')}–{format(endTime, 'HH:mm')}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                      {format(startTime, 'd MMM', { locale: uk })}
                                    </span>
                                  </div>
                                  <div className="text-sm font-medium text-white mb-1">{fixMojibake(apt.clientName)}</div>
                                  <div className="text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                                    {apt.clientPhone}
                                    <a
                                      href={`/dashboard/clients?phone=${encodeURIComponent(apt.clientPhone)}`}
                                      className="text-emerald-400 hover:underline"
                                    >
                                      Історія клієнта
                                    </a>
                                  </div>
                                  {master && (
                                    <div className="text-xs text-gray-500 mt-1">Спеціаліст: {master.name}</div>
                                  )}
                                </div>
                                <div className={cn('px-2 py-1 rounded text-xs font-medium border', getStatusColor(apt.status))}>
                                  {getStatusLabel(apt.status)}
                                </div>
                              </div>
                              {(apt.services || apt.customServiceName) && (
                                <div className="text-xs text-gray-400 mt-2">
                                  {(() => {
                                    try {
                                      const servicesList = JSON.parse(apt.services || '[]') as string[]
                                      if (servicesList.length > 0) {
                                        return servicesList.map((sid: string) => {
                                          const service = services.find(s => s.id === sid)
                                          return service?.name || sid
                                        }).join(', ')
                                      }
                                      return apt.customServiceName?.trim() || 'Послуга не вказана'
                                    } catch {
                                      return apt.customServiceName?.trim() || apt.services || '—'
                                    }
                                  })()}
                                </div>
                              )}
                            </div>
                          )
                        })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  )
}

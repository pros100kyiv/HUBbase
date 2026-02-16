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
        return 'bg-amber-500/15 text-amber-200 border-amber-400/30'
      case 'Confirmed':
        return 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30'
      case 'Done':
        return 'bg-sky-500/15 text-sky-200 border-sky-400/30'
      case 'Cancelled':
        return 'bg-rose-500/15 text-rose-200 border-rose-400/30'
      default:
        return 'bg-white/10 text-gray-200 border-white/20'
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

  type Tone = 'done' | 'confirmed' | 'pending' | 'cancelled' | 'other'

  const toTone = (status: string): Tone => {
    switch (status) {
      case 'Done':
        return 'done'
      case 'Confirmed':
        return 'confirmed'
      case 'Pending':
        return 'pending'
      case 'Cancelled':
        return 'cancelled'
      default:
        return 'other'
    }
  }

  const toneRowBorder = (tone: Tone): string => {
    switch (tone) {
      case 'done':
        return 'border-l-sky-500/70'
      case 'confirmed':
        return 'border-l-emerald-500/70'
      case 'pending':
        return 'border-l-amber-500/70'
      case 'cancelled':
        return 'border-l-rose-500/60'
      default:
        return 'border-l-white/20'
    }
  }

  const getDisplayPriceGrn = (apt: Appointment): number | null => {
    if (apt.customPrice != null && apt.customPrice > 0) return Math.round(Number(apt.customPrice) / 100)
    try {
      const ids = JSON.parse(apt.services || '[]') as string[]
      if (!Array.isArray(ids) || ids.length === 0) return null
      const sum = ids.reduce((acc: number, sid: string) => {
        const s = services.find((x) => x.id === sid)
        return acc + (s?.price || 0)
      }, 0)
      return sum > 0 ? sum : null
    } catch {
      return null
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
                  <div className="space-y-3">
                    {appointments.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <p>Немає записів за вибраний період</p>
                      </div>
                    ) : (
                      (() => {
                        const sorted = [...appointments].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                        const sections: Array<{ dayKey: string; dayDate: Date; items: Appointment[] }> = []
                        for (const apt of sorted) {
                          const dayDate = new Date(apt.startTime)
                          const dayKey = format(dayDate, 'yyyy-MM-dd')
                          const last = sections[sections.length - 1]
                          if (!last || last.dayKey !== dayKey) sections.push({ dayKey, dayDate, items: [apt] })
                          else last.items.push(apt)
                        }

                        return sections.map((section) => (
                          <div key={section.dayKey} className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                            <div className="px-3 py-2 flex items-center justify-between gap-2 border-b border-white/10 bg-white/5">
                              <span className="text-xs font-semibold text-white tabular-nums">
                                {format(section.dayDate, 'dd.MM.yyyy')}
                              </span>
                              <span className="text-[11px] text-gray-400 capitalize">
                                {format(section.dayDate, 'EEEE', { locale: uk })}
                              </span>
                            </div>

                            <div className="divide-y divide-white/10">
                              {section.items.map((apt) => {
                                const master = masters.find((m) => m.id === apt.masterId)
                                const startTime = new Date(apt.startTime)
                                const endTime = new Date(apt.endTime)
                                const tone = toTone(apt.status)
                                const displayPrice = getDisplayPriceGrn(apt)

                                let serviceNames: string[] = []
                                try {
                                  const ids = JSON.parse(apt.services || '[]') as string[]
                                  if (Array.isArray(ids) && ids.length > 0) {
                                    serviceNames = ids.map((sid) => services.find((s) => s.id === sid)?.name || sid).filter(Boolean)
                                  } else if (apt.customServiceName?.trim()) {
                                    serviceNames = [apt.customServiceName.trim()]
                                  }
                                } catch {
                                  if (apt.customServiceName?.trim()) serviceNames = [apt.customServiceName.trim()]
                                }
                                const visibleServices = serviceNames.slice(0, 2)
                                const restServices = Math.max(0, serviceNames.length - visibleServices.length)

                                return (
                                  <div
                                    key={apt.id}
                                    className={cn(
                                      'px-3 py-2.5 hover:bg-white/[0.06] transition-colors border-l-4',
                                      toneRowBorder(tone)
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white tabular-nums">
                                            <ClockIcon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                            {format(startTime, 'HH:mm')}–{format(endTime, 'HH:mm')}
                                          </span>
                                          <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium border', getStatusColor(apt.status))}>
                                            {getStatusLabel(apt.status)}
                                          </span>
                                          <span className="text-[11px] text-gray-400 truncate">
                                            {master?.name || 'Невідомий спеціаліст'}
                                          </span>
                                        </div>

                                        <div className="mt-1 text-sm font-semibold text-white truncate">
                                          {fixMojibake(apt.clientName)}
                                        </div>

                                        <div className="mt-0.5 text-[11px] text-gray-400 flex items-center gap-2 flex-wrap">
                                          <span className="tabular-nums">{apt.clientPhone}</span>
                                          <a
                                            href={`/dashboard/clients?phone=${encodeURIComponent(apt.clientPhone)}`}
                                            className="text-emerald-400 hover:underline"
                                          >
                                            Історія клієнта
                                          </a>
                                        </div>

                                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                          {visibleServices.length > 0 ? (
                                            <>
                                              {visibleServices.map((name, idx) => (
                                                <span
                                                  key={`${apt.id}-svc-${idx}`}
                                                  className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-white/10 text-gray-200 border border-white/10 truncate max-w-[16rem]"
                                                  title={name}
                                                >
                                                  {name}
                                                </span>
                                              ))}
                                              {restServices > 0 && (
                                                <span className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-white/5 text-gray-400 border border-white/10">
                                                  +{restServices}
                                                </span>
                                              )}
                                            </>
                                          ) : (
                                            <span className="text-[11px] text-gray-500">Послуги не вказані</span>
                                          )}
                                        </div>
                                      </div>

                                      {displayPrice != null && displayPrice > 0 && (
                                        <div className="flex-shrink-0 text-sm font-semibold text-emerald-400 tabular-nums">
                                          {Math.round(displayPrice)} грн
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))
                      })()
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

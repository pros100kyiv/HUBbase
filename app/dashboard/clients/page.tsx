'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, isAfter } from 'date-fns'
import { cn } from '@/lib/utils'
import { ChevronDownIcon, ChevronUpIcon, UsersIcon, SearchIcon, DownloadIcon, FilterIcon, CheckIcon, CalendarIcon, PhoneIcon } from '@/components/icons'

interface Client {
  phone: string
  name: string
  appointmentsCount: number
  lastVisit: string
  totalSpent: number
  appointments: any[]
  servicesUsed: string[]
  nextAppointment?: string
}

interface ClientDetails {
  totalSpent: number
  lastVisit: string
  nextAppointment?: string
  servicesUsed: Array<{ id: string; name: string; count: number }>
}

export default function ClientsPage() {
  const router = useRouter()
  const [business, setBusiness] = useState<any>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [services, setServices] = useState<any[]>([])
  const [masters, setMasters] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [clientDetails, setClientDetails] = useState<Record<string, ClientDetails>>({})
  const [filterSegment, setFilterSegment] = useState<string>('all') // all, vip, active, inactive
  const [sortBy, setSortBy] = useState<string>('name') // name, visits, spent, lastVisit
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

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
      fetch(`/api/services?businessId=${business.id}`)
        .then((res) => res.json())
        .then((data) => setServices(data || [])),
      fetch(`/api/masters?businessId=${business.id}`)
        .then((res) => res.json())
        .then((data) => setMasters(data || [])),
      fetch(`/api/appointments?businessId=${business.id}`)
        .then((res) => res.json())
        .then((appointments) => {
          const clientsMap = new Map<string, Client>()

          appointments.forEach((apt: any) => {
            const existing = clientsMap.get(apt.clientPhone) || {
              phone: apt.clientPhone,
              name: apt.clientName,
              appointmentsCount: 0,
              lastVisit: apt.startTime,
              totalSpent: 0,
              appointments: [] as any[],
              servicesUsed: [] as string[],
            }

            existing.appointmentsCount++
            existing.appointments.push(apt)
            
            if (new Date(apt.startTime) > new Date(existing.lastVisit)) {
              existing.lastVisit = apt.startTime
            }

            try {
              if (apt.services) {
                const aptServices = JSON.parse(apt.services)
                existing.servicesUsed.push(...aptServices)
              }
            } catch (e) {
              // Ignore
            }

            clientsMap.set(apt.clientPhone, existing)
          })

          const clientsArray = Array.from(clientsMap.values()).map((client) => {
            const now = new Date()
            const futureAppointments = client.appointments
              .filter((apt: any) => isAfter(new Date(apt.startTime), now) && apt.status !== 'Cancelled')
              .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
            
            return {
              ...client,
              nextAppointment: futureAppointments.length > 0 ? futureAppointments[0].startTime : undefined,
            }
          })

          setClients(clientsArray)
          setLoading(false)
        })
    ]).catch((error) => {
      console.error('Error loading data:', error)
      setLoading(false)
    })
  }, [business])

  const calculateClientDetails = (client: Client): ClientDetails => {
    const serviceMap = new Map<string, { id: string; name: string; count: number }>()
    let totalSpent = 0

    client.appointments.forEach((apt: any) => {
      // Only count completed appointments for revenue
      if (apt.status === 'Done') {
        try {
          if (apt.services) {
            const aptServices = JSON.parse(apt.services)
            aptServices.forEach((serviceName: string) => {
              const service = services.find((s) => s.name === serviceName)
              if (service) {
                totalSpent += service.price
                const existing = serviceMap.get(service.id) || { id: service.id, name: service.name, count: 0 }
                existing.count++
                serviceMap.set(service.id, existing)
              }
            })
          }
        } catch (e) {
          // Try parsing as array of service names
          try {
            if (Array.isArray(apt.services)) {
              apt.services.forEach((serviceName: string) => {
                const service = services.find((s) => s.name === serviceName)
                if (service) {
                  totalSpent += service.price
                  const existing = serviceMap.get(service.id) || { id: service.id, name: service.name, count: 0 }
                  existing.count++
                  serviceMap.set(service.id, existing)
                }
              })
            }
          } catch (e2) {
            // Ignore
          }
        }
      }
    })

    return {
      totalSpent,
      lastVisit: client.lastVisit,
      nextAppointment: client.nextAppointment,
      servicesUsed: Array.from(serviceMap.values()),
    }
  }

  const getAppointmentServices = (appointment: any): string[] => {
    try {
      if (typeof appointment.services === 'string') {
        const parsed = JSON.parse(appointment.services)
        return Array.isArray(parsed) ? parsed : []
      }
      if (Array.isArray(appointment.services)) {
        return appointment.services
      }
    } catch (e) {
      // Ignore
    }
    return []
  }

  const getAppointmentTotal = (appointment: any): number => {
    const servicesList = getAppointmentServices(appointment)
    return servicesList.reduce((total, serviceName) => {
      const service = services.find(s => s.name === serviceName)
      return total + (service?.price || 0)
    }, 0)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
      case 'Очікує':
        return 'bg-candy-orange/10 text-candy-orange border-candy-orange'
      case 'Confirmed':
      case 'Підтверджено':
        return 'bg-candy-mint/10 text-candy-mint border-candy-mint'
      case 'Done':
      case 'Виконано':
        return 'bg-candy-blue/10 text-candy-blue border-candy-blue'
      case 'Cancelled':
      case 'Скасовано':
        return 'bg-red-50 text-red-500 border-red-500 dark:bg-red-900/20 dark:text-red-400'
      default:
        return 'bg-gray-50 text-gray-500 border-gray-400'
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

  const handleClientClick = (client: Client) => {
    if (expandedClient === client.phone) {
      setExpandedClient(null)
    } else {
      setExpandedClient(client.phone)
      if (!clientDetails[client.phone]) {
        const details = calculateClientDetails(client)
        setClientDetails((prev) => ({ ...prev, [client.phone]: details }))
      }
    }
  }

  const filteredClients = clients
    .filter((client) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = client.name.toLowerCase().includes(query)
        const matchesPhone = client.phone.includes(query)
        if (!matchesName && !matchesPhone) return false
      }

      // Segment filter
      if (filterSegment !== 'all') {
        const daysSinceLastVisit = Math.floor((new Date().getTime() - new Date(client.lastVisit).getTime()) / (1000 * 60 * 60 * 24))
        switch (filterSegment) {
          case 'vip':
            if (client.totalSpent < 5000 || client.appointmentsCount < 10) return false
            break
          case 'active':
            if (daysSinceLastVisit > 30) return false
            break
          case 'inactive':
            if (daysSinceLastVisit <= 90) return false
            break
        }
      }

      return true
    })
    .sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'visits':
          comparison = a.appointmentsCount - b.appointmentsCount
          break
        case 'spent':
          comparison = a.totalSpent - b.totalSpent
          break
        case 'lastVisit':
          comparison = new Date(a.lastVisit).getTime() - new Date(b.lastVisit).getTime()
          break
        default:
          comparison = 0
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

  const handleExportCSV = () => {
    const csvHeaders = ['Ім\'я', 'Телефон', 'Кількість візитів', 'Зароблено', 'Останній візит', 'Наступний візит', 'Послуги']
    const csvRows = filteredClients.map(client => {
      const details = clientDetails[client.phone] || calculateClientDetails(client)
      const servicesList = details.servicesUsed.map(s => `${s.name} (${s.count})`).join('; ')
      return [
        client.name,
        client.phone,
        client.appointmentsCount,
        client.totalSpent,
        format(new Date(client.lastVisit), 'dd.MM.yyyy HH:mm'),
        client.nextAppointment ? format(new Date(client.nextAppointment), 'dd.MM.yyyy HH:mm') : 'Немає',
        servicesList
      ]
    })
    
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `клієнти_${format(new Date(), 'dd_MM_yyyy')}.csv`
    link.click()
  }

  const toggleSelectClient = (phone: string) => {
    setSelectedClients(prev => {
      const next = new Set(prev)
      if (next.has(phone)) {
        next.delete(phone)
      } else {
        next.add(phone)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedClients.size === filteredClients.length) {
      setSelectedClients(new Set())
    } else {
      setSelectedClients(new Set(filteredClients.map(c => c.phone)))
    }
  }

  // Calculate statistics
  const stats = {
    total: filteredClients.length,
    vip: filteredClients.filter(c => c.totalSpent >= 5000 && c.appointmentsCount >= 10).length,
    active: filteredClients.filter(c => {
      const daysSinceLastVisit = Math.floor((new Date().getTime() - new Date(c.lastVisit).getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceLastVisit <= 30
    }).length,
    inactive: filteredClients.filter(c => {
      const daysSinceLastVisit = Math.floor((new Date().getTime() - new Date(c.lastVisit).getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceLastVisit > 90
    }).length,
    totalRevenue: filteredClients.reduce((sum, c) => sum + c.totalSpent, 0),
    avgRevenue: filteredClients.length > 0 ? filteredClients.reduce((sum, c) => sum + c.totalSpent, 0) / filteredClients.length : 0,
    avgVisits: filteredClients.length > 0 ? filteredClients.reduce((sum, c) => sum + c.appointmentsCount, 0) / filteredClients.length : 0,
  }

  if (!business || loading) {
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
              Клієнти
            </h1>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
              Управління базою клієнтів та їх історією
            </p>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 rounded-candy-xs text-xs font-bold"
            >
              {viewMode === 'cards' ? '📊 Таблиця' : '📋 Картки'}
            </button>
            <button
              onClick={handleExportCSV}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 rounded-candy-xs text-xs font-bold flex items-center gap-1"
            >
              <DownloadIcon className="w-3 h-3" />
              Експорт
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-2">
          <div className="card-candy p-2 text-center">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Всього</div>
            <div className="text-sm font-black text-gray-900 dark:text-white">{stats.total}</div>
          </div>
          <div className="card-candy p-2 text-center">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">VIP</div>
            <div className="text-sm font-black text-candy-purple">{stats.vip}</div>
          </div>
          <div className="card-candy p-2 text-center">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Активні</div>
            <div className="text-sm font-black text-candy-mint">{stats.active}</div>
          </div>
          <div className="card-candy p-2 text-center">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Неактивні</div>
            <div className="text-sm font-black text-candy-orange">{stats.inactive}</div>
          </div>
          <div className="card-candy p-2 text-center">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Дохід</div>
            <div className="text-sm font-black text-candy-blue">{Math.round(stats.totalRevenue)} грн</div>
          </div>
          <div className="card-candy p-2 text-center">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Середній чек</div>
            <div className="text-sm font-black text-candy-pink">{Math.round(stats.avgRevenue)} грн</div>
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
                placeholder="Пошук за ім'ям або телефоном..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-candy-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-candy-purple"
              />
            </div>
            
            {/* Segment Filter */}
            <select
              value={filterSegment}
              onChange={(e) => setFilterSegment(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-candy-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-candy-purple"
            >
              <option value="all">Всі клієнти</option>
              <option value="vip">VIP клієнти</option>
              <option value="active">Активні</option>
              <option value="inactive">Неактивні</option>
            </select>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-candy-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-candy-purple"
            >
              <option value="name">За ім'ям</option>
              <option value="visits">За візитами</option>
              <option value="spent">За витратами</option>
              <option value="lastVisit">За датою візиту</option>
            </select>

            {/* Sort Order */}
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-candy-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {/* Bulk Actions */}
          {selectedClients.size > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Вибрано: {selectedClients.size}
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    const phones = Array.from(selectedClients).join(', ')
                    window.open(`tel:${phones.split(',')[0]}`)
                  }}
                  className="px-2 py-1 text-[10px] bg-candy-blue text-white rounded-candy-xs font-bold hover:opacity-80 transition-all"
                >
                  📞 Дзвінок
                </button>
                <button
                  onClick={() => {
                    router.push(`/dashboard/appointments?clientPhone=${Array.from(selectedClients)[0]}`)
                  }}
                  className="px-2 py-1 text-[10px] bg-candy-mint text-white rounded-candy-xs font-bold hover:opacity-80 transition-all"
                >
                  📅 Запис
                </button>
                <button
                  onClick={() => setSelectedClients(new Set())}
                  className="px-2 py-1 text-[10px] border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white rounded-candy-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                  Скасувати вибір
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clients List */}
      {filteredClients.length === 0 ? (
        <div className="card-candy p-6 text-center">
          <div className="mb-4 flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-br from-candy-purple/20 to-candy-blue/20 rounded-full flex items-center justify-center">
              <UsersIcon className="w-10 h-10 text-candy-purple" />
            </div>
          </div>
          <h3 className="text-base font-black text-gray-900 dark:text-white mb-1.5">
            {searchQuery ? "Клієнтів не знайдено" : "Немає клієнтів"}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            {searchQuery ? "Спробуйте інший пошуковий запит" : "Клієнти з'являться після перших записів"}
          </p>
          {!searchQuery && (
            <button
              onClick={() => router.push('/dashboard/appointments')}
              className="px-3 py-1.5 bg-gradient-to-r from-candy-purple to-candy-blue text-white font-bold rounded-candy-xs text-xs shadow-soft-lg hover:shadow-soft-xl transition-all active:scale-95"
            >
              Створити перший запис
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {viewMode === 'table' && (
            <div className="card-candy p-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left p-2">
                      <button
                        onClick={toggleSelectAll}
                        className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center"
                      >
                        {selectedClients.size === filteredClients.length && filteredClients.length > 0 && (
                          <CheckIcon className="w-3 h-3 text-candy-purple" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-2 font-black">Ім'я</th>
                    <th className="text-left p-2 font-black">Телефон</th>
                    <th className="text-center p-2 font-black">Візити</th>
                    <th className="text-right p-2 font-black">Зароблено</th>
                    <th className="text-left p-2 font-black">Останній візит</th>
                    <th className="text-center p-2 font-black">Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => {
                    const isSelected = selectedClients.has(client.phone)
                    return (
                      <tr
                        key={client.phone}
                        className={cn(
                          "border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50",
                          isSelected && "bg-gradient-to-r from-candy-purple/10 to-candy-blue/10"
                        )}
                      >
                        <td className="p-2">
                          <button
                            onClick={() => toggleSelectClient(client.phone)}
                            className={cn(
                              "w-4 h-4 rounded border-2 flex items-center justify-center transition-all",
                              isSelected
                                ? "bg-candy-purple border-candy-purple"
                                : "border-gray-300 dark:border-gray-600"
                            )}
                          >
                            {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                          </button>
                        </td>
                        <td className="p-2 font-bold">{client.name}</td>
                        <td className="p-2">{client.phone}</td>
                        <td className="p-2 text-center">{client.appointmentsCount}</td>
                        <td className="p-2 text-right font-black text-candy-purple">
                          {Math.round(client.totalSpent)} грн
                        </td>
                        <td className="p-2">
                          {format(new Date(client.lastVisit), 'dd.MM.yyyy')}
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => window.open(`tel:${client.phone}`)}
                              className="p-1 text-candy-blue hover:bg-candy-blue/10 rounded-candy-xs transition-all"
                              title="Дзвінок"
                            >
                              <PhoneIcon className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => {
                                router.push(`/dashboard/appointments?clientPhone=${client.phone}`)
                              }}
                              className="p-1 text-candy-mint hover:bg-candy-mint/10 rounded-candy-xs transition-all"
                              title="Створити запис"
                            >
                              <CalendarIcon className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === 'cards' && filteredClients.map((client) => {
            const isExpanded = expandedClient === client.phone
            const details = clientDetails[client.phone]
            const isSelected = selectedClients.has(client.phone)

            return (
              <div
                key={client.phone}
                className={cn(
                  "card-candy overflow-hidden transition-all",
                  isExpanded && "shadow-soft-2xl",
                  isSelected && "ring-2 ring-candy-purple"
                )}
              >
                <div className="w-full p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleSelectClient(client.phone)}
                        className={cn(
                          "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
                          isSelected
                            ? "bg-candy-purple border-candy-purple"
                            : "border-gray-300 dark:border-gray-600"
                        )}
                      >
                        {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                      </button>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-candy-purple to-candy-blue flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white truncate mb-0.5">
                          {client.name}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                          {client.phone}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-center">
                        <div className="text-sm font-black text-candy-purple">
                          {client.appointmentsCount}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">Візитів</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-black text-candy-blue">
                          {Math.round(client.totalSpent)} грн
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">Зароблено</div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => window.open(`tel:${client.phone}`)}
                          className="p-1.5 text-candy-blue hover:bg-candy-blue/10 rounded-candy-xs transition-all"
                          title="Дзвінок"
                        >
                          <PhoneIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            router.push(`/dashboard/appointments?clientPhone=${client.phone}`)
                          }}
                          className="p-1.5 text-candy-mint hover:bg-candy-mint/10 rounded-candy-xs transition-all"
                          title="Створити запис"
                        >
                          <CalendarIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleClientClick(client)}
                          className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-candy-xs transition-all"
                        >
                          {isExpanded ? (
                            <ChevronUpIcon className="w-4 h-4" />
                          ) : (
                            <ChevronDownIcon className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-gray-200 dark:border-gray-700">
                    {details ? (
                      <div className="mt-2 space-y-3">
                        {/* Quick Stats */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-2 bg-gradient-to-br from-candy-purple/10 to-candy-purple/5 rounded-candy-xs border border-candy-purple/20">
                            <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold mb-0.5">Зароблено</div>
                            <div className="text-sm font-black text-candy-purple">
                              {new Intl.NumberFormat('uk-UA', {
                                style: 'currency',
                                currency: 'UAH',
                                minimumFractionDigits: 0,
                              }).format(details.totalSpent)}
                            </div>
                          </div>

                          <div className="p-2 bg-gradient-to-br from-candy-blue/10 to-candy-blue/5 rounded-candy-xs border border-candy-blue/20">
                            <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold mb-0.5">Останній візит</div>
                            <div className="text-xs font-black text-candy-blue">
                              {format(new Date(details.lastVisit), 'dd.MM.yyyy')}
                            </div>
                          </div>

                          {details.nextAppointment ? (
                            <div className="p-2 bg-gradient-to-br from-candy-mint/10 to-candy-mint/5 rounded-candy-xs border border-candy-mint/20">
                              <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold mb-0.5">Наступний</div>
                              <div className="text-xs font-black text-candy-mint">
                                {format(new Date(details.nextAppointment), 'dd.MM.yyyy')}
                              </div>
                            </div>
                          ) : (
                            <div className="p-2 bg-gradient-to-br from-candy-orange/10 to-candy-orange/5 rounded-candy-xs border border-candy-orange/20">
                              <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold mb-0.5">Наступний</div>
                              <div className="text-xs font-black text-candy-orange">Немає</div>
                            </div>
                          )}
                        </div>

                        {/* Appointment History */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-black text-gray-900 dark:text-white">
                              Історія візитів ({client.appointments.length})
                            </h4>
                            <button
                              onClick={() => {
                                router.push(`/dashboard/appointments?clientPhone=${client.phone}`)
                              }}
                              className="px-2 py-1 text-[10px] bg-gradient-to-r from-candy-purple to-candy-blue text-white font-bold rounded-candy-xs shadow-soft-lg hover:shadow-soft-xl transition-all"
                            >
                              + Новий візит
                            </button>
                          </div>
                          
                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {client.appointments
                              .sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                              .map((appointment: any) => {
                                const start = new Date(appointment.startTime)
                                const end = new Date(appointment.endTime)
                                const servicesList = getAppointmentServices(appointment)
                                const total = getAppointmentTotal(appointment)
                                const master = masters.find(m => m.id === appointment.masterId)
                                
                                return (
                                  <div
                                    key={appointment.id}
                                    className="p-2 rounded-candy-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                                  >
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <div className="text-xs font-black text-gray-900 dark:text-white">
                                            {format(start, 'dd.MM.yyyy')}
                                          </div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                                          </div>
                                          <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-bold border", getStatusColor(appointment.status))}>
                                            {getStatusLabel(appointment.status)}
                                          </span>
                                        </div>
                                        
                                        {master && (
                                          <div className="text-[10px] text-gray-600 dark:text-gray-400 mb-1">
                                            Спеціаліст: {master.name}
                                          </div>
                                        )}
                                        
                                        {servicesList.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mb-1">
                                            {servicesList.map((serviceName, idx) => {
                                              const service = services.find(s => s.name === serviceName)
                                              return (
                                                <span
                                                  key={idx}
                                                  className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-candy-pink/10 text-candy-pink border border-candy-pink/30"
                                                >
                                                  {serviceName} {service ? `(${service.price} грн)` : ''}
                                                </span>
                                              )
                                            })}
                                          </div>
                                        )}
                                        
                                        {appointment.notes && (
                                          <div className="text-[10px] text-gray-500 dark:text-gray-500 italic mt-1">
                                            {appointment.notes}
                                          </div>
                                        )}
                                      </div>
                                      
                                      <div className="text-right flex-shrink-0">
                                        {total > 0 && (
                                          <div className="text-sm font-black text-candy-purple mb-0.5">
                                            {Math.round(total)} грн
                                          </div>
                                        )}
                                        <button
                                          onClick={() => {
                                            router.push(`/dashboard/appointments?edit=${appointment.id}`)
                                          }}
                                          className="text-[10px] text-candy-blue hover:underline"
                                        >
                                          Редагувати
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            
                            {client.appointments.length === 0 && (
                              <div className="text-center py-4 text-xs text-gray-500 dark:text-gray-400">
                                Немає історії візитів
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Services Summary */}
                        {details.servicesUsed.length > 0 && (
                          <div className="p-2 bg-gradient-to-br from-candy-pink/10 to-candy-pink/5 rounded-candy-xs border border-candy-pink/20">
                            <div className="text-xs text-gray-600 dark:text-gray-400 font-bold mb-1.5">Популярні послуги</div>
                            <div className="flex flex-wrap gap-1.5">
                              {details.servicesUsed.map((service, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 text-xs font-bold rounded-full bg-white dark:bg-gray-800 text-candy-pink border border-candy-pink/30"
                                >
                                  {service.name} ({service.count})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-4 text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Завантаження деталей...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}




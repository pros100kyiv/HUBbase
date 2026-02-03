'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, isAfter, differenceInDays } from 'date-fns'
import { uk } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ChevronDownIcon, ChevronUpIcon, UsersIcon, SearchIcon, DownloadIcon, FilterIcon, CheckIcon, CalendarIcon, PhoneIcon, UserIcon, XIcon, SettingsIcon } from '@/components/icons'
import { QuickClientCard } from '@/components/admin/QuickClientCard'
import { toast } from '@/components/ui/toast'

interface Client {
  id: string
  phone: string
  name: string
  email?: string | null
  notes?: string | null
  totalAppointments: number
  totalSpent: number
  firstAppointmentDate?: string | null
  lastAppointmentDate?: string | null
  appointments: any[]
}

interface ClientDetails {
  totalSpent: number
  lastVisit: string
  nextAppointment?: string
  servicesUsed: Array<{ id: string; name: string; count: number }>
  lifetimeValue: number
  averageOrderValue: number
  retentionRate: number
}

export default function ClientsPage() {
  const router = useRouter()
  const [business, setBusiness] = useState<any>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [services, setServices] = useState<any[]>([])
  const [masters, setMasters] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [clientDetails, setClientDetails] = useState<Record<string, ClientDetails>>({})
  const [filterSegment, setFilterSegment] = useState<string>('all') // all, vip, active, inactive
  const [sortBy, setSortBy] = useState<string>('name') // name, visits, spent, lastVisit
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [showQuickClientCard, setShowQuickClientCard] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)

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

    const loadData = async () => {
      try {
        setLoading(true)
        
        const [servicesRes, mastersRes, clientsRes, appointmentsRes] = await Promise.all([
          fetch(`/api/services?businessId=${business.id}`),
          fetch(`/api/masters?businessId=${business.id}`),
          fetch(`/api/clients?businessId=${business.id}`),
          fetch(`/api/appointments?businessId=${business.id}`),
        ])

        const [servicesData, mastersData, clientsData, appointmentsData] = await Promise.all([
          servicesRes.json(),
          mastersRes.json(),
          clientsRes.json(),
          appointmentsRes.json(),
        ])

        setServices(servicesData || [])
        setMasters(mastersData || [])
        setAppointments(appointmentsData || [])
        
        // Об'єднуємо дані клієнтів з appointments для розрахунку статистики
        const clientsWithStats = (clientsData || []).map((client: any) => {
          const clientAppointments = (appointmentsData || []).filter(
            (apt: any) => apt.clientPhone === client.phone
          )
          
          // Розраховуємо totalSpent з виконаних записів
          let totalSpent = 0
          clientAppointments.forEach((apt: any) => {
            if (apt.status === 'Done') {
              try {
                const aptServices = typeof apt.services === 'string' 
                  ? JSON.parse(apt.services) 
                  : apt.services || []
                
                aptServices.forEach((serviceId: string) => {
                  const service = servicesData.find((s: any) => s.id === serviceId || s.name === serviceId)
                  if (service) {
                    totalSpent += service.price || 0
                  }
                })
                
                // Додаємо customPrice якщо є
                if (apt.customPrice) {
                  totalSpent += apt.customPrice
                }
              } catch (e) {
                // Ignore
              }
            }
          })

          return {
            ...client,
            totalAppointments: clientAppointments.length,
            totalSpent: totalSpent || client.totalSpent || 0,
            appointments: clientAppointments,
            firstAppointmentDate: clientAppointments.length > 0
              ? clientAppointments[clientAppointments.length - 1]?.startTime
              : null,
            lastAppointmentDate: clientAppointments.length > 0
              ? clientAppointments[0]?.startTime
              : null,
          }
        })

        setClients(clientsWithStats)
        setLoading(false)
      } catch (error) {
        console.error('Error loading data:', error)
        setLoading(false)
      }
    }

    loadData()
  }, [business])

  const calculateClientDetails = (client: Client): ClientDetails => {
    const serviceMap = new Map<string, { id: string; name: string; count: number }>()
    let totalSpent = 0
    const completedAppointments = client.appointments.filter((apt: any) => apt.status === 'Done')

    completedAppointments.forEach((apt: any) => {
      try {
        const aptServices = typeof apt.services === 'string' 
          ? JSON.parse(apt.services) 
          : apt.services || []
        
        aptServices.forEach((serviceId: string) => {
          const service = services.find((s) => s.id === serviceId || s.name === serviceId)
          if (service) {
            const price = service.price || 0
            totalSpent += price
            const existing = serviceMap.get(service.id) || { 
              id: service.id, 
              name: service.name, 
              count: 0 
            }
            existing.count++
            serviceMap.set(service.id, existing)
          }
        })
        
        if (apt.customPrice) {
          totalSpent += apt.customPrice
        }
      } catch (e) {
        // Ignore
      }
    })

    const now = new Date()
    const futureAppointments = client.appointments
      .filter((apt: any) => isAfter(new Date(apt.startTime), now) && apt.status !== 'Cancelled')
      .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

    const averageOrderValue = completedAppointments.length > 0 
      ? totalSpent / completedAppointments.length 
      : 0

    // Розраховуємо retention rate (спрощено)
    const firstVisit = client.firstAppointmentDate 
      ? new Date(client.firstAppointmentDate) 
      : null
    const lastVisit = client.lastAppointmentDate 
      ? new Date(client.lastAppointmentDate) 
      : null
    
    let retentionRate = 0
    if (firstVisit && lastVisit) {
      const daysBetween = differenceInDays(lastVisit, firstVisit)
      const daysSinceFirst = differenceInDays(now, firstVisit)
      if (daysSinceFirst > 0) {
        retentionRate = Math.min(100, (daysBetween / daysSinceFirst) * 100)
      }
    }

    return {
      totalSpent,
      lastVisit: client.lastAppointmentDate || client.firstAppointmentDate || new Date().toISOString(),
      nextAppointment: futureAppointments.length > 0 ? futureAppointments[0].startTime : undefined,
      servicesUsed: Array.from(serviceMap.values()),
      lifetimeValue: totalSpent,
      averageOrderValue,
      retentionRate,
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
    let total = servicesList.reduce((sum, serviceId) => {
      const service = services.find(s => s.id === serviceId || s.name === serviceId)
      return sum + (service?.price || 0)
    }, 0)
    
    if (appointment.customPrice) {
      total += appointment.customPrice
    }
    
    return total
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
    if (expandedClient === client.id) {
      setExpandedClient(null)
    } else {
      setExpandedClient(client.id)
      if (!clientDetails[client.id]) {
        const details = calculateClientDetails(client)
        setClientDetails((prev) => ({ ...prev, [client.id]: details }))
      }
    }
  }

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm('Ви впевнені, що хочете видалити цього клієнта? Цю дію неможливо скасувати.')) {
      return
    }

    try {
      const response = await fetch(`/api/clients/${clientId}?businessId=${business.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Не вдалося видалити клієнта')
      }

      toast({ title: 'Клієнта видалено', type: 'success' })
      setClients((prev) => prev.filter((c) => c.id !== clientId))
      setExpandedClient(null)
    } catch (error) {
      console.error('Error deleting client:', error)
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося видалити клієнта',
        type: 'error',
      })
    }
  }

  const handleEditClient = (client: Client) => {
    setEditingClient(client)
    setShowQuickClientCard(true)
  }

  const handleClientCreated = () => {
    setShowQuickClientCard(false)
    setEditingClient(null)
    // Перезавантажуємо дані
    if (business) {
      fetch(`/api/clients?businessId=${business.id}`)
        .then((res) => res.json())
        .then((data) => {
          const clientsWithStats = (data || []).map((client: any) => {
            const clientAppointments = appointments.filter(
              (apt: any) => apt.clientPhone === client.phone
            )
            
            let totalSpent = 0
            clientAppointments.forEach((apt: any) => {
              if (apt.status === 'Done') {
                try {
                  const aptServices = typeof apt.services === 'string' 
                    ? JSON.parse(apt.services) 
                    : apt.services || []
                  
                  aptServices.forEach((serviceId: string) => {
                    const service = services.find((s: any) => s.id === serviceId || s.name === serviceId)
                    if (service) {
                      totalSpent += service.price || 0
                    }
                  })
                  
                  if (apt.customPrice) {
                    totalSpent += apt.customPrice
                  }
                } catch (e) {
                  // Ignore
                }
              }
            })

            return {
              ...client,
              totalAppointments: clientAppointments.length,
              totalSpent,
              appointments: clientAppointments,
              firstAppointmentDate: clientAppointments.length > 0
                ? clientAppointments[clientAppointments.length - 1]?.startTime
                : null,
              lastAppointmentDate: clientAppointments.length > 0
                ? clientAppointments[0]?.startTime
                : null,
            }
          })
          setClients(clientsWithStats)
        })
    }
  }

  const filteredClients = clients
    .filter((client) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = client.name.toLowerCase().includes(query)
        const matchesPhone = client.phone.includes(query)
        const matchesEmail = client.email?.toLowerCase().includes(query) || false
        if (!matchesName && !matchesPhone && !matchesEmail) return false
      }

      // Segment filter
      if (filterSegment !== 'all') {
        const lastVisit = client.lastAppointmentDate 
          ? new Date(client.lastAppointmentDate) 
          : null
        const daysSinceLastVisit = lastVisit 
          ? Math.floor((new Date().getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
          : 999
        
        switch (filterSegment) {
          case 'vip':
            if (client.totalSpent < 5000 || client.totalAppointments < 10) return false
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
          comparison = a.totalAppointments - b.totalAppointments
          break
        case 'spent':
          comparison = a.totalSpent - b.totalSpent
          break
        case 'lastVisit':
          const aDate = a.lastAppointmentDate ? new Date(a.lastAppointmentDate).getTime() : 0
          const bDate = b.lastAppointmentDate ? new Date(b.lastAppointmentDate).getTime() : 0
          comparison = aDate - bDate
          break
        default:
          comparison = 0
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

  const handleExportCSV = () => {
    const csvHeaders = ['Ім\'я', 'Телефон', 'Email', 'Кількість візитів', 'Зароблено', 'Останній візит', 'Наступний візит', 'Послуги', 'Примітки']
    const csvRows = filteredClients.map(client => {
      const details = clientDetails[client.id] || calculateClientDetails(client)
      const servicesList = details.servicesUsed.map(s => `${s.name} (${s.count})`).join('; ')
      return [
        client.name,
        client.phone,
        client.email || '',
        client.totalAppointments,
        Math.round(client.totalSpent),
        client.lastAppointmentDate ? format(new Date(client.lastAppointmentDate), 'dd.MM.yyyy HH:mm') : 'Немає',
        details.nextAppointment ? format(new Date(details.nextAppointment), 'dd.MM.yyyy HH:mm') : 'Немає',
        servicesList,
        client.notes || ''
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

  const toggleSelectClient = (id: string) => {
    setSelectedClients(prev => {
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
    if (selectedClients.size === filteredClients.length) {
      setSelectedClients(new Set())
    } else {
      setSelectedClients(new Set(filteredClients.map(c => c.id)))
    }
  }

  // Calculate statistics
  const stats = {
    total: filteredClients.length,
    vip: filteredClients.filter(c => c.totalSpent >= 5000 && c.totalAppointments >= 10).length,
    active: filteredClients.filter(c => {
      const lastVisit = c.lastAppointmentDate ? new Date(c.lastAppointmentDate) : null
      if (!lastVisit) return false
      const daysSinceLastVisit = Math.floor((new Date().getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceLastVisit <= 30
    }).length,
    inactive: filteredClients.filter(c => {
      const lastVisit = c.lastAppointmentDate ? new Date(c.lastAppointmentDate) : null
      if (!lastVisit) return true
      const daysSinceLastVisit = Math.floor((new Date().getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceLastVisit > 90
    }).length,
    totalRevenue: filteredClients.reduce((sum, c) => sum + c.totalSpent, 0),
    avgRevenue: filteredClients.length > 0 ? filteredClients.reduce((sum, c) => sum + c.totalSpent, 0) / filteredClients.length : 0,
    avgVisits: filteredClients.length > 0 ? filteredClients.reduce((sum, c) => sum + c.totalAppointments, 0) / filteredClients.length : 0,
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
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => {
                setEditingClient(null)
                setShowQuickClientCard(true)
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-candy-blue to-candy-purple text-white font-black rounded-candy-xs text-xs shadow-soft-lg hover:shadow-soft-xl transition-all active:scale-95 whitespace-nowrap flex items-center gap-1.5"
            >
              <UserIcon className="w-4 h-4" />
              Додати клієнта
            </button>
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
                placeholder="Пошук за ім'ям, телефоном або email..."
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
                    const selectedClient = clients.find(c => selectedClients.has(c.id))
                    if (selectedClient) {
                      window.open(`tel:${selectedClient.phone}`)
                    }
                  }}
                  className="px-2 py-1 text-[10px] bg-candy-blue text-white rounded-candy-xs font-bold hover:opacity-80 transition-all"
                >
                  📞 Дзвінок
                </button>
                <button
                  onClick={() => {
                    const selectedClient = clients.find(c => selectedClients.has(c.id))
                    if (selectedClient) {
                      router.push(`/dashboard/appointments?clientPhone=${selectedClient.phone}`)
                    }
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
            {searchQuery ? "Спробуйте інший пошуковий запит" : "Додайте першого клієнта або створіть запис"}
          </p>
          {!searchQuery && (
            <button
              onClick={() => {
                setEditingClient(null)
                setShowQuickClientCard(true)
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-candy-purple to-candy-blue text-white font-bold rounded-candy-xs text-xs shadow-soft-lg hover:shadow-soft-xl transition-all active:scale-95"
            >
              Додати клієнта
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
                    <th className="text-left p-2 font-black">Email</th>
                    <th className="text-center p-2 font-black">Візити</th>
                    <th className="text-right p-2 font-black">Зароблено</th>
                    <th className="text-left p-2 font-black">Останній візит</th>
                    <th className="text-center p-2 font-black">Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => {
                    const isSelected = selectedClients.has(client.id)
                    return (
                      <tr
                        key={client.id}
                        className={cn(
                          "border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50",
                          isSelected && "bg-gradient-to-r from-candy-purple/10 to-candy-blue/10"
                        )}
                      >
                        <td className="p-2">
                          <button
                            onClick={() => toggleSelectClient(client.id)}
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
                        <td className="p-2 text-gray-600 dark:text-gray-400">{client.email || '-'}</td>
                        <td className="p-2 text-center">{client.totalAppointments}</td>
                        <td className="p-2 text-right font-black text-candy-purple">
                          {Math.round(client.totalSpent)} грн
                        </td>
                        <td className="p-2">
                          {client.lastAppointmentDate 
                            ? format(new Date(client.lastAppointmentDate), 'dd.MM.yyyy')
                            : 'Немає'}
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
                            <button
                              onClick={() => handleEditClient(client)}
                              className="p-1 text-candy-purple hover:bg-candy-purple/10 rounded-candy-xs transition-all"
                              title="Редагувати"
                            >
                              <SettingsIcon className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteClient(client.id)}
                              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-candy-xs transition-all"
                              title="Видалити"
                            >
                              <XIcon className="w-3 h-3" />
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
            const isExpanded = expandedClient === client.id
            const details = clientDetails[client.id] || (isExpanded ? calculateClientDetails(client) : null)
            const isSelected = selectedClients.has(client.id)

            return (
              <div
                key={client.id}
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
                        onClick={() => toggleSelectClient(client.id)}
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
                        {client.email && (
                          <p className="text-[10px] text-gray-500 dark:text-gray-500 truncate">
                            {client.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-center">
                        <div className="text-sm font-black text-candy-purple">
                          {client.totalAppointments}
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
                          onClick={() => handleEditClient(client)}
                          className="p-1.5 text-candy-purple hover:bg-candy-purple/10 rounded-candy-xs transition-all"
                          title="Редагувати"
                        >
                          <SettingsIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-candy-xs transition-all"
                          title="Видалити"
                        >
                          <XIcon className="w-4 h-4" />
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

                        {/* Client Notes */}
                        {client.notes && (
                          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-candy-xs border border-gray-200 dark:border-gray-700">
                            <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold mb-1">Примітки</div>
                            <div className="text-xs text-gray-900 dark:text-white">{client.notes}</div>
                          </div>
                        )}

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
                                            {servicesList.map((serviceId, idx) => {
                                              const service = services.find(s => s.id === serviceId || s.name === serviceId)
                                              return (
                                                <span
                                                  key={idx}
                                                  className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-candy-pink/10 text-candy-pink border border-candy-pink/30"
                                                >
                                                  {service?.name || serviceId} {service ? `(${service.price} грн)` : ''}
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

      {/* Quick Client Card Modal */}
      {showQuickClientCard && business && (
        <QuickClientCard
          businessId={business.id}
          initialPhone={editingClient?.phone || ''}
          initialName={editingClient?.name || ''}
          editingClient={editingClient}
          onSuccess={(client) => {
            handleClientCreated()
          }}
          onCancel={() => {
            setShowQuickClientCard(false)
            setEditingClient(null)
          }}
        />
      )}
    </div>
  )
}

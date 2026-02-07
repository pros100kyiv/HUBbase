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
  tags?: string | null
  metadata?: string | null
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
  const [historySortOrder, setHistorySortOrder] = useState<'desc' | 'asc'>('desc')
  const [historySearchQuery, setHistorySearchQuery] = useState('')
  const [historyStatus, setHistoryStatus] = useState<string>('all') // all, Pending, Confirmed, Done, Cancelled
  const [filterSegment, setFilterSegment] = useState<string>('all') // all, vip, active, inactive
  const [sortBy, setSortBy] = useState<string>('name') // name, visits, spent, lastVisit
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [showQuickClientCard, setShowQuickClientCard] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [showAllClients, setShowAllClients] = useState(false)
  const INITIAL_VISIBLE_COUNT = 10

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

        const [servicesDataRaw, mastersDataRaw, clientsDataRaw, appointmentsDataRaw] = await Promise.all([
          servicesRes.json(),
          mastersRes.json(),
          clientsRes.json(),
          appointmentsRes.json(),
        ])

        const servicesData = Array.isArray(servicesDataRaw) ? servicesDataRaw : []
        const mastersData = Array.isArray(mastersDataRaw) ? mastersDataRaw : []
        const clientsData = Array.isArray(clientsDataRaw) ? clientsDataRaw : []
        const appointmentsData = Array.isArray(appointmentsDataRaw) ? appointmentsDataRaw : []

        setServices(servicesData)
        setMasters(mastersData)
        setAppointments(appointmentsData)
        
        // Об'єднуємо дані клієнтів з appointments для розрахунку статистики
        const clientsWithStats = clientsData.map((client: any) => {
          const clientAppointments = appointmentsData.filter(
            (apt: any) => apt.clientPhone === client.phone
          )
          const appointmentsDesc = [...clientAppointments].sort(
            (a: any, b: any) =>
              new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
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
            totalSpent,
            appointments: appointmentsDesc,
            firstAppointmentDate: appointmentsDesc.length > 0
              ? appointmentsDesc[appointmentsDesc.length - 1]?.startTime
              : null,
            lastAppointmentDate: appointmentsDesc.length > 0
              ? appointmentsDesc[0]?.startTime
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
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      case 'Confirmed':
      case 'Підтверджено':
        return 'bg-green-500/20 text-green-400 border-green-500/50'
      case 'Done':
      case 'Виконано':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'Cancelled':
      case 'Скасовано':
        return 'bg-red-500/20 text-red-400 border-red-500/50'
      default:
        return 'bg-white/10 text-gray-400 border-white/20'
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

  const normalizeStatusKey = (status: string) => {
    switch (status) {
      case 'Pending':
      case 'Очікує':
        return 'Pending'
      case 'Confirmed':
      case 'Підтверджено':
        return 'Confirmed'
      case 'Done':
      case 'Виконано':
        return 'Done'
      case 'Cancelled':
      case 'Скасовано':
        return 'Cancelled'
      default:
        return status
    }
  }

  const parseClientTags = (tags?: string | null): string[] => {
    if (!tags) return []
    const raw = tags.trim()
    if (!raw) return []
    try {
      if (raw.startsWith('[')) {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed)
          ? parsed.map((t) => String(t).trim()).filter(Boolean)
          : []
      }
    } catch {
      // ignore
    }
    return raw.split(',').map((t) => t.trim()).filter(Boolean)
  }

  const formatClientMetadata = (metadata?: string | null): string | null => {
    if (!metadata) return null
    const raw = metadata.trim()
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return raw
    }
  }

  const handleClientClick = (client: Client) => {
    if (expandedClient === client.id) {
      setExpandedClient(null)
    } else {
      setExpandedClient(client.id)
      setHistorySortOrder('desc')
      setHistorySearchQuery('')
      setHistoryStatus('all')
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

  const handleClientCreated = (createdClient?: any) => {
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
            const appointmentsDesc = [...clientAppointments].sort(
              (a: any, b: any) =>
                new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
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
              appointments: appointmentsDesc,
              firstAppointmentDate: appointmentsDesc.length > 0
                ? appointmentsDesc[appointmentsDesc.length - 1]?.startTime
                : null,
              lastAppointmentDate: appointmentsDesc.length > 0
                ? appointmentsDesc[0]?.startTime
                : null,
            }
          })
          setClients(clientsWithStats)

          // Після створення нового клієнта — автоматично показуємо його у списку
          if (createdClient?.name) {
            setSearchQuery(createdClient.name)
          }
        })
        .catch((error) => {
          console.error('Error refreshing clients:', error)
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

  const visibleClients = showAllClients 
    ? filteredClients 
    : filteredClients.slice(0, INITIAL_VISIBLE_COUNT)
  const hiddenClientsCount = filteredClients.length - visibleClients.length
  const allVisibleSelected =
    visibleClients.length > 0 && visibleClients.every((c) => selectedClients.has(c.id))

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
    const visibleIds = visibleClients.map((c) => c.id)
    setSelectedClients((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id))
      } else {
        visibleIds.forEach((id) => next.add(id))
      }
      return next
    })
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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-6">
        {/* Left Column - Main Content (3 columns) - same as Dashboard */}
        <div className="lg:col-span-3 space-y-3 md:space-y-6">
          {/* Header - same style as Dashboard */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
              Клієнти
            </h1>
            <button
              onClick={() => {
                setEditingClient(null)
                setShowQuickClientCard(true)
              }}
              className="px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98] flex-shrink-0"
              style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
            >
              Додати клієнта
            </button>
          </div>

          {/* Search and Filters - card same as Dashboard */}
          <div className="rounded-xl p-4 md:p-6 card-glass">
            <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
              <div className="flex-1 relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Пошук за ім'ям, телефоном або email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                />
              </div>
              <select
                value={filterSegment}
                onChange={(e) => setFilterSegment(e.target.value)}
                className="px-3 py-2 text-sm border border-white/20 rounded-lg bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <option value="all">Всі клієнти</option>
                <option value="vip">VIP</option>
                <option value="active">Активні</option>
                <option value="inactive">Неактивні</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 text-sm border border-white/20 rounded-lg bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <option value="name">За ім'ям</option>
                <option value="visits">За візитами</option>
                <option value="spent">За витратами</option>
                <option value="lastVisit">За датою візиту</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
                  className="px-3 py-2 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                >
                  {viewMode === 'cards' ? 'Таблиця' : 'Картки'}
                </button>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-2 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                >
                  <DownloadIcon className="w-4 h-4" />
                  Експорт
                </button>
              </div>
            </div>
            {selectedClients.size > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-300">Вибрано: {selectedClients.size}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const c = clients.find(x => selectedClients.has(x.id))
                      if (c) window.open(`tel:${c.phone}`)
                    }}
                    className="px-2.5 py-1.5 text-xs bg-blue-500/90 text-white rounded-lg font-medium hover:opacity-90 transition-all"
                  >
                    Дзвінок
                  </button>
                  <button
                    onClick={() => {
                      const c = clients.find(x => selectedClients.has(x.id))
                      if (c) router.push(`/dashboard/appointments?clientPhone=${c.phone}`)
                    }}
                    className="px-2.5 py-1.5 text-xs bg-green-500/90 text-white rounded-lg font-medium hover:opacity-90 transition-all"
                  >
                    Запис
                  </button>
                  <button
                    onClick={() => setSelectedClients(new Set())}
                    className="px-2.5 py-1.5 text-xs border border-white/20 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-all"
                  >
                    Скасувати вибір
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Clients List */}
          {filteredClients.length === 0 ? (
            <div className="rounded-xl p-8 md:p-12 text-center card-glass">
              <div className="mb-6 flex justify-center">
                <div className="w-24 h-24 md:w-32 md:h-32 bg-white/10 rounded-full flex items-center justify-center">
                  <UsersIcon className="w-12 h-12 md:w-16 md:h-16 text-gray-400" />
                </div>
              </div>
              <h3 className="text-lg md:text-xl font-bold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>
                {searchQuery ? 'Клієнтів не знайдено' : 'Немає клієнтів'}
              </h3>
              <p className="text-sm text-gray-300 mb-6">
                {searchQuery ? 'Спробуйте інший пошуковий запит' : 'Додайте першого клієнта або створіть запис'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => {
                    setEditingClient(null)
                    setShowQuickClientCard(true)
                  }}
                  className="px-4 py-2 md:px-6 md:py-3 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98]"
                  style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
                >
                  Додати клієнта
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3 md:space-y-6">
              {viewMode === 'table' && (
                <div className="rounded-xl p-4 md:p-6 card-glass overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-3">
                      <button
                        onClick={toggleSelectAll}
                        className="w-4 h-4 rounded border-2 border-white/30 flex items-center justify-center hover:border-white/50 transition-colors"
                      >
                        {allVisibleSelected && (
                          <CheckIcon className="w-3 h-3 text-white" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-3 font-semibold text-white">Ім'я</th>
                    <th className="text-left p-3 font-semibold text-white">Телефон</th>
                    <th className="text-left p-3 font-semibold text-white">Email</th>
                    <th className="text-center p-3 font-semibold text-white">Візити</th>
                    <th className="text-right p-3 font-semibold text-white">Зароблено</th>
                    <th className="text-left p-3 font-semibold text-white">Останній візит</th>
                    <th className="text-center p-3 font-semibold text-white">Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleClients.map((client) => {
                    const isSelected = selectedClients.has(client.id)
                    return (
                      <tr
                        key={client.id}
                        className={cn(
                          'border-b border-white/10 hover:bg-white/5 transition-colors',
                          isSelected && 'bg-white/10'
                        )}
                      >
                        <td className="p-3">
                          <button
                            onClick={() => toggleSelectClient(client.id)}
                            className={cn(
                              'w-4 h-4 rounded border-2 flex items-center justify-center transition-all',
                              isSelected ? 'bg-white border-white' : 'border-white/30 hover:border-white/50'
                            )}
                          >
                            {isSelected && <CheckIcon className="w-3 h-3 text-black" />}
                          </button>
                        </td>
                        <td className="p-3 font-medium text-white">{client.name}</td>
                        <td className="p-3 text-gray-300">{client.phone}</td>
                        <td className="p-3 text-gray-400">{client.email || '-'}</td>
                        <td className="p-3 text-center text-white">{client.totalAppointments}</td>
                        <td className="p-3 text-right font-semibold text-purple-400">{Math.round(client.totalSpent)} грн</td>
                        <td className="p-3 text-gray-300">
                          {client.lastAppointmentDate
                            ? format(new Date(client.lastAppointmentDate), 'dd.MM.yyyy')
                            : 'Немає'}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1 justify-center">
                            <button onClick={() => window.open(`tel:${client.phone}`)} className="p-1.5 text-blue-400 hover:bg-white/10 rounded-lg transition-colors" title="Дзвінок"><PhoneIcon className="w-4 h-4" /></button>
                            <button onClick={() => router.push(`/dashboard/appointments?clientPhone=${client.phone}`)} className="p-1.5 text-green-400 hover:bg-white/10 rounded-lg transition-colors" title="Запис"><CalendarIcon className="w-4 h-4" /></button>
                            <button onClick={() => handleEditClient(client)} className="p-1.5 text-gray-300 hover:bg-white/10 rounded-lg transition-colors" title="Редагувати"><SettingsIcon className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteClient(client.id)} className="p-1.5 text-red-400 hover:bg-white/10 rounded-lg transition-colors" title="Видалити"><XIcon className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === 'cards' && visibleClients.map((client) => {
            const isExpanded = expandedClient === client.id
            const details = clientDetails[client.id] || (isExpanded ? calculateClientDetails(client) : null)
            const isSelected = selectedClients.has(client.id)

            return (
              <div
                key={client.id}
                className={cn(
                  'rounded-xl overflow-hidden transition-all card-glass',
                  isExpanded && 'shadow-lg',
                  isSelected && 'ring-2 ring-white/50'
                )}
              >
                <div className="w-full p-4 md:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleSelectClient(client.id)}
                        className={cn(
                          'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
                          isSelected ? 'bg-white border-white' : 'border-white/30 hover:border-white/50'
                        )}
                      >
                        {isSelected && <CheckIcon className="w-3 h-3 text-black" />}
                      </button>
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-white truncate mb-0.5">
                          {client.name}
                        </h3>
                        <p className="text-xs text-gray-300 truncate">{client.phone}</p>
                        {client.email && (
                          <p className="text-[10px] text-gray-400 truncate">{client.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-center">
                        <div className="text-sm font-semibold text-purple-400">{client.totalAppointments}</div>
                        <div className="text-[10px] text-gray-400">Візитів</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-semibold text-blue-400">{Math.round(client.totalSpent)} грн</div>
                        <div className="text-[10px] text-gray-400">Зароблено</div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => window.open(`tel:${client.phone}`)} className="p-1.5 text-blue-400 hover:bg-white/10 rounded-lg transition-colors" title="Дзвінок"><PhoneIcon className="w-4 h-4" /></button>
                        <button onClick={() => router.push(`/dashboard/appointments?clientPhone=${client.phone}`)} className="p-1.5 text-green-400 hover:bg-white/10 rounded-lg transition-colors" title="Запис"><CalendarIcon className="w-4 h-4" /></button>
                        <button onClick={() => handleEditClient(client)} className="p-1.5 text-gray-300 hover:bg-white/10 rounded-lg transition-colors" title="Редагувати"><SettingsIcon className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteClient(client.id)} className="p-1.5 text-red-400 hover:bg-white/10 rounded-lg transition-colors" title="Видалити"><XIcon className="w-4 h-4" /></button>
                        <button onClick={() => handleClientClick(client)} className="p-1.5 text-gray-400 hover:bg-white/10 rounded-lg transition-colors">
                          {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-white/10">
                    {details ? (
                      <div className="mt-3 space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                            <div className="text-[10px] text-gray-400 font-medium mb-0.5">Зароблено</div>
                            <div className="text-sm font-semibold text-purple-400">
                              {new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(details.totalSpent))}
                            </div>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                            <div className="text-[10px] text-gray-400 font-medium mb-0.5">Останній візит</div>
                            <div className="text-xs font-semibold text-blue-400">{format(new Date(details.lastVisit), 'dd.MM.yyyy')}</div>
                          </div>
                          {details.nextAppointment ? (
                            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                              <div className="text-[10px] text-gray-400 font-medium mb-0.5">Наступний</div>
                              <div className="text-xs font-semibold text-green-400">{format(new Date(details.nextAppointment), 'dd.MM.yyyy')}</div>
                            </div>
                          ) : (
                            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                              <div className="text-[10px] text-gray-400 font-medium mb-0.5">Наступний</div>
                              <div className="text-xs font-semibold text-orange-400">Немає</div>
                            </div>
                          )}
                        </div>
                        {client.notes && (
                          <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                            <div className="text-[10px] text-gray-400 font-medium mb-1">Примітки</div>
                            <div className="text-xs text-white">{client.notes}</div>
                          </div>
                        )}

                        {parseClientTags(client.tags).length > 0 && (
                          <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                            <div className="text-[10px] text-gray-400 font-medium mb-1">Теги</div>
                            <div className="flex flex-wrap gap-1.5">
                              {parseClientTags(client.tags).map((tag, idx) => (
                                <span
                                  key={`${tag}-${idx}`}
                                  className="px-2 py-1 text-[10px] font-semibold rounded-full bg-white/10 text-white border border-white/10"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {formatClientMetadata(client.metadata) && (
                          <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                            <div className="text-[10px] text-gray-400 font-medium mb-1">Додаткова інформація</div>
                            <pre className="text-[11px] text-white/90 whitespace-pre-wrap break-words leading-relaxed">{formatClientMetadata(client.metadata)}</pre>
                          </div>
                        )}

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-white">Історія візитів ({client.appointments.length})</h4>
                            <button
                              onClick={() => router.push(`/dashboard/appointments?clientPhone=${client.phone}`)}
                              className="px-2.5 py-1.5 text-xs bg-white text-black rounded-lg font-medium hover:bg-gray-100 hover:text-gray-900 transition-colors"
                              style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
                            >
                              + Новий візит
                            </button>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 mb-2">
                            <div className="flex-1 relative">
                              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                              <input
                                type="text"
                                value={historySearchQuery}
                                onChange={(e) => setHistorySearchQuery(e.target.value)}
                                placeholder="Пошук в історії (послуга, майстер, нотатки...)"
                                className="w-full pl-9 pr-3 py-2 text-xs border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                              />
                            </div>
                            <select
                              value={historyStatus}
                              onChange={(e) => setHistoryStatus(e.target.value)}
                              className="px-3 py-2 text-xs border border-white/20 rounded-lg bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                            >
                              <option value="all">Всі</option>
                              <option value="Pending">Очікує</option>
                              <option value="Confirmed">Підтверджено</option>
                              <option value="Done">Виконано</option>
                              <option value="Cancelled">Скасовано</option>
                            </select>
                            <button
                              onClick={() => setHistorySortOrder(historySortOrder === 'desc' ? 'asc' : 'desc')}
                              className="px-3 py-2 text-xs border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg font-medium transition-colors"
                              title="Сортування за датою"
                            >
                              {historySortOrder === 'desc' ? 'Нові' : 'Старі'}
                            </button>
                          </div>

                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {(() => {
                              const q = historySearchQuery.trim().toLowerCase()
                              const filtered = (client.appointments || [])
                                .filter((apt: any) => {
                                  if (historyStatus === 'all') return true
                                  return normalizeStatusKey(apt.status) === historyStatus
                                })
                                .filter((apt: any) => {
                                  if (!q) return true
                                  const masterName =
                                    masters.find((m) => m.id === apt.masterId)?.name || ''
                                  const servicesList = getAppointmentServices(apt)
                                  const servicesText = servicesList
                                    .map((serviceId) => {
                                      const service = services.find(
                                        (s) => s.id === serviceId || s.name === serviceId
                                      )
                                      return service?.name || serviceId
                                    })
                                    .join(' ')
                                  const dateText = (() => {
                                    try {
                                      const d = new Date(apt.startTime)
                                      return Number.isFinite(d.getTime())
                                        ? format(d, 'dd.MM.yyyy HH:mm')
                                        : ''
                                    } catch {
                                      return ''
                                    }
                                  })()
                                  const hay = [
                                    apt.clientName,
                                    apt.clientPhone,
                                    apt.notes || '',
                                    masterName,
                                    servicesText,
                                    getStatusLabel(apt.status),
                                    dateText,
                                  ]
                                    .join(' ')
                                    .toLowerCase()
                                  return hay.includes(q)
                                })
                                .sort((a: any, b: any) => {
                                  const aT = new Date(a.startTime).getTime()
                                  const bT = new Date(b.startTime).getTime()
                                  return historySortOrder === 'desc' ? bT - aT : aT - bT
                                })

                              if (filtered.length === 0) {
                                return (
                                  <div className="text-center py-4 text-xs text-gray-400">
                                    Немає записів за цими фільтрами
                                  </div>
                                )
                              }

                              return filtered.map((appointment: any) => {
                                const start = new Date(appointment.startTime)
                                const end = new Date(appointment.endTime)
                                const servicesList = getAppointmentServices(appointment)
                                const total = getAppointmentTotal(appointment)
                                const master = masters.find((m) => m.id === appointment.masterId)

                                return (
                                  <div
                                    key={appointment.id}
                                    className="p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/[0.07] transition-colors"
                                  >
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                          <span className="text-xs font-semibold text-white">
                                            {format(start, 'dd.MM.yyyy')}
                                          </span>
                                          <span className="text-xs text-gray-400">
                                            {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                                          </span>
                                          <span
                                            className={cn(
                                              'px-1.5 py-0.5 rounded-full text-[10px] font-medium border',
                                              getStatusColor(appointment.status)
                                            )}
                                          >
                                            {getStatusLabel(appointment.status)}
                                          </span>
                                        </div>
                                        {master && (
                                          <div className="text-[10px] text-gray-400 mb-1">
                                            Спеціаліст: {master.name}
                                          </div>
                                        )}
                                        {servicesList.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mb-1">
                                            {servicesList.map((serviceId, idx) => {
                                              const service = services.find(
                                                (s) => s.id === serviceId || s.name === serviceId
                                              )
                                              return (
                                                <span
                                                  key={idx}
                                                  className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-white/10 text-pink-400 border border-white/10"
                                                >
                                                  {service?.name || serviceId}{' '}
                                                  {service ? `(${Math.round(service.price)} грн)` : ''}
                                                </span>
                                              )
                                            })}

                                          </div>
                                        )}
                                        {appointment.notes && (
                                          <div className="text-[10px] text-gray-500 italic mt-1">
                                            {appointment.notes}
                                          </div>
                                        )}
                                      </div>
                                      {total > 0 && (
                                        <div className="text-sm font-semibold text-purple-400 flex-shrink-0">
                                          {Math.round(total)} грн
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })
                            })()}
                          </div>
                        </div>
                        {details.servicesUsed.length > 0 && (
                          <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                            <div className="text-xs text-gray-400 font-medium mb-1.5">Популярні послуги</div>
                            <div className="flex flex-wrap gap-1.5">
                              {details.servicesUsed.map((service, idx) => (
                                <span key={idx} className="px-2 py-1 text-xs font-medium rounded-full bg-white/10 text-pink-400 border border-white/10">{service.name} ({service.count})</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-4 text-center">
                        <p className="text-xs text-gray-400">Завантаження деталей...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
            
              {filteredClients.length > INITIAL_VISIBLE_COUNT && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => setShowAllClients(!showAllClients)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium border border-white/10"
                  >
                    {showAllClients ? (
                      <>
                        <ChevronUpIcon className="w-4 h-4" />
                        Згорнути до {INITIAL_VISIBLE_COUNT}
                      </>
                    ) : (
                      <>
                        <ChevronDownIcon className="w-4 h-4" />
                        Показати ще {hiddenClientsCount}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-3 md:space-y-6">
          <div className="rounded-xl p-4 md:p-6 card-glass">
            <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4" style={{ letterSpacing: '-0.01em' }}>Статистика</h3>
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"><span className="text-sm text-gray-300">Всього</span><span className="text-sm font-semibold text-white">{stats.total}</span></div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"><span className="text-sm text-gray-300">VIP</span><span className="text-sm font-semibold text-purple-400">{stats.vip}</span></div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"><span className="text-sm text-gray-300">Активні</span><span className="text-sm font-semibold text-green-400">{stats.active}</span></div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"><span className="text-sm text-gray-300">Неактивні</span><span className="text-sm font-semibold text-orange-400">{stats.inactive}</span></div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"><span className="text-sm text-gray-300">Дохід</span><span className="text-sm font-semibold text-blue-400">{Math.round(stats.totalRevenue)} грн</span></div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"><span className="text-sm text-gray-300">Середній чек</span><span className="text-sm font-semibold text-pink-400">{Math.round(stats.avgRevenue)} грн</span></div>
            </div>
          </div>
          <div className="rounded-xl p-4 md:p-6 card-glass">
            <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4" style={{ letterSpacing: '-0.01em' }}>Швидкі дії</h3>
            <div className="space-y-2">
              <button onClick={() => { setEditingClient(null); setShowQuickClientCard(true) }} className="w-full px-3 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98] text-left" style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}>+ Додати клієнта</button>
              <button onClick={() => router.push('/dashboard/appointments')} className="w-full px-3 py-2 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-colors text-left">Записи</button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Client Card Modal */}
      {showQuickClientCard && business && (
        <QuickClientCard
          businessId={business.id}
          initialPhone={editingClient?.phone || ''}
          initialName={editingClient?.name || ''}
          editingClient={editingClient}
          onSuccess={(client) => {
            handleClientCreated(client)
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

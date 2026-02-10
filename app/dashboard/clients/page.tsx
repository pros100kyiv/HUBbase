'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format, isAfter, differenceInDays } from 'date-fns'
import { uk } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ChevronDownIcon, ChevronUpIcon, UsersIcon, SearchIcon, DownloadIcon, FilterIcon, CheckIcon, CalendarIcon, PhoneIcon, UserIcon, XIcon, SettingsIcon } from '@/components/icons'
import { QuickClientCard } from '@/components/admin/QuickClientCard'
import { ModalPortal } from '@/components/ui/modal-portal'
import { toast } from '@/components/ui/toast'
import { uaPhoneDigits } from '@/lib/utils/phone'

function findClientByPhoneNumber(clients: Client[], input: string): Client | null {
  const digits = uaPhoneDigits(input)
  if (!digits.length) return null
  return clients.find((c) => {
    const clientDigits = uaPhoneDigits(c.phone)
    return clientDigits === digits || clientDigits.endsWith(digits) || digits.endsWith(clientDigits)
  }) || null
}

interface Client {
  id: string
  phone: string
  name: string
  email?: string | null
  notes?: string | null
  tags?: string | null
  metadata?: string | null
  status?: string | null
  totalAppointments: number
  totalSpent: number
  firstAppointmentDate?: string | null
  lastAppointmentDate?: string | null
  appointments: any[]
}

const CLIENT_STATUS_LABELS: Record<string, string> = {
  new: 'Новий',
  regular: 'Постійний',
  vip: 'VIP',
  inactive: 'Неактивний',
}
function getClientStatusLabel(status?: string | null): string {
  if (!status) return CLIENT_STATUS_LABELS.new
  return CLIENT_STATUS_LABELS[status] || status
}
function getClientStatusBadgeClass(status?: string | null): string {
  switch (status || 'new') {
    case 'vip': return 'bg-amber-500/25 text-amber-200 border-amber-400/50'
    case 'regular': return 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50'
    case 'inactive': return 'bg-gray-500/25 text-gray-300 border-gray-400/50'
    default: return 'bg-white/15 text-gray-300 border-white/20'
  }
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
  const [filterClientStatus, setFilterClientStatus] = useState<string>('all') // all, new, regular, vip, inactive
  const [sortBy, setSortBy] = useState<string>('name') // name, visits, spent, lastVisit
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [showQuickClientCard, setShowQuickClientCard] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [showAllClients, setShowAllClients] = useState(false)
  const [phoneSearchInput, setPhoneSearchInput] = useState('')
  const [clientByPhoneModal, setClientByPhoneModal] = useState<Client | null>(null)
  const [clientsPage, setClientsPage] = useState(1)
  const [clientsTotal, setClientsTotal] = useState(0)
  const [clientsTotalPages, setClientsTotalPages] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const INITIAL_VISIBLE_COUNT = 10
  const searchParams = useSearchParams()

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

  const loadData = useCallback(async (page = 1, append = false, apps?: any[], svcs?: any[], filters?: { search?: string; status?: string; segment?: string; sortBy?: string; sortOrder?: string }) => {
    if (!business) return
    const q = new URLSearchParams()
    q.set('businessId', business.id)
    q.set('page', String(page))
    q.set('limit', '50')
    if (filters?.search) q.set('search', filters.search)
    if (filters?.status && filters.status !== 'all') q.set('status', filters.status)
    if (filters?.segment && filters.segment !== 'all') q.set('segment', filters.segment)
    if (filters?.sortBy) q.set('sortBy', filters.sortBy)
    if (filters?.sortOrder) q.set('sortOrder', filters.sortOrder)
    try {
        if (page === 1) setLoading(true)
        else setLoadingMore(true)
        
        const [servicesRes, mastersRes, clientsRes, appointmentsRes] = await Promise.all([
          page === 1 ? fetch(`/api/services?businessId=${business.id}`) : Promise.resolve(null),
          page === 1 ? fetch(`/api/masters?businessId=${business.id}`) : Promise.resolve(null),
          fetch(`/api/clients?${q.toString()}`),
          page === 1 ? fetch(`/api/appointments?businessId=${business.id}`) : Promise.resolve(null),
        ])

        const servicesDataRaw = servicesRes ? await servicesRes.json() : null
        const mastersDataRaw = mastersRes ? await mastersRes.json() : null
        const clientsDataRaw = await clientsRes.json()
        const appointmentsDataRaw = appointmentsRes ? await appointmentsRes.json() : null

        const servicesData = Array.isArray(servicesDataRaw) ? servicesDataRaw : (servicesDataRaw ? [] : [])
        const mastersData = Array.isArray(mastersDataRaw) ? mastersDataRaw : (mastersDataRaw ? [] : [])
        const clientsPayload = clientsDataRaw?.clients != null ? clientsDataRaw.clients : (Array.isArray(clientsDataRaw) ? clientsDataRaw : [])
        const appointmentsData = Array.isArray(appointmentsDataRaw) ? appointmentsDataRaw : (appointmentsDataRaw ? [] : [])

        if (page === 1) {
          setServices(servicesData)
          setMasters(mastersData)
          setAppointments(appointmentsData)
        }
        if (clientsDataRaw?.total != null) {
          setClientsTotal(clientsDataRaw.total)
          setClientsTotalPages(clientsDataRaw.totalPages ?? 1)
          setClientsPage(clientsDataRaw.page ?? page)
        }
        
        const clientsData = Array.isArray(clientsPayload) ? clientsPayload : []
        const appointmentsForMerge = append && apps ? apps : appointmentsData
        const servicesForMerge = append && svcs ? svcs : servicesData
        
        const clientsWithStats = clientsData.map((client: any) => {
          const clientAppointments = appointmentsForMerge.filter(
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
                  const service = servicesForMerge.find((s: any) => s.id === serviceId || s.name === serviceId)
                  if (service) {
                    totalSpent += service.price || 0
                  }
                })
                
                // Додаємо customPrice (в БД зберігається в копійках)
                if (apt.customPrice) {
                  totalSpent += Number(apt.customPrice) / 100
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

        setClients((prev) => append ? [...prev, ...clientsWithStats] : clientsWithStats)
        setLoading(false)
        setLoadingMore(false)
      } catch (error) {
        console.error('Error loading data:', error)
        setLoading(false)
        setLoadingMore(false)
      }
  }, [business])

  useEffect(() => {
    if (!business) return
    const filters = { search: searchQuery, status: filterClientStatus, segment: filterSegment, sortBy, sortOrder }
    const t = setTimeout(() => {
      loadData(1, false, undefined, undefined, filters)
    }, searchQuery ? 400 : 100)
    return () => clearTimeout(t)
  }, [business, loadData, searchQuery, filterClientStatus, filterSegment, sortBy, sortOrder])

  // Якщо в URL є phone= або id= — автоматично відкрити вікно клієнта з історією
  useEffect(() => {
    if (!clients.length || loading) return
    const idFromUrl = searchParams.get('id')
    const phoneFromUrl = searchParams.get('phone')
    if (idFromUrl) {
      const found = clients.find((c) => c.id === idFromUrl)
      if (found) {
        setClientByPhoneModal(found)
        setPhoneSearchInput(found.phone)
      }
    } else if (phoneFromUrl) {
      const found = findClientByPhoneNumber(clients, phoneFromUrl)
      if (found) {
        setClientByPhoneModal(found)
        setPhoneSearchInput(found.phone)
      }
    }
  }, [clients, loading, searchParams])

  // Кешуємо деталі клієнта при відкритті модалки за номером
  useEffect(() => {
    if (!clientByPhoneModal) return
    setClientDetails((prev) => ({
      ...prev,
      [clientByPhoneModal.id]: calculateClientDetails(clientByPhoneModal),
    }))
  }, [clientByPhoneModal?.id])

  const handleOpenClientByPhone = () => {
    const found = findClientByPhoneNumber(clients, phoneSearchInput)
    if (found) {
      setClientByPhoneModal(found)
    } else {
      toast({
        title: 'Клієнта не знайдено',
        description: 'Перевірте номер телефону або додайте клієнта.',
        type: 'error',
      })
    }
  }

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
        
        // customPrice в БД зберігається в копійках
        if (apt.customPrice) {
          totalSpent += Number(apt.customPrice) / 100
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
    
    // customPrice в БД зберігається в копійках
    if (appointment.customPrice) {
      total += Number(appointment.customPrice) / 100
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
    const search = createdClient?.name || searchQuery
    if (createdClient?.name) setSearchQuery(createdClient.name)
    if (business) loadData(1, false, undefined, undefined, { search, status: filterClientStatus, segment: filterSegment, sortBy, sortOrder })
  }

  // Фільтрація та сортування на сервері — клієнти вже відфільтровані
  const filteredClients = clients

  const visibleClients = showAllClients 
    ? filteredClients 
    : filteredClients.slice(0, INITIAL_VISIBLE_COUNT)
  const hiddenClientsCount = filteredClients.length - visibleClients.length
  const allVisibleSelected =
    visibleClients.length > 0 && visibleClients.every((c) => selectedClients.has(c.id))

  const handleExportCSV = () => {
    const csvHeaders = ['Ім\'я', 'Телефон', 'Email', 'Статус', 'Кількість візитів', 'Зароблено', 'Останній візит', 'Наступний візит', 'Послуги', 'Примітки']
    const csvRows = filteredClients.map(client => {
      const details = clientDetails[client.id] || calculateClientDetails(client)
      const servicesList = details.servicesUsed.map(s => `${s.name} (${s.count})`).join('; ')
      return [
        client.name,
        client.phone,
        client.email || '',
        getClientStatusLabel(client.status),
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
                value={filterClientStatus}
                onChange={(e) => setFilterClientStatus(e.target.value)}
                className="px-3 py-2 text-sm border border-white/20 rounded-lg bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <option value="all">Всі статуси</option>
                <option value="new">Новий</option>
                <option value="regular">Постійний</option>
                <option value="vip">VIP</option>
                <option value="inactive">Неактивний</option>
              </select>
              <select
                value={filterSegment}
                onChange={(e) => setFilterSegment(e.target.value)}
                className="px-3 py-2 text-sm border border-white/20 rounded-lg bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <option value="all">Всі клієнти</option>
                <option value="vip">VIP (по витратах)</option>
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
            {/* Пошук клієнта за номером телефону — відкриває вікно з історією */}
            <div className="mt-3 pt-3 border-t border-white/10 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <span className="text-sm text-gray-400 flex items-center gap-1.5">
                <PhoneIcon className="w-4 h-4" />
                Знайти клієнта за номером
              </span>
              <div className="flex-1 flex gap-2 min-w-0">
                <input
                  type="tel"
                  placeholder="+38 050 123 45 67"
                  value={phoneSearchInput}
                  onChange={(e) => setPhoneSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleOpenClientByPhone()}
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
                <button
                  onClick={handleOpenClientByPhone}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-colors flex-shrink-0"
                >
                  Відкрити
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
                      if (c) router.push(`/dashboard/appointments?create=true&clientPhone=${encodeURIComponent(c.phone)}&clientName=${encodeURIComponent(c.name || '')}`)
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
                    <th className="text-left p-3 font-semibold text-white">Статус</th>
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
                        <td className="p-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border', getClientStatusBadgeClass(client.status))}>
                            {getClientStatusLabel(client.status)}
                          </span>
                        </td>
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
                            <button onClick={() => router.push(`/dashboard/appointments?create=true&clientPhone=${encodeURIComponent(client.phone)}&clientName=${encodeURIComponent(client.name || '')}`)} className="p-1.5 text-green-400 hover:bg-white/10 rounded-lg transition-colors" title="Записати"><CalendarIcon className="w-4 h-4" /></button>
                            <button onClick={() => handleEditClient(client)} className="touch-target min-h-[44px] min-w-[44px] p-2 text-gray-300 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center" title="Редагувати" aria-label="Редагувати"><SettingsIcon className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteClient(client.id)} className="touch-target min-h-[44px] min-w-[44px] p-2 text-red-400 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center" title="Видалити" aria-label="Видалити"><XIcon className="w-4 h-4" /></button>
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
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <h3 className="text-sm font-semibold text-white truncate">
                            {client.name}
                          </h3>
                          <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0', getClientStatusBadgeClass(client.status))}>
                            {getClientStatusLabel(client.status)}
                          </span>
                        </div>
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
                        <button onClick={() => router.push(`/dashboard/appointments?create=true&clientPhone=${encodeURIComponent(client.phone)}&clientName=${encodeURIComponent(client.name || '')}`)} className="p-1.5 text-green-400 hover:bg-white/10 rounded-lg transition-colors" title="Записати"><CalendarIcon className="w-4 h-4" /></button>
                        <button onClick={() => handleEditClient(client)} className="touch-target min-h-[44px] min-w-[44px] p-2 text-gray-300 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center" title="Редагувати" aria-label="Редагувати"><SettingsIcon className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteClient(client.id)} className="touch-target min-h-[44px] min-w-[44px] p-2 text-red-400 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center" title="Видалити" aria-label="Видалити"><XIcon className="w-4 h-4" /></button>
                        <button onClick={() => handleClientClick(client)} className="p-1.5 text-gray-400 hover:bg-white/10 rounded-lg transition-colors">
                          {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-white/10 space-y-4">
                    {details ? (
                      <>
                        {/* Блок: підсумок клієнта + примітки + теги */}
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
                                  <span key={`${tag}-${idx}`} className="px-2 py-1 text-[10px] font-semibold rounded-full bg-white/10 text-white border border-white/10">{tag}</span>
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

                        {/* Картка: Історія клієнта — окрема картка для кращого відображення */}
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                          <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-emerald-400" />
                                Історія клієнта
                              </h4>
                              <span className="text-xs text-gray-400">
                                {client.appointments.length} візитів · {Math.round(details.totalSpent)} грн за весь час
                              </span>
                            </div>
                            <button
                              onClick={() => router.push(`/dashboard/appointments?create=true&clientPhone=${encodeURIComponent(client.phone)}&clientName=${encodeURIComponent(client.name || '')}`)}
                              className="px-3 py-2 text-sm font-semibold bg-white text-black rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0 flex items-center gap-2 touch-target"
                              style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}
                              title="Записати клієнта на прийом"
                            >
                              <CalendarIcon className="w-4 h-4" />
                              Записати
                            </button>
                          </div>
                          <div className="p-4 space-y-3">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <div className="flex-1 relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                <input
                                  type="text"
                                  value={historySearchQuery}
                                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                                  placeholder="Пошук (послуга, майстер, нотатки...)"
                                  className="w-full pl-9 pr-3 py-2 text-xs border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30"
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
                                {historySortOrder === 'desc' ? 'Нові ↓' : 'Старі ↑'}
                              </button>
                            </div>

                            <div className="relative max-h-[380px] overflow-y-auto">
                              {/* Таймлайн: вертикальна лінія зліва */}
                              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/10 rounded-full" aria-hidden />
                              <div className="space-y-0 relative">
                                {(() => {
                                  const q = historySearchQuery.trim().toLowerCase()
                                  const filtered = (client.appointments || [])
                                    .filter((apt: any) => (historyStatus === 'all' || normalizeStatusKey(apt.status) === historyStatus))
                                    .filter((apt: any) => {
                                      if (!q) return true
                                      const masterName = masters.find((m) => m.id === apt.masterId)?.name || ''
                                      const servicesText = getAppointmentServices(apt)
                                        .map((serviceId) => services.find((s) => s.id === serviceId || s.name === serviceId)?.name || serviceId)
                                        .join(' ')
                                      const dateText = (() => {
                                        try {
                                          const d = new Date(apt.startTime)
                                          return Number.isFinite(d.getTime()) ? format(d, 'dd.MM.yyyy HH:mm') : ''
                                        } catch { return '' }
                                      })()
                                      const hay = [apt.clientName, apt.clientPhone, apt.notes || '', masterName, servicesText, getStatusLabel(apt.status), dateText].join(' ').toLowerCase()
                                      return hay.includes(q)
                                    })
                                    .sort((a: any, b: any) => {
                                      const aT = new Date(a.startTime).getTime()
                                      const bT = new Date(b.startTime).getTime()
                                      return historySortOrder === 'desc' ? bT - aT : aT - bT
                                    })

                                  if (filtered.length === 0) {
                                    return (
                                      <div className="py-8 text-center text-xs text-gray-400 rounded-lg border border-dashed border-white/10 bg-white/5">
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
                                        className="relative pl-8 pr-3 py-3 group"
                                      >
                                        <div className="absolute left-0 top-5 w-3 h-3 rounded-full bg-white/30 border-2 border-[#2A2A2A] group-hover:bg-emerald-400/80 transition-colors" aria-hidden />
                                        <div className="p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/[0.08] hover:border-white/20 transition-all">
                                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                <span className="text-xs font-semibold text-white">{format(start, 'dd.MM.yyyy')}</span>
                                                <span className="text-xs text-gray-400 tabular-nums">{format(start, 'HH:mm')}–{format(end, 'HH:mm')}</span>
                                                <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-medium border', getStatusColor(appointment.status))}>
                                                  {getStatusLabel(appointment.status)}
                                                </span>
                                              </div>
                                              {master && <p className="text-[10px] text-gray-400 mb-1.5">Спеціаліст: {master.name}</p>}
                                              {servicesList.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                  {servicesList.map((serviceId, idx) => {
                                                    const service = services.find((s) => s.id === serviceId || s.name === serviceId)
                                                    return (
                                                      <span key={idx} className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-white/10 text-pink-400/90 border border-white/10">
                                                        {service?.name || serviceId} {service ? `· ${Math.round(service.price)} грн` : ''}
                                                      </span>
                                                    )
                                                  })}
                                                </div>
                                              )}
                                              {appointment.notes && <p className="text-[10px] text-gray-500 italic mt-1.5">{appointment.notes}</p>}
                                            </div>
                                            {total > 0 && (
                                              <div className="text-sm font-semibold text-purple-400 flex-shrink-0 sm:text-right">
                                                {Math.round(total)} грн
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
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
            
              {(filteredClients.length > INITIAL_VISIBLE_COUNT || (clientsTotal > clients.length && !loading)) && (
                <div className="flex flex-col items-center gap-2 pt-2">
                  {clientsTotal > clients.length && (
                    <button
                      onClick={() => loadData(clientsPage + 1, true, appointments, services, { search: searchQuery, status: filterClientStatus, segment: filterSegment, sortBy, sortOrder })}
                      disabled={loadingMore}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {loadingMore ? 'Завантаження...' : `Завантажити ще (${clients.length} з ${clientsTotal})`}
                    </button>
                  )}
                  {filteredClients.length > INITIAL_VISIBLE_COUNT && (
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
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-3 md:space-y-6">
          <div className="rounded-xl p-4 md:p-6 card-glass">
            <div className="mb-3 md:mb-4">
              <h3 className="text-base md:text-lg font-semibold text-white" style={{ letterSpacing: '-0.01em' }}>Статистика</h3>
              <p className="text-xs text-gray-500 mt-0.5">За поточними фільтрами</p>
            </div>
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">Всього</span>
                <span className="text-sm font-semibold text-white">{stats.total}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">VIP</span>
                <span className="text-sm font-semibold text-purple-400">{stats.vip}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">Активні</span>
                <span className="text-sm font-semibold text-green-400">{stats.active}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">Неактивні</span>
                <span className="text-sm font-semibold text-orange-400">{stats.inactive}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">Дохід</span>
                <span className="text-sm font-semibold text-blue-400">{Math.round(stats.totalRevenue)} грн</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">Середній чек</span>
                <span className="text-sm font-semibold text-pink-400">{Math.round(stats.avgRevenue)} грн</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl p-4 md:p-6 card-glass">
            <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4" style={{ letterSpacing: '-0.01em' }}>Швидкі дії</h3>
            <div className="space-y-2">
              <button
                onClick={() => { setEditingClient(null); setShowQuickClientCard(true) }}
                className="w-full px-3 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98] text-left"
                style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
              >
                + Додати клієнта
              </button>
              <button
                onClick={() => router.push('/dashboard/appointments')}
                className="w-full px-3 py-2 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-colors text-left"
              >
                Записи
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Вікно клієнта за номером телефону — історія візитів (єдиний стиль модалок) */}
      {clientByPhoneModal && (
        <ModalPortal>
          <div
            className="modal-overlay sm:!p-4"
            onClick={() => setClientByPhoneModal(null)}
          >
            <div
              className="relative w-[95%] sm:w-full sm:max-w-2xl sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setClientByPhoneModal(null)}
                className="modal-close text-gray-400 hover:text-white rounded-full"
                aria-label="Закрити"
              >
                <XIcon className="w-5 h-5" />
              </button>
              <div className="modal-header-row">
                <div className="min-w-0 flex-1">
                  <h2 className="modal-title truncate">{clientByPhoneModal.name}</h2>
                  <p className="modal-subtitle flex items-center gap-1.5">
                    <PhoneIcon className="w-4 h-4 flex-shrink-0 opacity-70" />
                    {clientByPhoneModal.phone}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => window.open(`tel:${clientByPhoneModal.phone}`)}
                    className="modal-action-btn"
                    title="Дзвінок"
                  >
                    <PhoneIcon className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClientByPhoneModal(null)
                      handleEditClient(clientByPhoneModal)
                    }}
                    className="modal-action-btn"
                    title="Редагувати"
                  >
                    <SettingsIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
                {(() => {
                  const details = clientDetails[clientByPhoneModal.id] ?? calculateClientDetails(clientByPhoneModal)
                  return (
                    <>
                      <div className="modal-summary-panels">
                        <div className="modal-summary-panel">
                          <div className="modal-summary-panel-label">Зароблено</div>
                          <div className="modal-summary-panel-value modal-value-money">{Math.round(details.totalSpent)} грн</div>
                        </div>
                        <div className="modal-summary-panel">
                          <div className="modal-summary-panel-label">Останній візит</div>
                          <div className="modal-summary-panel-value modal-value-date">{format(new Date(details.lastVisit), 'dd.MM.yyyy')}</div>
                        </div>
                        <div className="modal-summary-panel">
                          <div className="modal-summary-panel-label">Наступний</div>
                          <div className="modal-summary-panel-value">
                            {details.nextAppointment ? format(new Date(details.nextAppointment), 'dd.MM.yyyy') : '—'}
                          </div>
                        </div>
                      </div>
                      <div className="modal-section">
                        <div className="modal-section-header">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h4 className="modal-section-title-with-icon">
                              <CalendarIcon className="w-4 h-4 text-emerald-400" />
                              Історія візитів
                            </h4>
                            <span className="modal-section-subtitle">
                              {clientByPhoneModal.appointments.length} візитів · {Math.round(details.totalSpent)} грн
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setClientByPhoneModal(null)
                              router.push(`/dashboard/appointments?create=true&clientPhone=${encodeURIComponent(clientByPhoneModal.phone)}&clientName=${encodeURIComponent(clientByPhoneModal.name || '')}`)
                            }}
                            className="px-3 py-2 text-sm font-semibold rounded-xl modal-value-cta hover:opacity-90 transition-opacity flex-shrink-0 flex items-center gap-2"
                          >
                            <CalendarIcon className="w-4 h-4" />
                            Записати
                          </button>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="flex-1 relative">
                              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                              <input
                                type="text"
                                value={historySearchQuery}
                                onChange={(e) => setHistorySearchQuery(e.target.value)}
                                placeholder="Пошук (послуга, майстер...)"
                                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30"
                              />
                            </div>
                            <select
                              value={historyStatus}
                              onChange={(e) => setHistoryStatus(e.target.value)}
                              className="px-3 py-2.5 text-sm rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                            >
                              <option value="all">Всі</option>
                              <option value="Pending">Очікує</option>
                              <option value="Confirmed">Підтверджено</option>
                              <option value="Done">Виконано</option>
                              <option value="Cancelled">Скасовано</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => setHistorySortOrder(historySortOrder === 'desc' ? 'asc' : 'desc')}
                              className="px-3 py-2.5 text-sm rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/15 font-medium transition-colors"
                            >
                              {historySortOrder === 'desc' ? 'Нові ↓' : 'Старі ↑'}
                            </button>
                          </div>
                          <div className="relative max-h-[320px] overflow-y-auto">
                            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/10 rounded-full" aria-hidden />
                            <div className="space-y-2 relative pl-6">
                              {(() => {
                                const q = historySearchQuery.trim().toLowerCase()
                                const filtered = (clientByPhoneModal.appointments || [])
                                  .filter((apt: any) => (historyStatus === 'all' || normalizeStatusKey(apt.status) === historyStatus))
                                  .filter((apt: any) => {
                                    if (!q) return true
                                    const masterName = masters.find((m) => m.id === apt.masterId)?.name || ''
                                    const servicesText = getAppointmentServices(apt)
                                      .map((serviceId) => services.find((s) => s.id === serviceId || s.name === serviceId)?.name || serviceId)
                                      .join(' ')
                                    const hay = [apt.clientName, apt.clientPhone, apt.notes || '', masterName, servicesText, getStatusLabel(apt.status)].join(' ').toLowerCase()
                                    return hay.includes(q)
                                  })
                                  .sort((a: any, b: any) => {
                                    const aT = new Date(a.startTime).getTime()
                                    const bT = new Date(b.startTime).getTime()
                                    return historySortOrder === 'desc' ? bT - aT : aT - bT
                                  })
                                if (filtered.length === 0) {
                                  return (
                                    <div className="py-6 text-center text-sm text-gray-400 rounded-xl border border-dashed border-white/10 bg-white/5">
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
                                    <div key={appointment.id} className="relative group">
                                      <div className="absolute -left-6 top-5 w-3 h-3 rounded-full bg-white/30 border-2 border-[var(--modal-dialog-bg)] group-hover:bg-emerald-400/80 transition-colors" aria-hidden />
                                      <div className="modal-list-card">
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                          <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                              <span className="text-sm font-semibold text-white">{format(start, 'dd.MM.yyyy')}</span>
                                              <span className="text-xs text-gray-400 tabular-nums">{format(start, 'HH:mm')}–{format(end, 'HH:mm')}</span>
                                              <span className={cn('px-2 py-0.5 rounded-lg text-xs font-medium', getStatusColor(appointment.status))}>
                                                {getStatusLabel(appointment.status)}
                                              </span>
                                            </div>
                                            {master && <p className="text-xs text-gray-400 mb-1.5">Спеціаліст: {master.name}</p>}
                                            {servicesList.length > 0 && (
                                              <div className="flex flex-wrap gap-1">
                                                {servicesList.map((serviceId, idx) => {
                                                  const service = services.find((s) => s.id === serviceId || s.name === serviceId)
                                                  return (
                                                    <span key={idx} className="px-2 py-0.5 text-xs font-medium rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                      {service?.name || serviceId} {service ? `· ${Math.round(service.price)} грн` : ''}
                                                    </span>
                                                  )
                                                })}
                                              </div>
                                            )}
                                            {appointment.notes && <p className="text-xs text-gray-500 italic mt-1.5">{appointment.notes}</p>}
                                          </div>
                                          {total > 0 && (
                                            <div className="text-sm font-semibold modal-value-money flex-shrink-0 sm:text-right">{Math.round(total)} грн</div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

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

'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, differenceInDays } from 'date-fns'
import { uk } from 'date-fns/locale'
import { cn, fixMojibake } from '@/lib/utils'
import { UserIcon, SearchIcon, DownloadIcon, FilterIcon, CheckIcon, CalendarIcon, PhoneIcon, SettingsIcon, XIcon, StarIcon, MoneyIcon, UsersIcon, ChevronDownIcon, ChevronUpIcon, EditIcon, TrashIcon } from '@/components/icons'
import { QuickMasterCard } from '@/components/admin/QuickMasterCard'
import { DateRangePicker } from '@/components/admin/DateRangePicker'
import { toast } from '@/components/ui/toast'
import { getBusinessData } from '@/lib/business-storage'

const MasterScheduleModal = dynamic(
  () => import('@/components/admin/MasterScheduleModal').then((m) => ({ default: m.MasterScheduleModal })),
  { ssr: false }
)

interface Master {
  id: string
  name: string
  photo?: string | null
  bio?: string | null
  rating: number
  isActive: boolean
  workingHours?: string | null
  scheduleDateOverrides?: string | null
  totalAppointments?: number
  totalRevenue?: number
  averageRating?: number
  utilizationRate?: number
  createdAt?: string
  updatedAt?: string
}

interface MasterStats {
  visits: number
  earned: number
  reviews: number
  clients: number
  services: number
  appointments: any[]
  recentAppointments: any[]
  utilizationRate: number
  averageOrderValue: number
}

export default function MastersPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/schedule')
  }, [router])

  const [business, setBusiness] = useState<any>(null)
  const [masters, setMasters] = useState<Master[]>([])
  const [services, setServices] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedMaster, setExpandedMaster] = useState<string | null>(null)
  const [masterStats, setMasterStats] = useState<Record<string, MasterStats>>({})
  const [filterStatus, setFilterStatus] = useState<string>('all') // all, active, inactive
  const [sortBy, setSortBy] = useState<string>('name') // name, visits, earned, rating
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedMasters, setSelectedMasters] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [showQuickMasterCard, setShowQuickMasterCard] = useState(false)
  const [editingMaster, setEditingMaster] = useState<Master | null>(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedMasterForSchedule, setSelectedMasterForSchedule] = useState<Master | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dateFilterStart, setDateFilterStart] = useState<Date | null>(null)
  const [dateFilterEnd, setDateFilterEnd] = useState<Date | null>(null)

  useEffect(() => {
    const businessData = getBusinessData()
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
        
        const [mastersRes, servicesRes, appointmentsRes] = await Promise.all([
          fetch(`/api/masters?businessId=${business.id}`),
          fetch(`/api/services?businessId=${business.id}`),
          fetch(`/api/appointments?businessId=${business.id}`),
        ])

        const [mastersData, servicesData, appointmentsData] = await Promise.all([
          mastersRes.json(),
          servicesRes.json(),
          appointmentsRes.json(),
        ])

        setServices(servicesData || [])
        setAppointments(appointmentsData || [])
        
        // Об'єднуємо дані спеціалістів з appointments для розрахунку статистики
        const mastersWithStats = (mastersData || []).map((master: any) => {
          const masterAppointments = (appointmentsData || []).filter(
            (apt: any) => apt.masterId === master.id
          )
          
          // Розраховуємо totalRevenue з виконаних записів
          let totalRevenue = 0
          const completedAppointments = masterAppointments.filter((apt: any) => apt.status === 'Done')
          
          completedAppointments.forEach((apt: any) => {
            try {
              const aptServices = typeof apt.services === 'string' 
                ? JSON.parse(apt.services) 
                : apt.services || []
              
              aptServices.forEach((serviceId: string) => {
                const service = servicesData.find((s: any) => s.id === serviceId || s.name === serviceId)
                if (service) {
                  totalRevenue += service.price || 0
                }
              })
              
              // customPrice в БД зберігається в копійках
              if (apt.customPrice) {
                totalRevenue += Number(apt.customPrice) / 100
              }
            } catch (e) {
              // Ignore
            }
          })

          // Розраховуємо унікальних клієнтів
          const uniqueClients = new Set(masterAppointments.map((apt: any) => apt.clientPhone))
          
          // Розраховуємо унікальні послуги
          const uniqueServices = new Set()
          masterAppointments.forEach((apt: any) => {
            try {
              const aptServices = typeof apt.services === 'string' 
                ? JSON.parse(apt.services) 
                : apt.services || []
              aptServices.forEach((serviceId: string) => {
                uniqueServices.add(serviceId)
              })
            } catch (e) {
              // Ignore
            }
          })

          // Розраховуємо utilization rate (спрощено - відсоток заповненості)
          const totalDays = 30 // За останні 30 днів
          const workingDays = masterAppointments.filter((apt: any) => {
            const aptDate = new Date(apt.startTime)
            const daysAgo = differenceInDays(new Date(), aptDate)
            return daysAgo <= totalDays
          }).length
          const utilizationRate = totalDays > 0 ? (workingDays / totalDays) * 100 : 0

          return {
            ...master,
            totalAppointments: masterAppointments.length,
            totalRevenue: totalRevenue || 0,
            averageRating: master.rating || 0,
            utilizationRate: Math.min(100, utilizationRate),
          }
        })

        setMasters(mastersWithStats)
        setLoading(false)
      } catch (error) {
        console.error('Error loading data:', error)
        setLoading(false)
      }
    }

    loadData()
  }, [business])

  useEffect(() => {
    if (!Array.isArray(masters) || masters.length === 0) return

    masters.forEach((master) => {
      const masterAppointments = appointments.filter((apt: any) => apt.masterId === master.id)
      const completedAppointments = masterAppointments.filter((apt: any) => apt.status === 'Done')
      
      // Розраховуємо статистику
      let earned = 0
      completedAppointments.forEach((apt: any) => {
        try {
          const aptServices = typeof apt.services === 'string' 
            ? JSON.parse(apt.services) 
            : apt.services || []
          
          aptServices.forEach((serviceId: string) => {
            const service = services.find((s: any) => s.id === serviceId || s.name === serviceId)
            if (service) {
              earned += service.price || 0
            }
          })
          
          // customPrice в БД зберігається в копійках
          if (apt.customPrice) {
            earned += Number(apt.customPrice) / 100
          }
        } catch (e) {
          // Ignore
        }
      })

      const uniqueClients = new Set(masterAppointments.map((apt: any) => apt.clientPhone))
      const uniqueServices = new Set()
      masterAppointments.forEach((apt: any) => {
        try {
          const aptServices = typeof apt.services === 'string' 
            ? JSON.parse(apt.services) 
            : apt.services || []
          aptServices.forEach((serviceId: string) => {
            uniqueServices.add(serviceId)
          })
        } catch (e) {
          // Ignore
        }
      })

      const averageOrderValue = completedAppointments.length > 0 
        ? earned / completedAppointments.length 
        : 0

      setMasterStats((prev) => ({
        ...prev,
        [master.id]: {
          visits: masterAppointments.length,
          earned,
          reviews: 0, // Поки немає системи відгуків
          clients: uniqueClients.size,
          services: uniqueServices.size,
          appointments: masterAppointments,
          recentAppointments: masterAppointments
            .sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
            .slice(0, 5),
          utilizationRate: master.utilizationRate || 0,
          averageOrderValue,
        },
      }))
    })
  }, [masters, appointments, services])

  const handleDeleteMaster = async (masterId: string) => {
    if (!confirm('Ви впевнені, що хочете видалити цього спеціаліста? Цю дію неможливо скасувати.')) {
      return
    }

    try {
      const response = await fetch(`/api/masters/${masterId}?businessId=${business.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Не вдалося видалити спеціаліста')
      }

      toast({ title: 'Спеціаліста видалено', type: 'success' })
      setMasters((prev) => prev.filter((m) => m.id !== masterId))
      setExpandedMaster(null)
    } catch (error) {
      console.error('Error deleting master:', error)
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося видалити спеціаліста',
        type: 'error',
      })
    }
  }

  const handleEditMaster = (master: Master) => {
    setEditingMaster(master)
    setShowQuickMasterCard(true)
  }

  const handleMasterCreated = () => {
    setShowQuickMasterCard(false)
    setEditingMaster(null)
    // Перезавантажуємо дані
    if (business) {
      fetch(`/api/masters?businessId=${business.id}`)
        .then((res) => res.json())
        .then((data) => {
          const mastersWithStats = (data || []).map((master: any) => {
            const masterAppointments = appointments.filter(
              (apt: any) => apt.masterId === master.id
            )
            
            let totalRevenue = 0
            const completedAppointments = masterAppointments.filter((apt: any) => apt.status === 'Done')
            
            completedAppointments.forEach((apt: any) => {
              try {
                const aptServices = typeof apt.services === 'string' 
                  ? JSON.parse(apt.services) 
                  : apt.services || []
                
                aptServices.forEach((serviceId: string) => {
                  const service = services.find((s: any) => s.id === serviceId || s.name === serviceId)
                  if (service) {
                    totalRevenue += service.price || 0
                  }
                })
                
                // customPrice в БД зберігається в копійках
                if (apt.customPrice) {
                  totalRevenue += Number(apt.customPrice) / 100
                }
              } catch (e) {
                // Ignore
              }
            })

            const totalDays = 30
            const workingDays = masterAppointments.filter((apt: any) => {
              const aptDate = new Date(apt.startTime)
              const daysAgo = differenceInDays(new Date(), aptDate)
              return daysAgo <= totalDays
            }).length
            const utilizationRate = totalDays > 0 ? (workingDays / totalDays) * 100 : 0

            return {
              ...master,
              totalAppointments: masterAppointments.length,
              totalRevenue,
              averageRating: master.rating || 0,
              utilizationRate: Math.min(100, utilizationRate),
            }
          })
          setMasters(mastersWithStats)
        })
    }
  }

  const handleToggleActive = async (masterId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/masters/${masterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id, isActive }),
      })

      if (!response.ok) {
        throw new Error('Не вдалося оновити статус')
      }

      setMasters((prev) =>
        prev.map((m) => (m.id === masterId ? { ...m, isActive } : m))
      )
      toast({ title: 'Статус оновлено', type: 'success' })
    } catch (error) {
      console.error('Failed to update master status:', error)
      toast({
        title: 'Помилка',
        description: 'Не вдалося оновити статус спеціаліста',
        type: 'error',
      })
    }
  }

  const filteredMasters = masters
    .filter((master) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesName = master.name.toLowerCase().includes(query)
        const matchesBio = master.bio?.toLowerCase().includes(query) || false
        if (!matchesName && !matchesBio) return false
      }

      // Status filter
      if (filterStatus !== 'all') {
        if (filterStatus === 'active' && !master.isActive) return false
        if (filterStatus === 'inactive' && master.isActive) return false
      }

      // Date filter - фільтруємо по записах спеціаліста
      if (dateFilterStart && dateFilterEnd) {
        const masterAppointments = appointments.filter((apt: any) => apt.masterId === master.id)
        const start = new Date(dateFilterStart)
        start.setHours(0, 0, 0, 0)
        const end = new Date(dateFilterEnd)
        end.setHours(23, 59, 59, 999)

        const hasAppointmentsInPeriod = masterAppointments.some((apt: any) => {
          const aptDate = new Date(apt.startTime)
          return aptDate >= start && aptDate <= end
        })

        if (!hasAppointmentsInPeriod) return false
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
          comparison = (a.totalAppointments ?? 0) - (b.totalAppointments ?? 0)
          break
        case 'earned':
          comparison = (a.totalRevenue ?? 0) - (b.totalRevenue ?? 0)
          break
        case 'rating':
          comparison = (a.averageRating ?? 0) - (b.averageRating ?? 0)
          break
        default:
          comparison = 0
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

  const handleExportCSV = () => {
    const csvHeaders = ['Ім\'я', 'Рейтинг', 'Статус', 'Візити', 'Зароблено', 'Клієнти', 'Послуги', 'Завантаженість %']
    const csvRows = filteredMasters.map(master => {
      const stats = masterStats[master.id] || {
        visits: 0,
        earned: 0,
        clients: 0,
        services: 0,
        utilizationRate: 0,
      }
      return [
        master.name,
        (master.averageRating ?? 0).toFixed(1),
        master.isActive ? 'Активний' : 'Неактивний',
        master.totalAppointments ?? 0,
        Math.round(stats.earned),
        stats.clients,
        stats.services,
        Math.round(stats.utilizationRate),
      ]
    })
    
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `спеціалісти_${format(new Date(), 'dd_MM_yyyy')}.csv`
    link.click()
  }

  const toggleSelectMaster = (id: string) => {
    setSelectedMasters(prev => {
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
    if (selectedMasters.size === filteredMasters.length) {
      setSelectedMasters(new Set())
    } else {
      setSelectedMasters(new Set(filteredMasters.map(m => m.id)))
    }
  }

  // Calculate statistics
  const stats = {
    total: filteredMasters.length,
    active: filteredMasters.filter(m => m.isActive).length,
    inactive: filteredMasters.filter(m => !m.isActive).length,
    totalRevenue: filteredMasters.reduce((sum, m) => {
      const masterStatsData = masterStats[m.id]
      return sum + (masterStatsData?.earned || 0)
    }, 0),
    totalAppointments: filteredMasters.reduce((sum, m) => sum + (m.totalAppointments ?? 0), 0),
    avgRating: filteredMasters.length > 0
      ? filteredMasters.reduce((sum, m) => sum + (m.averageRating ?? 0), 0) / filteredMasters.length
      : 0,
  }

  if (!business || loading) {
    return (
      <div className="w-full max-w-7xl mx-auto min-w-0 overflow-hidden">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-dashboard-main lg:grid-cols-dashboard-main-lg gap-3 md:gap-6 min-w-0 w-full">
          <div className="space-y-4 min-w-0 overflow-hidden">
            <div className="h-64 rounded-xl card-glass animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl card-glass animate-pulse" />
              ))}
            </div>
          </div>
          <div className="dashboard-sidebar-col space-y-4 flex flex-col min-w-0 w-full max-w-full overflow-hidden">
            <div className="h-48 rounded-xl card-glass animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto min-w-0 overflow-hidden">
      <div className="grid grid-cols-dashboard-main lg:grid-cols-dashboard-main-lg gap-3 md:gap-6 min-w-0 w-full">
        {/* Main Content */}
        <div className="space-y-3 md:space-y-6 min-w-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
              Спеціалісти
            </h1>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  setEditingMaster(null)
                  setShowQuickMasterCard(true)
                }}
                className="px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98] flex items-center gap-2"
                style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
              >
                <UserIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Додати спеціаліста</span>
                <span className="sm:hidden">Додати</span>
              </button>
              <button
                onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
                className="px-3 py-2 border border-white/20 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors hidden sm:flex items-center gap-2"
              >
                {viewMode === 'cards' ? '📊 Таблиця' : '📋 Картки'}
              </button>
              <button
                onClick={handleExportCSV}
                className="px-3 py-2 border border-white/20 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors flex items-center gap-2"
              >
                <DownloadIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Експорт</span>
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="rounded-xl p-4 md:p-6 card-glass">
            <h3 className="text-base md:text-lg font-semibold text-white mb-4" style={{ letterSpacing: '-0.01em' }}>
              Статистика
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4 text-center">
                <div className="text-[10px] sm:text-xs text-gray-400 mb-1">Всього</div>
                <div className="text-sm md:text-base font-semibold text-white">{stats.total}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4 text-center">
                <div className="text-[10px] sm:text-xs text-gray-400 mb-1">Активні</div>
                <div className="text-sm md:text-base font-semibold text-green-400">{stats.active}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4 text-center">
                <div className="text-[10px] sm:text-xs text-gray-400 mb-1">Неактивні</div>
                <div className="text-sm md:text-base font-semibold text-orange-400">{stats.inactive}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4 text-center">
                <div className="text-[10px] sm:text-xs text-gray-400 mb-1">Візити</div>
                <div className="text-sm md:text-base font-semibold text-blue-400">{stats.totalAppointments}</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4 text-center">
                <div className="text-[10px] sm:text-xs text-gray-400 mb-1">Дохід</div>
                <div className="text-sm md:text-base font-semibold text-purple-400">{Math.round(stats.totalRevenue)} грн</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4 text-center">
                <div className="text-[10px] sm:text-xs text-gray-400 mb-1">Рейтинг</div>
                <div className="text-sm md:text-base font-semibold text-white">{stats.avgRating.toFixed(1)}</div>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="rounded-xl p-4 md:p-6 card-glass">
            <div className="flex flex-col gap-3 md:gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Пошук за ім'ям або описом..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-white/20 rounded-lg bg-white/5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </div>
              
              {/* Filters Row */}
              <div className="flex flex-wrap gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 text-sm border border-white/20 rounded-lg bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  <option value="all">Всі</option>
                  <option value="active">Активні</option>
                  <option value="inactive">Неактивні</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 text-sm border border-white/20 rounded-lg bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  <option value="name">Ім'я</option>
                  <option value="visits">Візити</option>
                  <option value="earned">Заробіток</option>
                  <option value="rating">Рейтинг</option>
                </select>

                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 text-sm border border-white/20 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-colors min-w-[44px]"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>

                <button
                  onClick={() => setShowDatePicker(true)}
                  className="px-3 py-2 text-sm border border-white/20 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  <CalendarIcon className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {dateFilterStart && dateFilterEnd
                      ? `${format(dateFilterStart, 'dd.MM')} - ${format(dateFilterEnd, 'dd.MM')}`
                      : 'Період'}
                  </span>
                </button>
                {dateFilterStart && dateFilterEnd && (
                  <button
                    onClick={() => {
                      setDateFilterStart(null)
                      setDateFilterEnd(null)
                    }}
                    className="px-3 py-2 text-sm border border-white/20 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-colors"
                    title="Очистити фільтр"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedMasters.size > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3 flex-wrap">
                <span className="text-sm text-gray-400">
                  Вибрано: {selectedMasters.size}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      selectedMasters.forEach(id => {
                        const master = masters.find(m => m.id === id)
                        if (master) handleToggleActive(id, true)
                      })
                      setSelectedMasters(new Set())
                    }}
                    className="px-3 py-1.5 text-xs border border-white/20 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
                  >
                    Активувати
                  </button>
                  <button
                    onClick={() => {
                      selectedMasters.forEach(id => {
                        const master = masters.find(m => m.id === id)
                        if (master) handleToggleActive(id, false)
                      })
                      setSelectedMasters(new Set())
                    }}
                    className="px-3 py-1.5 text-xs border border-white/20 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
                  >
                    Деактивувати
                  </button>
                  <button
                    onClick={() => setSelectedMasters(new Set())}
                    className="px-3 py-1.5 text-xs border border-white/20 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
                  >
                    Скасувати вибір
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Masters List */}
          {filteredMasters.length === 0 ? (
            <div className="rounded-xl p-4 md:p-6 card-glass text-center">
              <div className="mb-4 flex justify-center">
                <div className="w-16 h-16 md:w-20 md:h-20 bg-white/5 border border-white/10 rounded-full flex items-center justify-center">
                  <UserIcon className="w-8 h-8 md:w-10 md:h-10 text-gray-400" />
                </div>
              </div>
              <h3 className="text-base md:text-lg font-semibold text-white mb-2" style={{ letterSpacing: '-0.01em' }}>
                {searchQuery ? "Спеціалістів не знайдено" : "Немає спеціалістів"}
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                {searchQuery ? "Спробуйте інший пошуковий запит" : "Додайте першого спеціаліста, щоб почати працювати"}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => {
                    setEditingMaster(null)
                    setShowQuickMasterCard(true)
                  }}
                  className="px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98]"
                  style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
                >
                  Додати першого спеціаліста
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {viewMode === 'table' && typeof window !== 'undefined' && window.innerWidth >= 768 && (
                <div className="rounded-xl p-4 md:p-6 card-glass overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-3">
                          <button
                            onClick={toggleSelectAll}
                            className="w-4 h-4 rounded border-2 border-white/30 flex items-center justify-center hover:border-white/50 transition-colors"
                          >
                            {selectedMasters.size === filteredMasters.length && filteredMasters.length > 0 && (
                              <CheckIcon className="w-3 h-3 text-white" />
                            )}
                          </button>
                        </th>
                        <th className="text-left p-3 font-semibold text-white">Ім'я</th>
                        <th className="text-center p-3 font-semibold text-white">Рейтинг</th>
                        <th className="text-center p-3 font-semibold text-white">Статус</th>
                        <th className="text-center p-3 font-semibold text-white">Візити</th>
                        <th className="text-right p-3 font-semibold text-white">Зароблено</th>
                        <th className="text-center p-3 font-semibold text-white">Завантаженість</th>
                        <th className="text-center p-3 font-semibold text-white">Дії</th>
                      </tr>
                    </thead>
                <tbody>
                  {filteredMasters.map((master) => {
                    const isSelected = selectedMasters.has(master.id)
                    const stats = masterStats[master.id] || {
                      visits: 0,
                      earned: 0,
                      utilizationRate: 0,
                    }
                    return (
                      <tr
                        key={master.id}
                        className={cn(
                          "border-b border-white/5 hover:bg-white/5 transition-colors",
                          isSelected && "bg-white/10"
                        )}
                      >
                        <td className="p-3">
                          <button
                            onClick={() => toggleSelectMaster(master.id)}
                            className={cn(
                              "w-4 h-4 rounded border-2 flex items-center justify-center transition-all",
                              isSelected
                                ? "bg-white border-white"
                                : "border-white/30 hover:border-white/50"
                            )}
                          >
                            {isSelected && <CheckIcon className="w-3 h-3 text-black" />}
                          </button>
                        </td>
                        <td className="p-3 font-medium text-white">{master.name}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <StarIcon className="w-3 h-3 text-yellow-400" />
                            <span className="text-white">{(master.averageRating ?? 0).toFixed(1)}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium",
                            master.isActive
                              ? "bg-green-500/20 text-green-400 border border-green-500/50"
                              : "bg-white/10 text-gray-400 border border-white/10"
                          )}>
                            {master.isActive ? 'Активний' : 'Неактивний'}
                          </span>
                        </td>
                        <td className="p-3 text-center text-white">{master.totalAppointments ?? 0}</td>
                        <td className="p-3 text-right font-semibold text-purple-400">
                          {Math.round(stats.earned)} грн
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full transition-all",
                                  stats.utilizationRate > 80 ? "bg-green-400" :
                                  stats.utilizationRate > 50 ? "bg-blue-400" :
                                  "bg-orange-400"
                                )}
                                style={{ width: `${Math.min(100, stats.utilizationRate)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 w-8 text-right">
                              {Math.round(stats.utilizationRate)}%
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => {
                                setSelectedMasterForSchedule(master)
                                setShowScheduleModal(true)
                              }}
                              className="p-1.5 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                              title="Графік роботи"
                            >
                              <CalendarIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleEditMaster(master)}
                              className="p-1.5 text-purple-400 hover:bg-purple-400/10 rounded-lg transition-all"
                              title="Редагувати"
                            >
                              <EditIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMaster(master.id)}
                              className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                              title="Видалити"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
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

          {(viewMode === 'cards' || (typeof window !== 'undefined' && window.innerWidth < 768)) && filteredMasters.map((master) => {
            const isExpanded = expandedMaster === master.id
            const stats = masterStats[master.id] || {
              visits: 0,
              earned: 0,
              reviews: 0,
              clients: 0,
              services: 0,
              appointments: [],
              recentAppointments: [],
              utilizationRate: 0,
              averageOrderValue: 0,
            }
            const isSelected = selectedMasters.has(master.id)

            return (
              <div
                key={master.id}
                className={cn(
                  "rounded-xl overflow-hidden transition-all card-glass",
                  isExpanded && "shadow-lg",
                  isSelected && "ring-2 ring-white/50"
                )}
              >
                <div className="w-full p-4 md:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleSelectMaster(master.id)}
                        className={cn(
                          "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
                          isSelected
                            ? "bg-white border-white"
                            : "border-white/30 hover:border-white/50"
                        )}
                      >
                        {isSelected && <CheckIcon className="w-3 h-3 text-black" />}
                      </button>
                      <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 overflow-hidden">
                        {master.photo ? (
                          <img
                            src={master.photo}
                            alt={master.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          master.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm md:text-base font-semibold text-white truncate">
                            {master.name}
                          </h3>
                          <div className="flex items-center gap-1">
                            <StarIcon className="w-3 h-3 text-yellow-400" />
                            <span className="text-xs font-medium text-gray-400">
                              {(master.averageRating ?? 0).toFixed(1)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium",
                            master.isActive
                              ? "bg-green-500/20 text-green-400 border border-green-500/50"
                              : "bg-white/10 text-gray-400 border border-white/10"
                          )}>
                            {master.isActive ? 'Працює' : 'Не працює'}
                          </span>
                          {master.bio && (
                            <p className="text-xs text-gray-400 truncate hidden sm:block">
                              {master.bio}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                      <div className="text-center hidden sm:block">
                        <div className="text-sm font-semibold text-blue-400">
                          {stats.visits}
                        </div>
                        <div className="text-xs text-gray-400">Візитів</div>
                      </div>
                      <div className="text-center hidden sm:block">
                        <div className="text-sm font-semibold text-purple-400">
                          {Math.round(stats.earned)} грн
                        </div>
                        <div className="text-xs text-gray-400">Зароблено</div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setSelectedMasterForSchedule(master)
                            setShowScheduleModal(true)
                          }}
                          className="touch-target min-h-[44px] min-w-[44px] p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all flex items-center justify-center"
                          title="Графік роботи"
                          aria-label="Графік роботи"
                        >
                          <CalendarIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditMaster(master)}
                          className="touch-target min-h-[44px] min-w-[44px] p-2 text-purple-400 hover:bg-purple-400/10 rounded-lg transition-all flex items-center justify-center"
                          title="Редагувати"
                          aria-label="Редагувати"
                        >
                          <EditIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteMaster(master.id)}
                          className="touch-target min-h-[44px] min-w-[44px] p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-all flex items-center justify-center"
                          title="Видалити"
                          aria-label="Видалити"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setExpandedMaster(isExpanded ? null : master.id)}
                          className="touch-target min-h-[44px] min-w-[44px] p-2 text-gray-400 hover:bg-white/10 rounded-lg transition-all flex items-center justify-center"
                          aria-label={isExpanded ? 'Згорнути' : 'Розгорнути'}
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
                  <div className="px-4 md:px-6 pb-4 md:pb-6 pt-0 border-t border-white/10">
                    <div className="mt-4 space-y-4">
                      {/* Quick Stats */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                          <div className="text-xs text-gray-400 font-medium mb-1">Клієнти</div>
                          <div className="text-sm font-semibold text-purple-400">{stats.clients}</div>
                        </div>
                        <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                          <div className="text-xs text-gray-400 font-medium mb-1">Послуги</div>
                          <div className="text-sm font-semibold text-blue-400">{stats.services}</div>
                        </div>
                        <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                          <div className="text-xs text-gray-400 font-medium mb-1">Завантаженість</div>
                          <div className="text-sm font-semibold text-green-400">{Math.round(stats.utilizationRate)}%</div>
                        </div>
                      </div>

                      {/* Bio */}
                      {master.bio && (
                        <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                          <div className="text-xs text-gray-400 font-medium mb-1">Опис</div>
                          <div className="text-sm text-white">{master.bio}</div>
                        </div>
                      )}

                      {/* Recent Appointments */}
                      {stats.recentAppointments.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-white">
                              Останні записи ({stats.recentAppointments.length})
                            </h4>
                            <button
                              onClick={() => router.push(`/dashboard/appointments?masterId=${master.id}`)}
                              className="px-3 py-1.5 text-xs border border-white/20 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors"
                            >
                              Всі записи
                            </button>
                          </div>
                          
                          <div className="space-y-2 max-h-[200px] md:max-h-[300px] overflow-y-auto">
                            {stats.recentAppointments.map((appointment: any) => {
                              const start = new Date(appointment.startTime)
                              return (
                                <div
                                  key={appointment.id}
                                  className="p-3 rounded-lg border border-white/10 bg-white/5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-semibold text-white truncate">
                                        {format(start, 'dd.MM.yyyy HH:mm')}
                                      </div>
                                      <div className="text-xs text-gray-400 truncate">
                                        {fixMojibake(appointment.clientName)}
                                      </div>
                                    </div>
                                    <span className={cn(
                                      "px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0",
                                      appointment.status === 'Done' ? "bg-blue-500/20 text-blue-400 border-blue-500/50" :
                                      appointment.status === 'Confirmed' ? "bg-green-500/20 text-green-400 border-green-500/50" :
                                      "bg-orange-500/20 text-orange-400 border-orange-500/50"
                                    )}>
                                      {appointment.status === 'Done' ? 'Виконано' :
                                       appointment.status === 'Confirmed' ? 'Підтверджено' : 'Очікує'}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

        </div>

        {/* Right Sidebar */}
        <div className="dashboard-sidebar-col space-y-3 md:space-y-6 flex flex-col min-w-0 w-full max-w-full overflow-hidden">
          <div className="rounded-xl p-4 md:p-6 card-glass min-w-0 overflow-hidden">
            <h3 className="text-base md:text-lg font-semibold text-white mb-3" style={{ letterSpacing: '-0.01em' }}>
              Швидкі дії
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setEditingMaster(null)
                  setShowQuickMasterCard(true)
                }}
                className="w-full px-4 py-2 border border-white/20 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors text-left"
              >
                + Додати спеціаліста
              </button>
              <button
                onClick={() => router.push('/dashboard/schedule')}
                className="w-full px-4 py-2 border border-white/20 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors text-left"
              >
                Розклад роботи
              </button>
              <button
                onClick={handleExportCSV}
                className="w-full px-4 py-2 border border-white/20 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20 transition-colors text-left flex items-center gap-2"
              >
                <DownloadIcon className="w-4 h-4" />
                Експорт CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Master Card Modal */}
      {showQuickMasterCard && business && (
        <QuickMasterCard
          businessId={business.id}
          editingMaster={editingMaster}
          onSuccess={(master) => {
            handleMasterCreated()
          }}
          onCancel={() => {
            setShowQuickMasterCard(false)
            setEditingMaster(null)
          }}
        />
      )}

      {/* Schedule Modal */}
      {showScheduleModal && selectedMasterForSchedule && business && (
        <MasterScheduleModal
          master={selectedMasterForSchedule}
          businessId={business.id}
          onClose={() => {
            setShowScheduleModal(false)
            setSelectedMasterForSchedule(null)
          }}
          onSave={(workingHours, scheduleDateOverrides) => {
            setMasters((prev) =>
              prev.map((m) =>
                m.id === selectedMasterForSchedule.id
                  ? { ...m, workingHours, scheduleDateOverrides }
                  : m
              )
            )
            handleMasterCreated() // Перезавантажуємо дані
          }}
        />
      )}

      {/* Date Range Picker Modal */}
      {showDatePicker && (
        <DateRangePicker
          onSelect={(start, end) => {
            setDateFilterStart(start)
            setDateFilterEnd(end)
          }}
          onClose={() => setShowDatePicker(false)}
          initialStartDate={dateFilterStart}
          initialEndDate={dateFilterEnd}
        />
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, differenceInDays } from 'date-fns'
import { uk } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { UserIcon, SearchIcon, DownloadIcon, FilterIcon, CheckIcon, CalendarIcon, PhoneIcon, SettingsIcon, XIcon, StarIcon, MoneyIcon, UsersIcon, ChevronDownIcon, ChevronUpIcon, EditIcon, TrashIcon } from '@/components/icons'
import { QuickMasterCard } from '@/components/admin/QuickMasterCard'
import { MasterScheduleModal } from '@/components/admin/MasterScheduleModal'
import { toast } from '@/components/ui/toast'

interface Master {
  id: string
  name: string
  photo?: string | null
  bio?: string | null
  rating: number
  isActive: boolean
  totalAppointments: number
  totalRevenue: number
  averageRating: number
  utilizationRate: number
  createdAt: string
  updatedAt: string
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
  const [dateFilter, setDateFilter] = useState<string>('all') // all, today, tomorrow, week, month

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
              
              if (apt.customPrice) {
                totalRevenue += apt.customPrice
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
          
          if (apt.customPrice) {
            earned += apt.customPrice
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
                
                if (apt.customPrice) {
                  totalRevenue += apt.customPrice
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
      if (dateFilter !== 'all') {
        const masterAppointments = appointments.filter((apt: any) => apt.masterId === master.id)
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        const weekEnd = new Date(today)
        weekEnd.setDate(weekEnd.getDate() + 7)
        const monthEnd = new Date(today)
        monthEnd.setMonth(monthEnd.getMonth() + 1)

        const hasAppointmentsInPeriod = masterAppointments.some((apt: any) => {
          const aptDate = new Date(apt.startTime)
          switch (dateFilter) {
            case 'today':
              return aptDate >= today && aptDate < tomorrow
            case 'tomorrow':
              return aptDate >= tomorrow && aptDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
            case 'week':
              return aptDate >= today && aptDate < weekEnd
            case 'month':
              return aptDate >= today && aptDate < monthEnd
            default:
              return true
          }
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
          comparison = a.totalAppointments - b.totalAppointments
          break
        case 'earned':
          comparison = a.totalRevenue - b.totalRevenue
          break
        case 'rating':
          comparison = a.averageRating - b.averageRating
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
        master.averageRating.toFixed(1),
        master.isActive ? 'Активний' : 'Неактивний',
        master.totalAppointments,
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
    totalAppointments: filteredMasters.reduce((sum, m) => sum + m.totalAppointments, 0),
    avgRating: filteredMasters.length > 0 
      ? filteredMasters.reduce((sum, m) => sum + m.averageRating, 0) / filteredMasters.length 
      : 0,
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
              Спеціалісти
            </h1>
            <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
              Управління командою спеціалістів
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => {
                setEditingMaster(null)
                setShowQuickMasterCard(true)
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-candy-blue to-candy-purple text-white font-black rounded-candy-xs text-xs shadow-soft-lg hover:shadow-soft-xl transition-all active:scale-95 whitespace-nowrap flex items-center gap-1.5"
            >
              <UserIcon className="w-4 h-4" />
              Додати спеціаліста
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
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Активні</div>
            <div className="text-sm font-black text-candy-mint">{stats.active}</div>
          </div>
          <div className="card-candy p-2 text-center">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Неактивні</div>
            <div className="text-sm font-black text-candy-orange">{stats.inactive}</div>
          </div>
          <div className="card-candy p-2 text-center">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Візити</div>
            <div className="text-sm font-black text-candy-blue">{stats.totalAppointments}</div>
          </div>
          <div className="card-candy p-2 text-center">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Дохід</div>
            <div className="text-sm font-black text-candy-purple">{Math.round(stats.totalRevenue)} грн</div>
          </div>
          <div className="card-candy p-2 text-center">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Середній рейтинг</div>
            <div className="text-sm font-black text-candy-pink">{stats.avgRating.toFixed(1)}</div>
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
                placeholder="Пошук за ім'ям або описом..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-candy-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-candy-purple"
              />
            </div>
            
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-candy-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-candy-purple"
            >
              <option value="all">Всі спеціалісти</option>
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
              <option value="earned">За заробітком</option>
              <option value="rating">За рейтингом</option>
            </select>

            {/* Sort Order */}
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-candy-xs bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>

            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-candy-xs bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-candy-purple"
            >
              <option value="all">Всі дати</option>
              <option value="today">Сьогодні</option>
              <option value="tomorrow">Завтра</option>
              <option value="week">Цей тиждень</option>
              <option value="month">Цей місяць</option>
            </select>
          </div>

          {/* Bulk Actions */}
          {selectedMasters.size > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                Вибрано: {selectedMasters.size}
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    selectedMasters.forEach(id => {
                      const master = masters.find(m => m.id === id)
                      if (master) {
                        handleToggleActive(id, true)
                      }
                    })
                    setSelectedMasters(new Set())
                  }}
                  className="px-2 py-1 text-[10px] bg-candy-mint text-white rounded-candy-xs font-bold hover:opacity-80 transition-all"
                >
                  Активувати
                </button>
                <button
                  onClick={() => {
                    selectedMasters.forEach(id => {
                      const master = masters.find(m => m.id === id)
                      if (master) {
                        handleToggleActive(id, false)
                      }
                    })
                    setSelectedMasters(new Set())
                  }}
                  className="px-2 py-1 text-[10px] bg-candy-orange text-white rounded-candy-xs font-bold hover:opacity-80 transition-all"
                >
                  Деактивувати
                </button>
                <button
                  onClick={() => setSelectedMasters(new Set())}
                  className="px-2 py-1 text-[10px] border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white rounded-candy-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                  Скасувати вибір
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Masters List */}
      {filteredMasters.length === 0 ? (
        <div className="card-candy p-6 text-center">
          <div className="mb-4 flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-br from-candy-purple/20 to-candy-blue/20 rounded-full flex items-center justify-center">
              <UserIcon className="w-10 h-10 text-candy-purple" />
            </div>
          </div>
          <h3 className="text-base font-black text-gray-900 dark:text-white mb-1.5">
            {searchQuery ? "Спеціалістів не знайдено" : "Немає спеціалістів"}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
            {searchQuery ? "Спробуйте інший пошуковий запит" : "Додайте першого спеціаліста, щоб почати працювати"}
          </p>
          {!searchQuery && (
            <button
              onClick={() => {
                setEditingMaster(null)
                setShowQuickMasterCard(true)
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-candy-purple to-candy-blue text-white font-bold rounded-candy-xs text-xs shadow-soft-lg hover:shadow-soft-xl transition-all active:scale-95"
            >
              Додати першого спеціаліста
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
                        {selectedMasters.size === filteredMasters.length && filteredMasters.length > 0 && (
                          <CheckIcon className="w-3 h-3 text-candy-purple" />
                        )}
                      </button>
                    </th>
                    <th className="text-left p-2 font-black">Ім'я</th>
                    <th className="text-center p-2 font-black">Рейтинг</th>
                    <th className="text-center p-2 font-black">Статус</th>
                    <th className="text-center p-2 font-black">Візити</th>
                    <th className="text-right p-2 font-black">Зароблено</th>
                    <th className="text-center p-2 font-black">Завантаженість</th>
                    <th className="text-center p-2 font-black">Дії</th>
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
                          "border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50",
                          isSelected && "bg-gradient-to-r from-candy-purple/10 to-candy-blue/10"
                        )}
                      >
                        <td className="p-2">
                          <button
                            onClick={() => toggleSelectMaster(master.id)}
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
                        <td className="p-2 font-bold">{master.name}</td>
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <StarIcon className="w-3 h-3 text-yellow-400" />
                            <span>{master.averageRating.toFixed(1)}</span>
                          </div>
                        </td>
                        <td className="p-2 text-center">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                            master.isActive
                              ? "bg-candy-mint/10 text-candy-mint border border-candy-mint"
                              : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                          )}>
                            {master.isActive ? 'Активний' : 'Неактивний'}
                          </span>
                        </td>
                        <td className="p-2 text-center">{master.totalAppointments}</td>
                        <td className="p-2 text-right font-black text-candy-purple">
                          {Math.round(stats.earned)} грн
                        </td>
                        <td className="p-2 text-center">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full transition-all",
                                  stats.utilizationRate > 80 ? "bg-candy-mint" :
                                  stats.utilizationRate > 50 ? "bg-candy-blue" :
                                  "bg-candy-orange"
                                )}
                                style={{ width: `${Math.min(100, stats.utilizationRate)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-600 dark:text-gray-400 w-8 text-right">
                              {Math.round(stats.utilizationRate)}%
                            </span>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => {
                                setSelectedMasterForSchedule(master)
                                setShowScheduleModal(true)
                              }}
                              className="p-1 text-candy-blue hover:bg-candy-blue/10 rounded-candy-xs transition-all"
                              title="Графік роботи"
                            >
                              <CalendarIcon className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleEditMaster(master)}
                              className="p-1 text-candy-purple hover:bg-candy-purple/10 rounded-candy-xs transition-all"
                              title="Редагувати"
                            >
                              <EditIcon className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteMaster(master.id)}
                              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-candy-xs transition-all"
                              title="Видалити"
                            >
                              <TrashIcon className="w-3 h-3" />
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

          {viewMode === 'cards' && filteredMasters.map((master) => {
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
                  "card-candy overflow-hidden transition-all",
                  isExpanded && "shadow-soft-2xl",
                  isSelected && "ring-2 ring-candy-purple"
                )}
              >
                <div className="w-full p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleSelectMaster(master.id)}
                        className={cn(
                          "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all",
                          isSelected
                            ? "bg-candy-purple border-candy-purple"
                            : "border-gray-300 dark:border-gray-600"
                        )}
                      >
                        {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                      </button>
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-candy-purple to-candy-blue flex items-center justify-center text-white font-black text-sm flex-shrink-0 overflow-hidden">
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
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-sm font-black text-gray-900 dark:text-white truncate">
                            {master.name}
                          </h3>
                          <div className="flex items-center gap-0.5">
                            <StarIcon className="w-3 h-3 text-yellow-400" />
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">
                              {master.averageRating.toFixed(1)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-full text-[10px] font-bold border",
                            master.isActive
                              ? "bg-candy-mint/10 text-candy-mint border-candy-mint"
                              : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-400"
                          )}>
                            {master.isActive ? 'Працює' : 'Не працює'}
                          </span>
                          {master.bio && (
                            <p className="text-[10px] text-gray-500 dark:text-gray-500 truncate">
                              {master.bio}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-center">
                        <div className="text-sm font-black text-candy-purple">
                          {stats.visits}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">Візитів</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm font-black text-candy-blue">
                          {Math.round(stats.earned)} грн
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">Зароблено</div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setSelectedMasterForSchedule(master)
                            setShowScheduleModal(true)
                          }}
                          className="p-1.5 text-candy-blue hover:bg-candy-blue/10 rounded-candy-xs transition-all"
                          title="Графік роботи"
                        >
                          <CalendarIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditMaster(master)}
                          className="p-1.5 text-candy-purple hover:bg-candy-purple/10 rounded-candy-xs transition-all"
                          title="Редагувати"
                        >
                          <EditIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteMaster(master.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-candy-xs transition-all"
                          title="Видалити"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setExpandedMaster(isExpanded ? null : master.id)}
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
                    <div className="mt-2 space-y-3">
                      {/* Quick Stats */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-2 bg-gradient-to-br from-candy-purple/10 to-candy-purple/5 rounded-candy-xs border border-candy-purple/20">
                          <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold mb-0.5">Клієнти</div>
                          <div className="text-sm font-black text-candy-purple">{stats.clients}</div>
                        </div>

                        <div className="p-2 bg-gradient-to-br from-candy-blue/10 to-candy-blue/5 rounded-candy-xs border border-candy-blue/20">
                          <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold mb-0.5">Послуги</div>
                          <div className="text-sm font-black text-candy-blue">{stats.services}</div>
                        </div>

                        <div className="p-2 bg-gradient-to-br from-candy-mint/10 to-candy-mint/5 rounded-candy-xs border border-candy-mint/20">
                          <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold mb-0.5">Завантаженість</div>
                          <div className="text-sm font-black text-candy-mint">{Math.round(stats.utilizationRate)}%</div>
                        </div>
                      </div>

                      {/* Bio */}
                      {master.bio && (
                        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-candy-xs border border-gray-200 dark:border-gray-700">
                          <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold mb-1">Опис</div>
                          <div className="text-xs text-gray-900 dark:text-white">{master.bio}</div>
                        </div>
                      )}

                      {/* Recent Appointments */}
                      {stats.recentAppointments.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-black text-gray-900 dark:text-white">
                              Останні записи ({stats.recentAppointments.length})
                            </h4>
                            <button
                              onClick={() => router.push(`/dashboard/appointments?masterId=${master.id}`)}
                              className="px-2 py-1 text-[10px] bg-gradient-to-r from-candy-purple to-candy-blue text-white font-bold rounded-candy-xs shadow-soft-lg hover:shadow-soft-xl transition-all"
                            >
                              Всі записи
                            </button>
                          </div>
                          
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {stats.recentAppointments.map((appointment: any) => {
                              const start = new Date(appointment.startTime)
                              return (
                                <div
                                  key={appointment.id}
                                  className="p-2 rounded-candy-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-xs font-black text-gray-900 dark:text-white">
                                        {format(start, 'dd.MM.yyyy HH:mm')}
                                      </div>
                                      <div className="text-[10px] text-gray-600 dark:text-gray-400">
                                        {appointment.clientName}
                                      </div>
                                    </div>
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded-full text-[10px] font-bold border",
                                      appointment.status === 'Done' ? "bg-candy-blue/10 text-candy-blue border-candy-blue" :
                                      appointment.status === 'Confirmed' ? "bg-candy-mint/10 text-candy-mint border-candy-mint" :
                                      "bg-candy-orange/10 text-candy-orange border-candy-orange"
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
          onSave={(workingHours, blockedPeriods) => {
            // Оновлюємо дані спеціаліста
            setMasters((prev) =>
              prev.map((m) =>
                m.id === selectedMasterForSchedule.id
                  ? { ...m, workingHours, blockedPeriods }
                  : m
              )
            )
            handleMasterCreated() // Перезавантажуємо дані
          }}
        />
      )}
    </div>
  )
}

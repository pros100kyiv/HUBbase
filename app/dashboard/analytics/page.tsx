'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, subMonths, startOfMonth, endOfMonth, isToday, isSameDay } from 'date-fns'
import { uk } from 'date-fns/locale'
import { MobileWidget } from '@/components/admin/MobileWidget'
import { 
  CalendarIcon, 
  CheckIcon, 
  XIcon, 
  MoneyIcon, 
  UsersIcon, 
  TrendingUpIcon, 
  TrendingDownIcon,
  ChartIcon,
  StarIcon,
  SettingsIcon,
  UserIcon,
  ClockIcon
} from '@/components/icons'
import { cn } from '@/lib/utils'
import { Search } from '@/components/ui/search'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface Client {
  id: string
  name: string
  phone: string
  email?: string
  totalAppointments: number
  totalSpent: number
  lifetimeValue: number
  retentionRate: number
  lastAppointmentDate?: string
  firstAppointmentDate?: string
}

interface MasterStats {
  masterId: string
  masterName: string
  totalAppointments: number
  totalRevenue: number
  utilizationRate: number
  averageRating: number
}

interface ServiceStats {
  serviceId: string
  serviceName: string
  count: number
  revenue: number
}

type TabType = 'overview' | 'clients' | 'revenue' | 'employees' | 'services' | 'ltv' | 'retention' | 'reports'
type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year'

export default function AnalyticsPage() {
  const router = useRouter()
  const [business, setBusiness] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [period, setPeriod] = useState<PeriodType>('month')
  const [loading, setLoading] = useState(true)
  
  // Overview stats
  const [overviewStats, setOverviewStats] = useState<any>(null)
  
  // Clients data
  const [clients, setClients] = useState<Client[]>([])
  const [clientsSearch, setClientsSearch] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  
  // Revenue data
  const [revenueData, setRevenueData] = useState<any>(null)
  
  // Employees data
  const [employeesData, setEmployeesData] = useState<MasterStats[]>([])
  
  // Services data
  const [servicesData, setServicesData] = useState<ServiceStats[]>([])
  
  // LTV & Retention
  const [ltvData, setLtvData] = useState<any>(null)
  const [retentionData, setRetentionData] = useState<any>(null)

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
    loadData()
  }, [business, period, activeTab])

  const loadData = async () => {
    setLoading(true)
    try {
      const promises: Promise<any>[] = []

      // Завжди завантажуємо базову статистику
      promises.push(
        fetch(`/api/statistics?businessId=${business.id}&period=${period}`)
          .then(res => res.json())
          .catch(() => ({}))
      )

      // Завантажуємо дані залежно від активної вкладки
      if (activeTab === 'clients' || activeTab === 'overview') {
        promises.push(
          fetch(`/api/clients?businessId=${business.id}`)
            .then(res => {
              if (!res.ok) throw new Error('Failed to fetch clients')
              return res.json()
            })
            .catch(() => {
              // Fallback: отримуємо клієнтів з appointments
              return fetch(`/api/appointments?businessId=${business.id}`)
                .then(res => res.json())
                .then((appointments: any[]) => {
                  const clientsMap = new Map<string, any>()
                  appointments.forEach((apt: any) => {
                    const phone = apt.clientPhone
                    const existing = clientsMap.get(phone) || {
                      id: phone,
                      name: apt.clientName,
                      phone: apt.clientPhone,
                      email: apt.clientEmail,
                      totalAppointments: 0,
                      totalSpent: apt.customPrice || 0,
                      lifetimeValue: apt.customPrice || 0,
                      retentionRate: 0,
                      firstAppointmentDate: apt.startTime,
                      lastAppointmentDate: apt.startTime,
                      isActive: true,
                    }
                    existing.totalAppointments++
                    existing.totalSpent += apt.customPrice || 0
                    existing.lifetimeValue += apt.customPrice || 0
                    if (new Date(apt.startTime) < new Date(existing.firstAppointmentDate)) {
                      existing.firstAppointmentDate = apt.startTime
                    }
                    if (new Date(apt.startTime) > new Date(existing.lastAppointmentDate)) {
                      existing.lastAppointmentDate = apt.startTime
                    }
                    clientsMap.set(phone, existing)
                  })
                  return Array.from(clientsMap.values())
                })
                .catch(() => [])
            })
        )
      }

      if (activeTab === 'ltv' || activeTab === 'overview') {
        promises.push(
          fetch(`/api/analytics/ltv?businessId=${business.id}&period=all`)
            .then(res => res.json())
            .catch(() => ({ clients: [], totalLTV: 0, averageLTV: 0 }))
        )
      }

      if (activeTab === 'retention' || activeTab === 'overview') {
        promises.push(
          fetch(`/api/analytics/retention?businessId=${business.id}&period=${period}`)
            .then(res => res.json())
            .catch(() => null)
        )
      }

      if (activeTab === 'employees' || activeTab === 'overview') {
        promises.push(
          fetch(`/api/analytics/employee-utilization?businessId=${business.id}&period=${period}`)
            .then(res => res.json())
            .catch(() => ({ masters: [], summary: {} }))
        )
      }

      if (activeTab === 'services' || activeTab === 'overview') {
        promises.push(
          fetch(`/api/services?businessId=${business.id}`)
            .then(res => res.json())
            .catch(() => [])
        )
      }

      const results = await Promise.all(promises)
      let resultIndex = 0

      setOverviewStats(results[resultIndex++] || {})

      if (activeTab === 'clients' || activeTab === 'overview') {
        const clientsData = results[resultIndex++] || []
        setClients(clientsData)
      }

      if (activeTab === 'ltv' || activeTab === 'overview') {
        setLtvData(results[resultIndex++] || {})
      }

      if (activeTab === 'retention' || activeTab === 'overview') {
        setRetentionData(results[resultIndex++] || null)
      }

      if (activeTab === 'employees' || activeTab === 'overview') {
        const empData = results[resultIndex++] || {}
        setEmployeesData(empData.masters || [])
      }

      if (activeTab === 'services' || activeTab === 'overview') {
        const servData = results[resultIndex++] || []
        // Розраховуємо статистику послуг
        fetch(`/api/statistics?businessId=${business.id}&period=${period}`)
          .then(res => res.json())
          .then(stats => {
            if (stats.serviceStats) {
              const serviceStatsArray = Object.entries(stats.serviceStats).map(([id, count]) => {
                const service = servData.find((s: any) => s.id === id)
                return {
                  serviceId: id,
                  serviceName: service?.name || `Послуга #${id.slice(0, 8)}`,
                  count: count as number,
                  revenue: (service?.price || 0) * (count as number),
                }
              })
              setServicesData(serviceStatsArray.sort((a, b) => b.count - a.count))
            }
          })
      }

      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
    }).format(amount / 100) // Конвертуємо з копійок
  }

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(clientsSearch.toLowerCase()) ||
    client.phone.includes(clientsSearch)
  )

  if (!business || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Skeleton className="h-8 w-48 mx-auto mb-2" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-3">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="spacing-item mb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h1 className="text-heading">CRM Аналітика</h1>
                <p className="text-caption font-medium">Повний контроль бізнесу та клієнтів</p>
              </div>
              <div className="flex gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-candy-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
                {(['day', 'week', 'month', 'quarter', 'year'] as PeriodType[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      'px-3 py-1.5 rounded-candy-xs text-xs font-bold transition-all duration-200 active:scale-97 whitespace-nowrap',
                      period === p
                        ? 'candy-blue text-white shadow-soft-lg'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'
                    )}
                  >
                    {p === 'day' ? 'День' : p === 'week' ? 'Тиждень' : p === 'month' ? 'Місяць' : p === 'quarter' ? 'Квартал' : 'Рік'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 mb-4 bg-gray-100 dark:bg-gray-800 rounded-candy-sm border border-gray-200 dark:border-gray-700 p-1.5 overflow-x-auto">
            {([
              { id: 'overview', label: 'Огляд', icon: <ChartIcon className="w-4 h-4" /> },
              { id: 'clients', label: 'Клієнти', icon: <UsersIcon className="w-4 h-4" /> },
              { id: 'revenue', label: 'Дохід', icon: <MoneyIcon className="w-4 h-4" /> },
              { id: 'employees', label: 'Співробітники', icon: <UserIcon className="w-4 h-4" /> },
              { id: 'services', label: 'Послуги', icon: <SettingsIcon className="w-4 h-4" /> },
              { id: 'ltv', label: 'LTV', icon: <TrendingUpIcon className="w-4 h-4" /> },
              { id: 'retention', label: 'Утримання', icon: <TrendingDownIcon className="w-4 h-4" /> },
              { id: 'reports', label: 'Звіти', icon: <ChartIcon className="w-4 h-4" /> },
            ] as Array<{ id: TabType; label: string; icon: React.ReactNode }>).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-candy-xs text-xs font-bold transition-all duration-200 active:scale-97 whitespace-nowrap',
                  activeTab === tab.id
                    ? 'candy-blue text-white shadow-soft-lg'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'
                )}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                <MobileWidget
                  icon={<CalendarIcon />}
                  title="Записи"
                  value={overviewStats?.totalAppointments || 0}
                  iconColor="orange"
                  onClick={() => router.push('/dashboard/appointments')}
                />
                <MobileWidget
                  icon={<UsersIcon />}
                  title="Клієнти"
                  value={overviewStats?.uniqueClients || clients.length || 0}
                  iconColor="blue"
                  onClick={() => setActiveTab('clients')}
                />
                <MobileWidget
                  icon={<MoneyIcon />}
                  title="Дохід"
                  value={formatCurrency(overviewStats?.totalRevenue || 0)}
                  iconColor="green"
                  onClick={() => setActiveTab('revenue')}
                />
                <MobileWidget
                  icon={<CheckIcon />}
                  title="Виконано"
                  value={overviewStats?.completedAppointments || 0}
                  iconColor="green"
                  trend="up"
                />
              </div>

              {/* LTV & Retention Quick View */}
              {(ltvData || retentionData) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {ltvData && (
                    <div className="card-candy p-4 spacing-section">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-subheading flex items-center gap-2">
                          <TrendingUpIcon className="w-5 h-5 text-candy-blue" />
                          Customer LTV
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab('ltv')}
                          className="text-xs"
                        >
                          Детальніше →
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Середній LTV</span>
                          <span className="text-lg font-black text-candy-blue">
                            {formatCurrency(ltvData.averageLTV || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Загальний LTV</span>
                          <span className="text-lg font-black text-foreground">
                            {formatCurrency(ltvData.totalLTV || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Клієнтів</span>
                          <span className="text-base font-bold text-foreground">
                            {ltvData.totalClients || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {retentionData && (
                    <div className="card-candy p-4 spacing-section">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-subheading flex items-center gap-2">
                          <TrendingDownIcon className="w-5 h-5 text-candy-mint" />
                          Retention Rate
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab('retention')}
                          className="text-xs"
                        >
                          Детальніше →
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Retention</span>
                          <span className="text-lg font-black text-candy-mint">
                            {retentionData.baseCohort?.retentionRate?.toFixed(1) || 0}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Churn Rate</span>
                          <span className="text-lg font-black text-red-500">
                            {retentionData.baseCohort?.churnRate?.toFixed(1) || 0}%
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Активні клієнти</span>
                          <span className="text-base font-bold text-foreground">
                            {retentionData.baseCohort?.activeClients || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Top Employees */}
              {employeesData.length > 0 && (
                <div className="card-candy p-4 spacing-section">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-subheading">Топ співробітники</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('employees')}
                      className="text-xs"
                    >
                      Всі →
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {employeesData.slice(0, 5).map((emp, index) => (
                      <div
                        key={emp.masterId}
                        className={cn(
                          'flex items-center justify-between p-2.5 rounded-candy-sm border',
                          index % 4 === 0 ? 'bg-candy-blue/10 border-candy-blue/30' :
                          index % 4 === 1 ? 'bg-candy-mint/10 border-candy-mint/30' :
                          index % 4 === 2 ? 'bg-candy-pink/10 border-candy-pink/30' :
                          'bg-candy-orange/10 border-candy-orange/30'
                        )}
                      >
                        <div className="flex items-center gap-2.5 flex-1">
                          <div className={cn(
                            'w-8 h-8 rounded-candy-xs flex items-center justify-center text-white font-black text-xs',
                            index % 4 === 0 ? 'candy-blue' :
                            index % 4 === 1 ? 'candy-mint' :
                            index % 4 === 2 ? 'candy-pink' : 'candy-orange'
                          )}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-black text-foreground">{emp.masterName}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {emp.totalAppointments} записів
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-foreground">
                            {emp.utilizationRate.toFixed(1)}%
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">використання</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Services */}
              {servicesData.length > 0 && (
                <div className="card-candy p-4 spacing-section">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-subheading">Популярні послуги</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('services')}
                      className="text-xs"
                    >
                      Всі →
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {servicesData.slice(0, 5).map((service, index) => (
                      <div
                        key={service.serviceId}
                        className={cn(
                          'flex items-center justify-between p-2.5 rounded-candy-sm border',
                          index % 4 === 0 ? 'bg-candy-blue/10 border-candy-blue/30' :
                          index % 4 === 1 ? 'bg-candy-mint/10 border-candy-mint/30' :
                          index % 4 === 2 ? 'bg-candy-pink/10 border-candy-pink/30' :
                          'bg-candy-orange/10 border-candy-orange/30'
                        )}
                      >
                        <div className="flex items-center gap-2.5 flex-1">
                          <div className={cn(
                            'w-8 h-8 rounded-candy-xs flex items-center justify-center text-white font-black text-xs',
                            index % 4 === 0 ? 'candy-blue' :
                            index % 4 === 1 ? 'candy-mint' :
                            index % 4 === 2 ? 'candy-pink' : 'candy-orange'
                          )}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-black text-foreground">{service.serviceName}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {formatCurrency(service.revenue)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-foreground">{service.count}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">разів</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clients Tab */}
          {activeTab === 'clients' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Search
                  placeholder="Пошук клієнтів..."
                  value={clientsSearch}
                  onSearch={setClientsSearch}
                  className="flex-1"
                />
                <Button
                  onClick={() => router.push('/dashboard/clients')}
                  className="whitespace-nowrap"
                >
                  Управління →
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    onClick={() => {
                      setSelectedClient(client)
                      router.push(`/dashboard/clients?clientId=${client.id}`)
                    }}
                    className="card-candy p-4 spacing-section cursor-pointer hover:shadow-soft-xl transition-all active:scale-[0.97]"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-base font-black text-foreground mb-1">{client.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{client.phone}</p>
                        {client.email && (
                          <p className="text-xs text-gray-500 dark:text-gray-500">{client.email}</p>
                        )}
                      </div>
                      <Badge variant={client.isActive ? 'success' : 'secondary'}>
                        {client.isActive ? 'Активний' : 'Неактивний'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Записів</p>
                        <p className="text-sm font-black text-foreground">{client.totalAppointments}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">LTV</p>
                        <p className="text-sm font-black text-candy-blue">
                          {formatCurrency(client.lifetimeValue || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Витрачено</p>
                        <p className="text-sm font-black text-foreground">
                          {formatCurrency(client.totalSpent || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Retention</p>
                        <p className="text-sm font-black text-candy-mint">
                          {client.retentionRate?.toFixed(1) || 0}%
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredClients.length === 0 && (
                <div className="card-candy p-8 text-center">
                  <UsersIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-caption font-medium">Клієнти не знайдені</p>
                </div>
              )}
            </div>
          )}

          {/* Revenue Tab */}
          {activeTab === 'revenue' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                <MobileWidget
                  icon={<MoneyIcon />}
                  title="Загальний дохід"
                  value={formatCurrency(overviewStats?.totalRevenue || 0)}
                  iconColor="green"
                />
                <MobileWidget
                  icon={<TrendingUpIcon />}
                  title="Середній чек"
                  value={overviewStats?.totalAppointments > 0 
                    ? formatCurrency((overviewStats?.totalRevenue || 0) / overviewStats.totalAppointments)
                    : formatCurrency(0)
                  }
                  iconColor="blue"
                />
                <MobileWidget
                  icon={<CalendarIcon />}
                  title="Записів"
                  value={overviewStats?.totalAppointments || 0}
                  iconColor="orange"
                />
              </div>

              <div className="card-candy p-4 spacing-section">
                <h3 className="text-subheading mb-3">Детальна статистика доходу</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-candy-sm bg-candy-blue/10 border border-candy-blue/30">
                    <span className="text-sm font-medium text-foreground">Підтверджені записи</span>
                    <span className="text-base font-black text-candy-blue">
                      {formatCurrency((overviewStats?.confirmedAppointments || 0) * 500)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-candy-sm bg-candy-mint/10 border border-candy-mint/30">
                    <span className="text-sm font-medium text-foreground">Виконані записи</span>
                    <span className="text-base font-black text-candy-mint">
                      {formatCurrency((overviewStats?.completedAppointments || 0) * 500)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-candy-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <span className="text-sm font-medium text-foreground">Очікуючі записи</span>
                    <span className="text-base font-black text-foreground">
                      {formatCurrency((overviewStats?.totalAppointments - (overviewStats?.completedAppointments || 0)) * 500)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Employees Tab */}
          {activeTab === 'employees' && (
            <div className="space-y-4">
              {employeesData.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                    <MobileWidget
                      icon={<UsersIcon />}
                      title="Співробітників"
                      value={employeesData.length}
                      iconColor="blue"
                    />
                    <MobileWidget
                      icon={<TrendingUpIcon />}
                      title="Середнє використання"
                      value={`${employeesData.reduce((sum, e) => sum + e.utilizationRate, 0) / employeesData.length || 0}%`}
                      iconColor="green"
                    />
                    <MobileWidget
                      icon={<MoneyIcon />}
                      title="Загальний дохід"
                      value={formatCurrency(employeesData.reduce((sum, e) => sum + e.totalRevenue, 0))}
                      iconColor="orange"
                    />
                  </div>

                  <div className="card-candy p-4 spacing-section">
                    <h3 className="text-subheading mb-3">Детальна статистика співробітників</h3>
                    <div className="space-y-2">
                      {employeesData.map((emp, index) => (
                        <div
                          key={emp.masterId}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-candy-sm border',
                            index % 4 === 0 ? 'bg-candy-blue/10 border-candy-blue/30' :
                            index % 4 === 1 ? 'bg-candy-mint/10 border-candy-mint/30' :
                            index % 4 === 2 ? 'bg-candy-pink/10 border-candy-pink/30' :
                            'bg-candy-orange/10 border-candy-orange/30'
                          )}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className={cn(
                              'w-10 h-10 rounded-candy-xs flex items-center justify-center text-white font-black',
                              index % 4 === 0 ? 'candy-blue' :
                              index % 4 === 1 ? 'candy-mint' :
                              index % 4 === 2 ? 'candy-pink' : 'candy-orange'
                            )}>
                              {emp.masterName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-black text-foreground">{emp.masterName}</p>
                              <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                                <span>{emp.totalAppointments} записів</span>
                                <span className="flex items-center gap-1">
                                  <StarIcon className="w-3 h-3" />
                                  {emp.averageRating.toFixed(1)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-foreground">
                              {emp.utilizationRate.toFixed(1)}%
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">використання</p>
                            <p className="text-xs font-bold text-candy-blue mt-1">
                              {formatCurrency(emp.totalRevenue)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="card-candy p-8 text-center">
                  <UserIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-caption font-medium">Немає даних про співробітників</p>
                </div>
              )}
            </div>
          )}

          {/* Services Tab */}
          {activeTab === 'services' && (
            <div className="space-y-4">
              {servicesData.length > 0 ? (
                <>
                  <div className="card-candy p-4 spacing-section">
                    <h3 className="text-subheading mb-3">Статистика послуг</h3>
                    <div className="space-y-2">
                      {servicesData.map((service, index) => (
                        <div
                          key={service.serviceId}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-candy-sm border',
                            index % 4 === 0 ? 'bg-candy-blue/10 border-candy-blue/30' :
                            index % 4 === 1 ? 'bg-candy-mint/10 border-candy-mint/30' :
                            index % 4 === 2 ? 'bg-candy-pink/10 border-candy-pink/30' :
                            'bg-candy-orange/10 border-candy-orange/30'
                          )}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className={cn(
                              'w-10 h-10 rounded-candy-xs flex items-center justify-center text-white font-black text-sm',
                              index % 4 === 0 ? 'candy-blue' :
                              index % 4 === 1 ? 'candy-mint' :
                              index % 4 === 2 ? 'candy-pink' : 'candy-orange'
                            )}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="text-sm font-black text-foreground">{service.serviceName}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {formatCurrency(service.revenue)} загалом
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-foreground">{service.count}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">разів</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="card-candy p-8 text-center">
                  <SettingsIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-caption font-medium">Немає даних про послуги</p>
                </div>
              )}
            </div>
          )}

          {/* LTV Tab */}
          {activeTab === 'ltv' && ltvData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
                <MobileWidget
                  icon={<TrendingUpIcon />}
                  title="Середній LTV"
                  value={formatCurrency(ltvData.averageLTV || 0)}
                  iconColor="blue"
                />
                <MobileWidget
                  icon={<MoneyIcon />}
                  title="Загальний LTV"
                  value={formatCurrency(ltvData.totalLTV || 0)}
                  iconColor="green"
                />
                <MobileWidget
                  icon={<UsersIcon />}
                  title="Клієнтів"
                  value={ltvData.totalClients || 0}
                  iconColor="orange"
                />
              </div>

              {ltvData.clients && ltvData.clients.length > 0 && (
                <div className="card-candy p-4 spacing-section">
                  <h3 className="text-subheading mb-3">Топ клієнти за LTV</h3>
                  <div className="space-y-2">
                    {ltvData.clients.slice(0, 20).map((client: any, index: number) => (
                      <div
                        key={client.clientId}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-candy-sm border',
                          index % 4 === 0 ? 'bg-candy-blue/10 border-candy-blue/30' :
                          index % 4 === 1 ? 'bg-candy-mint/10 border-candy-mint/30' :
                          index % 4 === 2 ? 'bg-candy-pink/10 border-candy-pink/30' :
                          'bg-candy-orange/10 border-candy-orange/30'
                        )}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={cn(
                            'w-10 h-10 rounded-candy-xs flex items-center justify-center text-white font-black text-sm',
                            index % 4 === 0 ? 'candy-blue' :
                            index % 4 === 1 ? 'candy-mint' :
                            index % 4 === 2 ? 'candy-pink' : 'candy-orange'
                          )}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-black text-foreground">{client.clientName}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {client.clientPhone} • {client.totalAppointments} записів
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-candy-blue">
                            {formatCurrency(client.ltv)}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">LTV</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Retention Tab */}
          {activeTab === 'retention' && retentionData && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-1.5">
                <MobileWidget
                  icon={<UsersIcon />}
                  title="Базова когорта"
                  value={retentionData.baseCohort?.totalClients || 0}
                  iconColor="blue"
                />
                <MobileWidget
                  icon={<CheckIcon />}
                  title="Активні"
                  value={retentionData.baseCohort?.activeClients || 0}
                  iconColor="green"
                />
                <MobileWidget
                  icon={<TrendingUpIcon />}
                  title="Retention"
                  value={`${retentionData.baseCohort?.retentionRate?.toFixed(1) || 0}%`}
                  iconColor="green"
                />
                <MobileWidget
                  icon={<TrendingDownIcon />}
                  title="Churn"
                  value={`${retentionData.baseCohort?.churnRate?.toFixed(1) || 0}%`}
                  iconColor="pink"
                />
              </div>

              {retentionData.monthlyRetention && retentionData.monthlyRetention.length > 0 && (
                <div className="card-candy p-4 spacing-section">
                  <h3 className="text-subheading mb-3">Retention по місяцях</h3>
                  <div className="space-y-2">
                    {retentionData.monthlyRetention.map((month: any, index: number) => (
                      <div
                        key={month.month}
                        className="flex items-center justify-between p-3 rounded-candy-sm border bg-candy-blue/10 border-candy-blue/30"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-black text-foreground">
                            {format(new Date(month.month), 'MMMM yyyy', { locale: uk })}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {month.activeClients} з {month.cohortSize} активні
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-candy-blue">
                            {month.retentionRate.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-4">
              <div className="card-candy p-4 spacing-section">
                <h3 className="text-subheading mb-3">Доступні звіти</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="justify-start h-auto p-4"
                    onClick={() => router.push('/dashboard/analytics/enterprise')}
                  >
                    <div className="text-left">
                      <p className="font-black text-foreground mb-1">Enterprise Analytics</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Розширені метрики та аналітика
                      </p>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start h-auto p-4"
                    onClick={() => setActiveTab('ltv')}
                  >
                    <div className="text-left">
                      <p className="font-black text-foreground mb-1">LTV Звіт</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Customer Lifetime Value
                      </p>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start h-auto p-4"
                    onClick={() => setActiveTab('retention')}
                  >
                    <div className="text-left">
                      <p className="font-black text-foreground mb-1">Retention Звіт</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Коефіцієнт утримання клієнтів
                      </p>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start h-auto p-4"
                    onClick={() => setActiveTab('employees')}
                  >
                    <div className="text-left">
                      <p className="font-black text-foreground mb-1">Звіт співробітників</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Продуктивність та використання
                      </p>
                    </div>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

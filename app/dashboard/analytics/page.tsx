'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MobileWidget } from '@/components/admin/MobileWidget'
import { CalendarIcon, CheckIcon, XIcon, MoneyIcon, UsersIcon, ChartIcon, LightBulbIcon, TrendingUpIcon, TrendingDownIcon, TargetIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface Service {
  id: string
  name: string
  price: number
}

interface Master {
  id: string
  name: string
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [business, setBusiness] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [advancedStats, setAdvancedStats] = useState<any>(null)
  const [services, setServices] = useState<Service[]>([])
  const [masters, setMasters] = useState<Master[]>([])
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'revenue' | 'clients' | 'services' | 'masters'>('overview')

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
      fetch(`/api/statistics?businessId=${business.id}&period=${period}`).then((res) => res.json()),
      fetch(`/api/analytics/advanced?businessId=${business.id}&period=${period}`).then((res) => res.json()),
      fetch(`/api/services?businessId=${business.id}`).then((res) => res.json()),
      fetch(`/api/masters?businessId=${business.id}`).then((res) => res.json()),
    ])
      .then(([statsData, advancedData, servicesData, mastersData]) => {
        setStats(statsData)
        setAdvancedStats(advancedData)
        setServices(Array.isArray(servicesData) ? servicesData : [])
        setMasters(Array.isArray(mastersData) ? mastersData : [])
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error loading analytics:', error)
        setLoading(false)
      })
  }, [business, period])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
    }).format(amount)
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
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-2">
              Розширена Аналітика
            </h1>
            <p className="text-base text-gray-600 dark:text-gray-400">
              Детальна статистика, прогнози та інсайти
            </p>
          </div>
          <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-candy-sm border border-gray-200 dark:border-gray-700">
            {(['day', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-4 py-2 rounded-candy-sm text-sm font-bold transition-all active:scale-95 whitespace-nowrap',
                  period === p
                    ? 'bg-gradient-to-r from-candy-purple to-candy-blue text-white shadow-soft-lg'
                    : 'text-gray-600 dark:text-gray-400 hover:text-candy-purple dark:hover:text-purple-400 hover:bg-white dark:hover:bg-gray-700'
                )}
              >
                {p === 'day' ? 'День' : p === 'week' ? 'Тиждень' : 'Місяць'}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          {(['overview', 'revenue', 'clients', 'services', 'masters'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2 text-sm font-bold border-b-2 transition-all',
                activeTab === tab
                  ? 'border-candy-purple text-candy-purple'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-candy-purple'
              )}
            >
              {tab === 'overview' ? 'Огляд' : 
               tab === 'revenue' ? 'Прибуток' :
               tab === 'clients' ? 'Клієнти' :
               tab === 'services' ? 'Послуги' : 'Спеціалісти'}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && advancedStats && (
        <div className="space-y-6 mb-6">
          {/* Revenue Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card-candy p-4 bg-gradient-to-br from-candy-purple/10 to-candy-purple/5 border-candy-purple/30">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Поточний прибуток</div>
              <div className="text-2xl font-black text-candy-purple">
                {formatCurrency(advancedStats.currentRevenue || 0)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Тільки виконані записи</div>
            </div>

            <div className="card-candy p-4 bg-gradient-to-br from-candy-blue/10 to-candy-blue/5 border-candy-blue/30">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Прогнозований прибуток</div>
              <div className="text-2xl font-black text-candy-blue">
                {formatCurrency(advancedStats.forecastedRevenue || 0)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Підтверджені записи</div>
            </div>

            <div className="card-candy p-4 bg-gradient-to-br from-candy-mint/10 to-candy-mint/5 border-candy-mint/30">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Прогноз на наступний період</div>
              <div className="text-2xl font-black text-candy-mint">
                {formatCurrency(advancedStats.forecastNextPeriod || 0)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {advancedStats.forecastGrowth > 0 ? (
                  <span className="text-green-500">+{advancedStats.forecastGrowth}%</span>
                ) : (
                  <span className="text-red-500">{advancedStats.forecastGrowth}%</span>
                )}
              </div>
            </div>
          </div>

          {/* LTV & Retention */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-candy p-6">
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <TargetIcon className="w-5 h-5 text-candy-purple" />
                Customer Lifetime Value
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Середній LTV</div>
                  <div className="text-3xl font-black text-candy-purple">
                    {formatCurrency(advancedStats.avgLTV || 0)}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Оцінка загальної вартості клієнта за весь період співпраці
                </div>
              </div>
            </div>

            <div className="card-candy p-6">
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <UsersIcon className="w-5 h-5 text-candy-blue" />
                Retention Rate
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Коефіцієнт утримання</div>
                  <div className="text-3xl font-black text-candy-blue">
                    {Math.round(advancedStats.retentionRate || 0)}%
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Активні клієнти: {advancedStats.activeClients || 0} / {advancedStats.totalClients || 0}
                </div>
              </div>
            </div>
          </div>

          {/* Conversion Funnel */}
          {advancedStats.conversionFunnel && (
            <div className="card-candy p-6">
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">Воронка конверсії</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Всього записів</div>
                    <div className="text-xl font-black">{advancedStats.conversionFunnel.total}</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Підтверджено</div>
                    <div className="text-xl font-black text-candy-blue">
                      {advancedStats.conversionFunnel.confirmed} 
                      <span className="text-sm text-gray-500 ml-2">
                        ({Math.round(advancedStats.conversionFunnel.confirmationRate)}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Виконано</div>
                    <div className="text-xl font-black text-candy-mint">
                      {advancedStats.conversionFunnel.completed}
                      <span className="text-sm text-gray-500 ml-2">
                        ({Math.round(advancedStats.conversionFunnel.completionRate)}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Скасовано</div>
                    <div className="text-xl font-black text-red-500">
                      {advancedStats.conversionFunnel.cancelled}
                      <span className="text-sm text-gray-500 ml-2">
                        ({Math.round(advancedStats.conversionFunnel.cancellationRate)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Daily Trends Chart */}
          {advancedStats.dailyTrends && advancedStats.dailyTrends.length > 0 && (
            <div className="card-candy p-6">
              <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">Тренди доходу</h3>
              <div className="space-y-2">
                {advancedStats.dailyTrends.map((day: any, index: number) => {
                  const maxRevenue = Math.max(...advancedStats.dailyTrends.map((d: any) => d.revenue))
                  const barWidth = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0
                  
                  return (
                    <div key={day.date} className="flex items-center gap-4">
                      <div className="w-20 text-xs text-gray-600 dark:text-gray-400">
                        {day.dateLabel}
                      </div>
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-candy-purple to-candy-blue rounded-full transition-all"
                          style={{ width: `${barWidth}%` }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-900 dark:text-white">
                          {formatCurrency(day.revenue)}
                        </div>
                      </div>
                      <div className="w-16 text-xs text-gray-600 dark:text-gray-400 text-right">
                        {day.completed} записів
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === 'revenue' && advancedStats && (
        <div className="space-y-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card-candy p-6">
              <h3 className="text-lg font-black mb-4">Аналіз джерел</h3>
              {advancedStats.sourceAnalysis && Object.entries(advancedStats.sourceAnalysis).map(([source, data]: [string, any]) => (
                <div key={source} className="flex justify-between items-center p-3 border-b last:border-0">
                  <div>
                    <div className="font-bold">{source === 'qr' ? 'QR код' : source === 'link' ? 'Посилання' : source}</div>
                    <div className="text-xs text-gray-500">{data.count} записів</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-candy-purple">{formatCurrency(data.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card-candy p-6">
              <h3 className="text-lg font-black mb-4">Прогноз</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-gray-600 mb-1">Поточний прибуток</div>
                  <div className="text-2xl font-black text-candy-purple">
                    {formatCurrency(advancedStats.currentRevenue || 0)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">Прогнозований</div>
                  <div className="text-2xl font-black text-candy-blue">
                    {formatCurrency(advancedStats.forecastedRevenue || 0)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">Прогноз на наступний період</div>
                  <div className="text-2xl font-black text-candy-mint">
                    {formatCurrency(advancedStats.forecastNextPeriod || 0)}
                  </div>
                  {advancedStats.forecastGrowth !== 0 && (
                    <div className={`text-sm mt-1 ${advancedStats.forecastGrowth > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {advancedStats.forecastGrowth > 0 ? '↑' : '↓'} {Math.abs(advancedStats.forecastGrowth)}%
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && advancedStats?.serviceAnalysis && (
        <div className="space-y-6 mb-6">
          <div className="card-candy p-6">
            <h3 className="text-lg font-black mb-4">Детальний аналіз послуг</h3>
            <div className="space-y-3">
              {advancedStats.serviceAnalysis.map((service: any, index: number) => (
                <div key={service.serviceId} className="p-4 border rounded-candy-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-black text-lg">{service.serviceName}</div>
                      <div className="text-sm text-gray-500">{formatCurrency(service.price)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-candy-purple">{formatCurrency(service.revenue)}</div>
                      <div className="text-xs text-gray-500">{service.bookings} бронювань</div>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <div>
                      <span className="text-gray-500">Популярність: </span>
                      <span className="font-bold">{service.popularity.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Середній дохід: </span>
                      <span className="font-bold">{formatCurrency(service.avgRevenuePerBooking)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Masters Tab */}
      {activeTab === 'masters' && advancedStats?.masterUtilization && (
        <div className="space-y-6 mb-6">
          <div className="card-candy p-6">
            <h3 className="text-lg font-black mb-4">Завантаженість спеціалістів</h3>
            <div className="space-y-3">
              {advancedStats.masterUtilization.map((master: any) => (
                <div key={master.masterId} className="p-4 border rounded-candy-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-black text-lg">{master.masterName}</div>
                      <div className="text-sm text-gray-500">{master.appointments} записів</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-candy-blue">{formatCurrency(master.revenue)}</div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(master.avgRevenuePerHour)}/год
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Завантаженість</span>
                      <span className="font-bold">{master.utilizationRate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="h-full bg-gradient-to-r from-candy-blue to-candy-purple rounded-full transition-all"
                        style={{ width: `${Math.min(master.utilizationRate, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{master.totalHours.toFixed(1)} год / {master.availableHours.toFixed(1)} год</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MobileWidget
              icon={<CalendarIcon />}
              title="Всього записів"
              value={stats?.totalAppointments || 0}
              iconColor="orange"
            />
            <MobileWidget
              icon={<CheckIcon />}
              title="Підтверджено"
              value={stats?.confirmedAppointments || 0}
              trend="up"
              iconColor="green"
            />
            <MobileWidget
              icon={<CheckIcon />}
              title="Виконано"
              value={stats?.completedAppointments || 0}
              trend="up"
              iconColor="green"
            />
            <MobileWidget
              icon={<XIcon />}
              title="Скасовано"
              value={stats?.cancelledAppointments || 0}
              trend="down"
              iconColor="pink"
            />
          </div>

          {/* Revenue and Clients */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MobileWidget
              icon={<MoneyIcon />}
              title="Загальний дохід"
              value={formatCurrency(stats?.totalRevenue || 0)}
              iconColor="blue"
            />
            <MobileWidget
              icon={<UsersIcon />}
              title="Унікальні клієнти"
              value={stats?.uniqueClients || 0}
              iconColor="purple"
            />
          </div>

          {/* Service Stats */}
          {stats?.serviceStats && Object.keys(stats.serviceStats).length > 0 ? (
            <div className="card-candy p-6">
              <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4">
                Популярність послуг
              </h2>
              <div className="space-y-3">
                {Object.entries(stats.serviceStats)
                  .map(([serviceId, count]) => {
                    const service = services.find((s) => s.id === serviceId)
                    return { serviceId, count: count as number, service }
                  })
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 10)
                  .map(({ serviceId, count, service }, index) => {
                    const colors = [
                      'bg-gradient-to-br from-candy-purple/10 to-candy-purple/5 border-candy-purple/30',
                      'bg-gradient-to-br from-candy-blue/10 to-candy-blue/5 border-candy-blue/30',
                      'bg-gradient-to-br from-candy-mint/10 to-candy-mint/5 border-candy-mint/30',
                      'bg-gradient-to-br from-candy-pink/10 to-candy-pink/5 border-candy-pink/30',
                      'bg-gradient-to-br from-candy-orange/10 to-candy-orange/5 border-candy-orange/30',
                    ]
                    const colorClass = colors[index % colors.length]

                    return (
                      <div
                        key={serviceId}
                        className={cn(
                          'flex items-center justify-between gap-4 p-4 rounded-candy-sm border',
                          colorClass
                        )}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className={cn(
                            'w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-lg flex-shrink-0',
                            index % 5 === 0 ? 'bg-gradient-to-r from-candy-purple to-candy-blue' :
                            index % 5 === 1 ? 'bg-gradient-to-r from-candy-blue to-candy-mint' :
                            index % 5 === 2 ? 'bg-gradient-to-r from-candy-mint to-candy-pink' :
                            index % 5 === 3 ? 'bg-gradient-to-r from-candy-pink to-candy-orange' :
                            'bg-gradient-to-r from-candy-orange to-candy-purple'
                          )}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-black text-gray-900 dark:text-white truncate mb-1">
                              {service?.name || `Послуга #${serviceId.slice(0, 8)}`}
                            </p>
                            {service && (
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {formatCurrency(service.price)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-2xl font-black text-gray-900 dark:text-white">
                            {count}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {count === 1 ? 'раз' : count < 5 ? 'рази' : 'разів'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          ) : (
            <div className="card-candy p-12 text-center">
              <div className="mb-6 flex justify-center">
                <div className="w-32 h-32 bg-gradient-to-br from-candy-purple/20 to-candy-blue/20 rounded-full flex items-center justify-center">
                  <ChartIcon className="w-16 h-16 text-candy-purple" />
                </div>
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">
                Немає даних про послуги
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Статистика з'явиться після перших записів
              </p>
            </div>
          )}

          {/* Master Stats */}
          {stats?.masterStats && stats.masterStats.length > 0 ? (
            <div className="card-candy p-6">
              <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4">
                Статистика спеціалістів
              </h2>
              <div className="space-y-3">
                {stats.masterStats
                  .map((stat: any) => {
                    const master = masters.find((m) => m.id === stat.masterId)
                    return { ...stat, master }
                  })
                  .sort((a: any, b: any) => b.count - a.count)
                  .map((stat: any, index: number) => {
                    const colors = [
                      'bg-gradient-to-br from-candy-purple/10 to-candy-purple/5 border-candy-purple/30',
                      'bg-gradient-to-br from-candy-blue/10 to-candy-blue/5 border-candy-blue/30',
                      'bg-gradient-to-br from-candy-mint/10 to-candy-mint/5 border-candy-mint/30',
                      'bg-gradient-to-br from-candy-pink/10 to-candy-pink/5 border-candy-pink/30',
                      'bg-gradient-to-br from-candy-orange/10 to-candy-orange/5 border-candy-orange/30',
                    ]
                    const colorClass = colors[index % colors.length]

                    return (
                      <div
                        key={stat.masterId}
                        className={cn(
                          'flex items-center justify-between gap-4 p-4 rounded-candy-sm border',
                          colorClass
                        )}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className={cn(
                            'w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-lg flex-shrink-0',
                            index % 5 === 0 ? 'bg-gradient-to-r from-candy-purple to-candy-blue' :
                            index % 5 === 1 ? 'bg-gradient-to-r from-candy-blue to-candy-mint' :
                            index % 5 === 2 ? 'bg-gradient-to-r from-candy-mint to-candy-pink' :
                            index % 5 === 3 ? 'bg-gradient-to-r from-candy-pink to-candy-orange' :
                            'bg-gradient-to-r from-candy-orange to-candy-purple'
                          )}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-black text-gray-900 dark:text-white truncate mb-1">
                              {stat.master?.name || `Спеціаліст #${stat.masterId.slice(0, 8)}`}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {stat.count === 1 ? '1 запис' : `${stat.count} записів`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-2xl font-black text-gray-900 dark:text-white">
                            {stat.count}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            записів
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          ) : (
            <div className="card-candy p-12 text-center">
              <div className="mb-6 flex justify-center">
                <div className="w-32 h-32 bg-gradient-to-br from-candy-purple/20 to-candy-blue/20 rounded-full flex items-center justify-center">
                  <UsersIcon className="w-16 h-16 text-candy-purple" />
                </div>
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">
                Немає даних про спеціалістів
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Статистика з'явиться після перших записів
              </p>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Insights Card */}
          <div className="card-candy p-6 bg-gradient-to-br from-candy-purple/10 to-candy-blue/10">
            <div className="mb-4 flex items-center gap-2">
              <LightBulbIcon className="w-6 h-6 text-candy-purple" />
              <h3 className="text-lg font-black text-gray-900 dark:text-white">
                Інсайти
              </h3>
            </div>
            <div className="space-y-3">
              <div className="p-3 bg-white dark:bg-gray-800 rounded-candy-sm">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Період</div>
                <div className="text-base font-black text-candy-purple">
                  {period === 'day' ? 'День' : period === 'week' ? 'Тиждень' : 'Місяць'}
                </div>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 rounded-candy-sm">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Середній дохід</div>
                <div className="text-base font-black text-candy-blue">
                  {stats?.totalRevenue && stats?.totalAppointments
                    ? formatCurrency(Math.round(stats.totalRevenue / stats.totalAppointments))
                    : formatCurrency(0)}
                </div>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 rounded-candy-sm">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Конверсія</div>
                <div className="text-base font-black text-candy-mint">
                  {stats?.totalAppointments && stats?.confirmedAppointments
                    ? Math.round((stats.confirmedAppointments / stats.totalAppointments) * 100)
                    : 0}%
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card-candy p-6">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">
              Швидкі дії
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/dashboard/appointments')}
                className="w-full px-4 py-3 bg-gradient-to-r from-candy-purple to-candy-blue text-white font-bold rounded-candy-sm shadow-soft-xl hover:shadow-soft-2xl transition-all active:scale-95 text-left"
              >
                Переглянути записи
              </button>
              <button
                onClick={() => router.push('/dashboard/clients')}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 rounded-candy-sm font-bold text-left"
              >
                Переглянути клієнтів
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

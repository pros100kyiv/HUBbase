'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarIcon, CheckIcon, XIcon, MoneyIcon, UsersIcon, ChartIcon, LightBulbIcon, TargetIcon } from '@/components/icons'
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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-6">
        <div className="lg:col-span-3 space-y-3 md:space-y-6">
          {/* Header - same as Dashboard */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
              Аналітика
            </h1>
            <div className="flex gap-2">
              {(['day', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                    period === p ? 'bg-white text-black' : 'border border-white/20 bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                  )}
                  style={period === p ? { boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' } : {}}
                >
                  {p === 'day' ? 'День' : p === 'week' ? 'Тиждень' : 'Місяць'}
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="rounded-xl p-4 md:p-6 card-floating">
            <div className="flex gap-2 flex-wrap">
              {(['overview', 'revenue', 'clients', 'services', 'masters'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    activeTab === tab ? 'bg-white text-black' : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white border border-white/10'
                  )}
                  style={activeTab === tab ? { boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' } : {}}
                >
                  {tab === 'overview' ? 'Огляд' : tab === 'revenue' ? 'Прибуток' : tab === 'clients' ? 'Клієнти' : tab === 'services' ? 'Послуги' : 'Спеціалісти'}
                </button>
              ))}
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && advancedStats && (
            <div className="space-y-3 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <div className="rounded-xl p-4 md:p-6 card-floating">
                  <div className="text-xs text-gray-400 mb-1">Поточний прибуток</div>
                  <div className="text-xl md:text-2xl font-bold text-purple-400">{formatCurrency(advancedStats.currentRevenue || 0)}</div>
                  <div className="text-xs text-gray-500 mt-1">Виконані записи</div>
                </div>
                <div className="rounded-xl p-4 md:p-6 card-floating">
                  <div className="text-xs text-gray-400 mb-1">Прогнозований прибуток</div>
                  <div className="text-xl md:text-2xl font-bold text-blue-400">{formatCurrency(advancedStats.forecastedRevenue || 0)}</div>
                  <div className="text-xs text-gray-500 mt-1">Підтверджені записи</div>
                </div>
                <div className="rounded-xl p-4 md:p-6 card-floating">
                  <div className="text-xs text-gray-400 mb-1">Прогноз на наступний період</div>
                  <div className="text-xl md:text-2xl font-bold text-green-400">{formatCurrency(advancedStats.forecastNextPeriod || 0)}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {advancedStats.forecastGrowth > 0 ? <span className="text-green-400">+{advancedStats.forecastGrowth}%</span> : <span className="text-red-400">{advancedStats.forecastGrowth}%</span>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="rounded-xl p-4 md:p-6 card-floating">
                  <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2"><TargetIcon className="w-5 h-5 text-purple-400" />Customer Lifetime Value</h3>
                  <div className="text-2xl md:text-3xl font-bold text-purple-400">{formatCurrency(advancedStats.avgLTV || 0)}</div>
                  <div className="text-xs text-gray-500 mt-1">Оцінка вартості клієнта за період</div>
                </div>
                <div className="rounded-xl p-4 md:p-6 card-floating">
                  <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2"><UsersIcon className="w-5 h-5 text-blue-400" />Retention Rate</h3>
                  <div className="text-2xl md:text-3xl font-bold text-blue-400">{Math.round(advancedStats.retentionRate || 0)}%</div>
                  <div className="text-xs text-gray-500 mt-1">Активні: {advancedStats.activeClients || 0} / {advancedStats.totalClients || 0}</div>
                </div>
              </div>
              {advancedStats.conversionFunnel && (
                <div className="rounded-xl p-4 md:p-6 card-floating">
                  <h3 className="text-base font-semibold text-white mb-4">Воронка конверсії</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-xs text-gray-400 mb-1">Всього</div>
                      <div className="text-lg font-semibold text-white">{advancedStats.conversionFunnel.total}</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-xs text-gray-400 mb-1">Підтверджено</div>
                      <div className="text-lg font-semibold text-blue-400">{advancedStats.conversionFunnel.confirmed} ({Math.round(advancedStats.conversionFunnel.confirmationRate)}%)</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-xs text-gray-400 mb-1">Виконано</div>
                      <div className="text-lg font-semibold text-green-400">{advancedStats.conversionFunnel.completed} ({Math.round(advancedStats.conversionFunnel.completionRate)}%)</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-xs text-gray-400 mb-1">Скасовано</div>
                      <div className="text-lg font-semibold text-red-400">{advancedStats.conversionFunnel.cancelled} ({Math.round(advancedStats.conversionFunnel.cancellationRate)}%)</div>
                    </div>
                  </div>
                </div>
              )}
              {advancedStats.dailyTrends && advancedStats.dailyTrends.length > 0 && (
                <div className="rounded-xl p-4 md:p-6 card-floating">
                  <h3 className="text-base font-semibold text-white mb-4">Тренди доходу</h3>
                  <div className="space-y-2">
                    {advancedStats.dailyTrends.map((day: any) => {
                      const maxRevenue = Math.max(...advancedStats.dailyTrends.map((d: any) => d.revenue))
                      const barWidth = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0
                      return (
                        <div key={day.date} className="flex items-center gap-4">
                          <div className="w-20 text-xs text-gray-400">{day.dateLabel}</div>
                          <div className="flex-1 bg-white/10 rounded-full h-6 relative overflow-hidden">
                            <div className="h-full bg-white/30 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white">{formatCurrency(day.revenue)}</div>
                          </div>
                          <div className="w-16 text-xs text-gray-400 text-right">{day.completed} записів</div>
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
            <div className="space-y-3 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="rounded-xl p-4 md:p-6 card-floating">
                  <h3 className="text-base font-semibold text-white mb-4">Аналіз джерел</h3>
                  {advancedStats.sourceAnalysis && Object.entries(advancedStats.sourceAnalysis).map(([source, data]: [string, any]) => (
                    <div key={source} className="flex justify-between items-center p-3 border-b border-white/10 last:border-0">
                      <div>
                        <div className="font-medium text-white">{source === 'qr' ? 'QR код' : source === 'link' ? 'Посилання' : source}</div>
                        <div className="text-xs text-gray-400">{data.count} записів</div>
                      </div>
                      <div className="font-semibold text-purple-400">{formatCurrency(data.revenue)}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl p-4 md:p-6 card-floating">
                  <h3 className="text-base font-semibold text-white mb-4">Прогноз</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-xs text-gray-400 mb-1">Поточний прибуток</div>
                      <div className="text-xl font-bold text-purple-400">{formatCurrency(advancedStats.currentRevenue || 0)}</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-xs text-gray-400 mb-1">Прогнозований</div>
                      <div className="text-xl font-bold text-blue-400">{formatCurrency(advancedStats.forecastedRevenue || 0)}</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-xs text-gray-400 mb-1">На наступний період</div>
                      <div className="text-xl font-bold text-green-400">{formatCurrency(advancedStats.forecastNextPeriod || 0)}</div>
                      {advancedStats.forecastGrowth !== 0 && (
                        <div className={`text-sm mt-1 ${advancedStats.forecastGrowth > 0 ? 'text-green-400' : 'text-red-400'}`}>
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
            <div className="space-y-3 md:space-y-6">
              <div className="rounded-xl p-4 md:p-6 card-floating">
                <h3 className="text-base font-semibold text-white mb-4">Детальний аналіз послуг</h3>
                <div className="space-y-3">
                  {advancedStats.serviceAnalysis.map((service: any) => (
                    <div key={service.serviceId} className="p-4 rounded-lg border border-white/10 bg-white/5">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-white">{service.serviceName}</div>
                          <div className="text-sm text-gray-400">{formatCurrency(service.price)}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-purple-400">{formatCurrency(service.revenue)}</div>
                          <div className="text-xs text-gray-400">{service.bookings} бронювань</div>
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-400">
                        <span>Популярність: <span className="font-medium text-white">{service.popularity.toFixed(1)}%</span></span>
                        <span>Середній дохід: <span className="font-medium text-white">{formatCurrency(service.avgRevenuePerBooking)}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Masters Tab */}
          {activeTab === 'masters' && advancedStats?.masterUtilization && (
            <div className="space-y-3 md:space-y-6">
              <div className="rounded-xl p-4 md:p-6 card-floating">
                <h3 className="text-base font-semibold text-white mb-4">Завантаженість спеціалістів</h3>
                <div className="space-y-3">
                  {advancedStats.masterUtilization.map((master: any) => (
                    <div key={master.masterId} className="p-4 rounded-lg border border-white/10 bg-white/5">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-semibold text-white">{master.masterName}</div>
                          <div className="text-sm text-gray-400">{master.appointments} записів</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-blue-400">{formatCurrency(master.revenue)}</div>
                          <div className="text-xs text-gray-400">{formatCurrency(master.avgRevenuePerHour)}/год</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Завантаженість</span>
                          <span className="font-medium text-white">{master.utilizationRate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div className="h-full bg-white/30 rounded-full transition-all" style={{ width: `${Math.min(master.utilizationRate, 100)}%` }} />
                        </div>
                        <div className="text-xs text-gray-500">{master.totalHours.toFixed(1)} год / {master.availableHours.toFixed(1)} год</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Main Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="rounded-xl p-4 card-floating">
              <div className="flex items-center gap-2 mb-1"><CalendarIcon className="w-5 h-5 text-orange-400" /></div>
              <div className="text-xs text-gray-400">Всього записів</div>
              <div className="text-lg font-bold text-white">{stats?.totalAppointments || 0}</div>
            </div>
            <div className="rounded-xl p-4 card-floating">
              <div className="flex items-center gap-2 mb-1"><CheckIcon className="w-5 h-5 text-green-400" /></div>
              <div className="text-xs text-gray-400">Підтверджено</div>
              <div className="text-lg font-bold text-white">{stats?.confirmedAppointments || 0}</div>
            </div>
            <div className="rounded-xl p-4 card-floating">
              <div className="flex items-center gap-2 mb-1"><CheckIcon className="w-5 h-5 text-green-400" /></div>
              <div className="text-xs text-gray-400">Виконано</div>
              <div className="text-lg font-bold text-white">{stats?.completedAppointments || 0}</div>
            </div>
            <div className="rounded-xl p-4 card-floating">
              <div className="flex items-center gap-2 mb-1"><XIcon className="w-5 h-5 text-pink-400" /></div>
              <div className="text-xs text-gray-400">Скасовано</div>
              <div className="text-lg font-bold text-white">{stats?.cancelledAppointments || 0}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="rounded-xl p-4 md:p-6 card-floating">
              <div className="flex items-center gap-2 mb-1"><MoneyIcon className="w-5 h-5 text-blue-400" /></div>
              <div className="text-xs text-gray-400">Загальний дохід</div>
              <div className="text-xl font-bold text-white">{formatCurrency(stats?.totalRevenue || 0)}</div>
            </div>
            <div className="rounded-xl p-4 md:p-6 card-floating">
              <div className="flex items-center gap-2 mb-1"><UsersIcon className="w-5 h-5 text-purple-400" /></div>
              <div className="text-xs text-gray-400">Унікальні клієнти</div>
              <div className="text-xl font-bold text-white">{stats?.uniqueClients || 0}</div>
            </div>
          </div>

          {/* Service Stats */}
          {stats?.serviceStats && Object.keys(stats.serviceStats).length > 0 ? (
            <div className="rounded-xl p-4 md:p-6 card-floating">
              <h2 className="text-base font-semibold text-white mb-4">Популярність послуг</h2>
              <div className="space-y-3">
                {Object.entries(stats.serviceStats)
                  .map(([serviceId, count]) => ({ serviceId, count: count as number, service: services.find((s) => s.id === serviceId) }))
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 10)
                  .map(({ serviceId, count, service }, index) => (
                    <div key={serviceId} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-white/10 bg-white/5">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">{index + 1}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{service?.name || `Послуга #${serviceId.slice(0, 8)}`}</p>
                          {service && <p className="text-xs text-gray-400">{formatCurrency(service.price)}</p>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-bold text-white">{count}</div>
                        <div className="text-xs text-gray-400">{count === 1 ? 'раз' : count < 5 ? 'рази' : 'разів'}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-8 md:p-12 text-center card-floating">
              <div className="mb-4 flex justify-center">
                <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center"><ChartIcon className="w-12 h-12 text-gray-400" /></div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Немає даних про послуги</h3>
              <p className="text-sm text-gray-400">Статистика з'явиться після перших записів</p>
            </div>
          )}

          {/* Master Stats */}
          {stats?.masterStats && stats.masterStats.length > 0 ? (
            <div className="rounded-xl p-4 md:p-6 card-floating">
              <h2 className="text-base font-semibold text-white mb-4">Статистика спеціалістів</h2>
              <div className="space-y-3">
                {stats.masterStats
                  .map((stat: any) => ({ ...stat, master: masters.find((m) => m.id === stat.masterId) }))
                  .sort((a: any, b: any) => b.count - a.count)
                  .map((stat: any, index: number) => (
                    <div key={stat.masterId} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-white/10 bg-white/5">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">{index + 1}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{stat.master?.name || `Спеціаліст #${stat.masterId.slice(0, 8)}`}</p>
                          <p className="text-xs text-gray-400">{stat.count === 1 ? '1 запис' : `${stat.count} записів`}</p>
                        </div>
                      </div>
                      <div className="text-lg font-bold text-white flex-shrink-0">{stat.count}</div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-8 md:p-12 text-center card-floating">
              <div className="mb-4 flex justify-center">
                <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center"><UsersIcon className="w-12 h-12 text-gray-400" /></div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Немає даних про спеціалістів</h3>
              <p className="text-sm text-gray-400">Статистика з'явиться після перших записів</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-3 md:space-y-6">
          <div className="rounded-xl p-4 md:p-6 card-floating">
            <h3 className="text-base font-semibold text-white mb-3 md:mb-4 flex items-center gap-2" style={{ letterSpacing: '-0.01em' }}>
              <LightBulbIcon className="w-5 h-5 text-purple-400" /> Інсайти
            </h3>
            <div className="space-y-2 md:space-y-3">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">Період</span>
                <span className="text-sm font-semibold text-purple-400">{period === 'day' ? 'День' : period === 'week' ? 'Тиждень' : 'Місяць'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">Середній дохід</span>
                <span className="text-sm font-semibold text-blue-400">
                  {stats?.totalRevenue != null && stats?.totalAppointments ? formatCurrency(Math.round(stats.totalRevenue / stats.totalAppointments)) : formatCurrency(0)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                <span className="text-sm text-gray-300">Конверсія</span>
                <span className="text-sm font-semibold text-green-400">
                  {stats?.totalAppointments && stats?.confirmedAppointments ? Math.round((stats.confirmedAppointments / stats.totalAppointments) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-xl p-4 md:p-6 card-floating">
            <h3 className="text-base font-semibold text-white mb-3 md:mb-4" style={{ letterSpacing: '-0.01em' }}>Швидкі дії</h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/dashboard/appointments')}
                className="w-full px-3 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98] text-left"
                style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
              >
                Записи
              </button>
              <button
                onClick={() => router.push('/dashboard/clients')}
                className="w-full px-3 py-2 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-colors text-left"
              >
                Клієнти
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

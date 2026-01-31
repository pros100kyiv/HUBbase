'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/admin/Sidebar'
import { MobileWidget } from '@/components/admin/MobileWidget'
import { CalendarIcon, CheckIcon, XIcon, MoneyIcon, UsersIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

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
  const [services, setServices] = useState<Service[]>([])
  const [masters, setMasters] = useState<Master[]>([])
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month')
  const [loading, setLoading] = useState(true)

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
      fetch(`/api/services?businessId=${business.id}`).then((res) => res.json()),
      fetch(`/api/masters?businessId=${business.id}`).then((res) => res.json()),
    ])
      .then(([statsData, servicesData, mastersData]) => {
        setStats(statsData)
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
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="ml-16 md:ml-40 p-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between spacing-item gap-2">
            <h1 className="text-heading">Аналітика</h1>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-candy-sm border border-gray-200 overflow-hidden">
              {(['day', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2 py-1 rounded-candy-xs text-[10px] font-bold transition-all duration-200 active:scale-97 whitespace-nowrap ${
                    period === p
                      ? 'candy-purple text-white shadow-soft-lg'
                      : 'text-gray-600 dark:text-gray-400 hover:text-candy-purple dark:hover:text-purple-400 hover:bg-white dark:hover:bg-gray-700'
                  }`}
                >
                  {p === 'day' ? 'День' : p === 'week' ? 'Тиждень' : 'Місяць'}
                </button>
              ))}
            </div>
          </div>

          {/* Main Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mb-2">
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
          <div className="grid grid-cols-2 gap-6 mb-8">
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
          {stats?.serviceStats && Object.keys(stats.serviceStats).length > 0 && (
            <div className="card-candy p-3 spacing-section overflow-hidden">
              <h2 className="text-subheading mb-3">Популярність послуг</h2>
              <div className="space-y-2">
                {Object.entries(stats.serviceStats)
                  .map(([serviceId, count]) => {
                    const service = services.find((s) => s.id === serviceId)
                    return { serviceId, count: count as number, service }
                  })
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 10)
                  .map(({ serviceId, count, service }, index) => {
                    const colors = [
                      'bg-candy-purple/10 text-candy-purple border-candy-purple/30',
                      'bg-candy-blue/10 text-candy-blue border-candy-blue/30',
                      'bg-candy-mint/10 text-candy-mint border-candy-mint/30',
                      'bg-candy-pink/10 text-candy-pink border-candy-pink/30',
                      'bg-candy-orange/10 text-candy-orange border-candy-orange/30',
                    ]
                    const colorClass = colors[index % colors.length]

                    return (
                      <div
                        key={serviceId}
                        className={cn(
                          'flex items-center justify-between gap-3 p-2.5 rounded-candy-sm border overflow-hidden',
                          colorClass
                        )}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className={cn(
                            'w-8 h-8 rounded-candy-xs flex items-center justify-center text-white font-black text-xs flex-shrink-0',
                            index % 5 === 0 ? 'candy-purple' :
                            index % 5 === 1 ? 'candy-blue' :
                            index % 5 === 2 ? 'candy-mint' :
                            index % 5 === 3 ? 'candy-pink' : 'candy-orange'
                          )}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-foreground dark:text-white truncate">
                              {service?.name || `Послуга #${serviceId.slice(0, 8)}`}
                            </p>
                            {service && (
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {formatCurrency(service.price)}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <div className="text-base font-black text-foreground dark:text-white">
                              {count}
                            </div>
                            <div className="text-[10px] text-gray-600 dark:text-gray-400">
                              {count === 1 ? 'раз' : count < 5 ? 'рази' : 'разів'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                {Object.keys(stats.serviceStats).length === 0 && (
                  <p className="text-caption text-center py-4">Немає даних про послуги</p>
                )}
              </div>
            </div>
          )}

          {/* Master Stats */}
          {stats?.masterStats && stats.masterStats.length > 0 && (
            <div className="card-candy p-3 spacing-section overflow-hidden">
              <h2 className="text-subheading mb-3">Статистика майстрів</h2>
              <div className="space-y-2">
                {stats.masterStats
                  .map((stat: any) => {
                    const master = masters.find((m) => m.id === stat.masterId)
                    return { ...stat, master }
                  })
                  .sort((a: any, b: any) => b.count - a.count)
                  .map((stat: any, index: number) => {
                    const colors = [
                      'bg-candy-purple/10 text-candy-purple border-candy-purple/30',
                      'bg-candy-blue/10 text-candy-blue border-candy-blue/30',
                      'bg-candy-mint/10 text-candy-mint border-candy-mint/30',
                      'bg-candy-pink/10 text-candy-pink border-candy-pink/30',
                      'bg-candy-orange/10 text-candy-orange border-candy-orange/30',
                    ]
                    const colorClass = colors[index % colors.length]

                    return (
                      <div
                        key={stat.masterId}
                        className={cn(
                          'flex items-center justify-between gap-3 p-2.5 rounded-candy-sm border overflow-hidden',
                          colorClass
                        )}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className={cn(
                            'w-8 h-8 rounded-candy-xs flex items-center justify-center text-white font-black text-xs flex-shrink-0',
                            index % 5 === 0 ? 'candy-purple' :
                            index % 5 === 1 ? 'candy-blue' :
                            index % 5 === 2 ? 'candy-mint' :
                            index % 5 === 3 ? 'candy-pink' : 'candy-orange'
                          )}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-foreground dark:text-white truncate">
                              {stat.master?.name || `Майстер #${stat.masterId.slice(0, 8)}`}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {stat.count === 1 ? '1 запис' : `${stat.count} записів`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <div className="text-base font-black text-foreground dark:text-white">
                              {stat.count}
                            </div>
                            <div className="text-[10px] text-gray-600 dark:text-gray-400">
                              записів
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                {stats.masterStats.length === 0 && (
                  <p className="text-caption text-center py-4">Немає даних про майстрів</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}




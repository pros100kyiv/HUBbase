'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { uk } from 'date-fns/locale'
import { MobileWidget } from '@/components/admin/MobileWidget'
import { CalendarIcon, CheckIcon, XIcon, MoneyIcon, UsersIcon, TrendingUpIcon, TrendingDownIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

interface LTVData {
  clientId: string
  clientName: string
  clientPhone: string
  totalAppointments: number
  totalRevenue: number
  averageOrderValue: number
  purchaseFrequency: number
  customerLifespan: number
  ltv: number
}

interface RetentionData {
  baseCohort: {
    totalClients: number
    activeClients: number
    retentionRate: number
    churnRate: number
  }
  newClients: {
    total: number
    withAppointments: number
  }
  monthlyRetention: Array<{
    month: string
    cohortSize: number
    activeClients: number
    retentionRate: number
  }>
}

interface EmployeeUtilization {
  masterId: string
  masterName: string
  photo?: string
  totalAppointments: number
  totalWorkedHours: number
  availableHours: number
  utilizationRate: number
  totalRevenue: number
  averageRating: number
  revenuePerHour: number
  revenuePerAppointment: number
}

export default function EnterpriseAnalyticsPage() {
  const router = useRouter()
  const [business, setBusiness] = useState<any>(null)
  const [ltvData, setLtvData] = useState<LTVData[]>([])
  const [ltvStats, setLtvStats] = useState<any>(null)
  const [retentionData, setRetentionData] = useState<RetentionData | null>(null)
  const [employeeData, setEmployeeData] = useState<EmployeeUtilization[]>([])
  const [employeeStats, setEmployeeStats] = useState<any>(null)
  const [period, setPeriod] = useState<'3months' | '6months' | '12months' | 'all'>('all')
  const [retentionPeriod, setRetentionPeriod] = useState<'month' | 'quarter' | 'year'>('month')
  const [utilizationPeriod, setUtilizationPeriod] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('month')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'ltv' | 'retention' | 'employees'>('ltv')

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

    setLoading(true)
    Promise.all([
      fetch(`/api/analytics/ltv?businessId=${business.id}&period=${period}`)
        .then((res) => res.json())
        .catch(() => ({ clients: [], totalLTV: 0, averageLTV: 0, medianLTV: 0 })),
      fetch(`/api/analytics/retention?businessId=${business.id}&period=${retentionPeriod}`)
        .then((res) => res.json())
        .catch(() => null),
      fetch(`/api/analytics/employee-utilization?businessId=${business.id}&period=${utilizationPeriod}`)
        .then((res) => res.json())
        .catch(() => ({ masters: [], summary: {} })),
    ])
      .then(([ltvResponse, retentionResponse, employeeResponse]) => {
        setLtvData(ltvResponse.clients || [])
        setLtvStats({
          totalLTV: ltvResponse.totalLTV || 0,
          averageLTV: ltvResponse.averageLTV || 0,
          medianLTV: ltvResponse.medianLTV || 0,
          totalClients: ltvResponse.totalClients || 0,
        })
        setRetentionData(retentionResponse)
        setEmployeeData(employeeResponse.masters || [])
        setEmployeeStats(employeeResponse.summary || {})
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error loading analytics:', error)
        setLoading(false)
      })
  }, [business, period, retentionPeriod, utilizationPeriod])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100) // Конвертуємо з копійок
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
      <div className="p-3">
        <div className="max-w-7xl mx-auto">
          <div className="spacing-item">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h1 className="text-heading">Підприємницька аналітика</h1>
                <p className="text-caption font-medium">Розширені метрики та звіти</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 mb-2 bg-gray-100 dark:bg-gray-800 rounded-candy-sm border border-gray-200 dark:border-gray-700 p-1.5 overflow-x-auto">
            {(['ltv', 'retention', 'employees'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-3 py-1.5 rounded-candy-xs text-xs font-bold transition-all duration-200 active:scale-97 whitespace-nowrap',
                  activeTab === tab
                    ? 'candy-blue text-white shadow-soft-lg'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'
                )}
              >
                {tab === 'ltv' ? 'LTV клієнтів' : tab === 'retention' ? 'Утримання' : 'Співробітники'}
              </button>
            ))}
          </div>

          {/* LTV Tab */}
          {activeTab === 'ltv' && (
            <div className="space-y-4">
              {/* Period Selector */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-candy-sm border border-gray-200 dark:border-gray-700">
                {(['3months', '6months', '12months', 'all'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={cn(
                      'px-3 py-1.5 rounded-candy-xs text-xs font-bold transition-all',
                      period === p
                        ? 'candy-blue text-white shadow-soft-lg'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'
                    )}
                  >
                    {p === '3months' ? '3 міс.' : p === '6months' ? '6 міс.' : p === '12months' ? '12 міс.' : 'Всі'}
                  </button>
                ))}
              </div>

              {/* LTV Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                <MobileWidget
                  icon={<UsersIcon />}
                  title="Клієнти"
                  value={ltvStats?.totalClients || 0}
                  iconColor="blue"
                />
                <MobileWidget
                  icon={<MoneyIcon />}
                  title="Загальний LTV"
                  value={formatCurrency(ltvStats?.totalLTV || 0)}
                  iconColor="green"
                />
                <MobileWidget
                  icon={<TrendingUpIcon />}
                  title="Середній LTV"
                  value={formatCurrency(ltvStats?.averageLTV || 0)}
                  iconColor="orange"
                />
                <MobileWidget
                  icon={<TrendingUpIcon />}
                  title="Медіанний LTV"
                  value={formatCurrency(ltvStats?.medianLTV || 0)}
                  iconColor="purple"
                />
              </div>

              {/* Top Clients by LTV */}
              <div className="card-candy p-3 spacing-section overflow-hidden">
                <h2 className="text-subheading mb-3">Топ клієнти за LTV</h2>
                <div className="space-y-2">
                  {ltvData.slice(0, 20).map((client, index) => (
                    <div
                      key={client.clientId}
                      className={cn(
                        'flex items-center justify-between gap-3 p-2.5 rounded-candy-sm border overflow-hidden',
                        index % 4 === 0 ? 'bg-candy-blue/10 text-candy-blue border-candy-blue/30' :
                        index % 4 === 1 ? 'bg-candy-mint/10 text-candy-mint border-candy-mint/30' :
                        index % 4 === 2 ? 'bg-candy-pink/10 text-candy-pink border-candy-pink/30' :
                        'bg-candy-orange/10 text-candy-orange border-candy-orange/30'
                      )}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className={cn(
                          'w-8 h-8 rounded-candy-xs flex items-center justify-center text-white font-black text-xs flex-shrink-0',
                          index % 4 === 0 ? 'candy-blue' :
                          index % 4 === 1 ? 'candy-mint' :
                          index % 4 === 2 ? 'candy-pink' : 'candy-orange'
                        )}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-foreground dark:text-white truncate">
                            {client.clientName}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {client.clientPhone} • {client.totalAppointments} візитів
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-base font-black text-foreground dark:text-white">
                          {formatCurrency(client.ltv)}
                        </div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-400">
                          LTV
                        </div>
                      </div>
                    </div>
                  ))}
                  {ltvData.length === 0 && (
                    <p className="text-caption text-center py-4">Немає даних про LTV</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Retention Tab */}
          {activeTab === 'retention' && retentionData && (
            <div className="space-y-4">
              {/* Period Selector */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-candy-sm border border-gray-200 dark:border-gray-700">
                {(['month', 'quarter', 'year'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setRetentionPeriod(p)}
                    className={cn(
                      'px-3 py-1.5 rounded-candy-xs text-xs font-bold transition-all',
                      retentionPeriod === p
                        ? 'candy-blue text-white shadow-soft-lg'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'
                    )}
                  >
                    {p === 'month' ? 'Місяць' : p === 'quarter' ? 'Квартал' : 'Рік'}
                  </button>
                ))}
              </div>

              {/* Retention Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                <MobileWidget
                  icon={<UsersIcon />}
                  title="Базова когорта"
                  value={retentionData.baseCohort.totalClients}
                  iconColor="blue"
                />
                <MobileWidget
                  icon={<CheckIcon />}
                  title="Активні клієнти"
                  value={retentionData.baseCohort.activeClients}
                  iconColor="green"
                />
                <MobileWidget
                  icon={<TrendingUpIcon />}
                  title="Retention Rate"
                  value={`${retentionData.baseCohort.retentionRate.toFixed(1)}%`}
                  iconColor="green"
                />
                <MobileWidget
                  icon={<TrendingDownIcon />}
                  title="Churn Rate"
                  value={`${retentionData.baseCohort.churnRate.toFixed(1)}%`}
                  iconColor="pink"
                />
              </div>

              {/* Monthly Retention Chart */}
              <div className="card-candy p-3 spacing-section overflow-hidden">
                <h2 className="text-subheading mb-3">Retention по місяцях</h2>
                <div className="space-y-2">
                  {retentionData.monthlyRetention.map((month, index) => (
                    <div
                      key={month.month}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-candy-sm border bg-candy-blue/10 text-candy-blue border-candy-blue/30"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-black text-foreground dark:text-white">
                          {format(new Date(month.month), 'MMMM yyyy', { locale: uk })}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {month.activeClients} з {month.cohortSize} активні
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-black text-foreground dark:text-white">
                          {month.retentionRate.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Employees Tab */}
          {activeTab === 'employees' && (
            <div className="space-y-4">
              {/* Period Selector */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-candy-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
                {(['day', 'week', 'month', 'quarter', 'year'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setUtilizationPeriod(p)}
                    className={cn(
                      'px-3 py-1.5 rounded-candy-xs text-xs font-bold transition-all whitespace-nowrap',
                      utilizationPeriod === p
                        ? 'candy-blue text-white shadow-soft-lg'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'
                    )}
                  >
                    {p === 'day' ? 'День' : p === 'week' ? 'Тиждень' : p === 'month' ? 'Місяць' : p === 'quarter' ? 'Квартал' : 'Рік'}
                  </button>
                ))}
              </div>

              {/* Employee Stats */}
              {employeeStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                  <MobileWidget
                    icon={<UsersIcon />}
                    title="Співробітники"
                    value={employeeStats.totalMasters || 0}
                    iconColor="blue"
                  />
                  <MobileWidget
                    icon={<CalendarIcon />}
                    title="Записи"
                    value={employeeStats.totalAppointments || 0}
                    iconColor="orange"
                  />
                  <MobileWidget
                    icon={<MoneyIcon />}
                    title="Дохід"
                    value={formatCurrency(employeeStats.totalRevenue || 0)}
                    iconColor="green"
                  />
                  <MobileWidget
                    icon={<TrendingUpIcon />}
                    title="Середнє використання"
                    value={`${employeeStats.averageUtilization?.toFixed(1) || 0}%`}
                    iconColor="purple"
                  />
                </div>
              )}

              {/* Employee List */}
              <div className="card-candy p-3 spacing-section overflow-hidden">
                <h2 className="text-subheading mb-3">Метрики співробітників</h2>
                <div className="space-y-2">
                  {employeeData.map((employee, index) => (
                    <div
                      key={employee.masterId}
                      className={cn(
                        'flex items-center justify-between gap-3 p-2.5 rounded-candy-sm border overflow-hidden',
                        index % 4 === 0 ? 'bg-candy-blue/10 text-candy-blue border-candy-blue/30' :
                        index % 4 === 1 ? 'bg-candy-mint/10 text-candy-mint border-candy-mint/30' :
                        index % 4 === 2 ? 'bg-candy-pink/10 text-candy-pink border-candy-pink/30' :
                        'bg-candy-orange/10 text-candy-orange border-candy-orange/30'
                      )}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {employee.photo && (
                          <img
                            src={employee.photo}
                            alt={employee.masterName}
                            className="w-10 h-10 rounded-candy-xs object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-foreground dark:text-white truncate">
                            {employee.masterName}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {employee.totalWorkedHours.toFixed(1)} год. / {employee.availableHours.toFixed(1)} год.
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-base font-black text-foreground dark:text-white">
                          {employee.utilizationRate.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-gray-600 dark:text-gray-400">
                          використання
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {formatCurrency(employee.totalRevenue)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {employeeData.length === 0 && (
                    <p className="text-caption text-center py-4">Немає даних про співробітників</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


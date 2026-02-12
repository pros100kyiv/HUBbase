'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarIcon, CheckIcon, XIcon, MoneyIcon, UsersIcon, ChartIcon, LightBulbIcon, TargetIcon, ChevronRightIcon, FileTextIcon, UserIcon, StarIcon, ClockIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { format, subDays } from 'date-fns'
import { MonthProgressCard } from '@/components/admin/MonthProgressCard'
import { Modal } from '@/components/ui/modal'
import { toast } from '@/components/ui/toast'

type DetailSection = {
  title?: string
  items?: Array<{ label: string; value: React.ReactNode; sub?: string }>
  content?: React.ReactNode
}

type DetailSlot = {
  title: string
  value: React.ReactNode
  explanation: string
  tip?: string
  /** Додаткові блоки з детальною інформацією */
  sections?: DetailSection[]
  /** Дія «Переглянути записи» — перехід на сторінку записів з фільтром */
  action?: { label: string; url: string }
}

const REFRESH_INTERVAL_MS = 120_000 // 2 хв — економія compute (Neon sleep)

interface Service {
  id: string
  name: string
  price: number
}

interface Master {
  id: string
  name: string
}

async function fetchJson<T>(url: string): Promise<{ ok: boolean; data: T | null; error?: string }> {
  const res = await fetch(url)
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const error = (data as { error?: string })?.error || res.statusText
    const details = (data as { details?: string })?.details
    if (details) console.error('API error details:', url, details)
    return { ok: false, data: null, error }
  }
  return { ok: true, data: data as T }
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
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'revenue' | 'clients' | 'services' | 'masters'>('overview')
  const [trendsVisibleCount, setTrendsVisibleCount] = useState(7)
  const TRENDS_PAGE_SIZE = 7
  const [detailSlot, setDetailSlot] = useState<DetailSlot | null>(null)

  const loadData = useCallback(async (isSilent = false) => {
    if (!business?.id) return
    if (!isSilent) setRefreshing(true)
    setApiError(null)

    const base = `/api`
    const [statsRes, advancedRes, servicesRes, mastersRes] = await Promise.all([
      fetchJson<any>(`${base}/statistics?businessId=${business.id}&period=${period}`),
      fetchJson<any>(`${base}/analytics/advanced?businessId=${business.id}&period=${period}`),
      fetchJson<Service[]>(`${base}/services?businessId=${business.id}`),
      fetchJson<Master[]>(`${base}/masters?businessId=${business.id}`),
    ])

    const errors: string[] = []
    if (!statsRes.ok) errors.push(statsRes.error || 'Статистика')
    if (!advancedRes.ok) errors.push(advancedRes.error || 'Аналітика')
    if (!servicesRes.ok) errors.push(servicesRes.error || 'Послуги')
    if (!mastersRes.ok) errors.push(mastersRes.error || 'Спеціалісти')

    if (errors.length > 0) {
      setApiError(errors.join(', '))
      if (!isSilent) setLoading(false)
    } else {
      if (statsRes.data != null) setStats(statsRes.data)
      if (advancedRes.data != null) setAdvancedStats(advancedRes.data)
      setServices(Array.isArray(servicesRes.data) ? servicesRes.data : [])
      setMasters(Array.isArray(mastersRes.data) ? mastersRes.data : [])
      setLastUpdated(new Date())
    }
    setLoading(false)
    setRefreshing(false)
  }, [business?.id, period])

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
  }, [business, period, loadData])

  // Скидати видиму кількість трендів при зміні даних (період/оновлення)
  useEffect(() => {
    setTrendsVisibleCount(TRENDS_PAGE_SIZE)
  }, [advancedStats?.dailyTrends?.length, period])

  // Оновлення в реальному часі: інтервал
  useEffect(() => {
    if (!business?.id) return
    const interval = setInterval(() => loadData(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [business?.id, period, loadData])

  // Оновлення при поверненні на вкладку
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && business?.id) loadData(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [business?.id, loadData])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(amount))
  }

  if (!business || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-gray-500">Завантаження...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto min-w-0 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-6 min-w-0 w-full">
        <div className="lg:col-span-3 space-y-3 md:space-y-6 min-w-0">
          {/* Header - same as Dashboard */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
                Аналітика
              </h1>
              {lastUpdated && (
                <p className="text-xs text-gray-400 mt-1">
                  Оновлено о {format(lastUpdated, 'HH:mm')}
                  {refreshing && ' • оновлення…'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => loadData()}
                disabled={refreshing}
                title={lastUpdated ? `Останнє оновлення: ${format(lastUpdated, 'dd.MM.yyyy HH:mm')}` : 'Оновити дані'}
                className="px-3 py-2 rounded-lg text-sm font-medium border border-white/20 bg-white/10 text-white hover:bg-white/20 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <span className={cn('transition-transform', refreshing && 'animate-pulse')}>↻</span>
                {refreshing ? 'Оновлення…' : 'Оновити'}
              </button>
              {(['day', 'week', 'month'] as const).map((p) => {
                const today = new Date()
                const rangeLabel = p === 'day'
                  ? format(today, 'dd.MM.yyyy')
                  : p === 'week'
                    ? `${format(subDays(today, 6), 'dd.MM')} – ${format(today, 'dd.MM.yyyy')}`
                    : `${format(subDays(today, 29), 'dd.MM')} – ${format(today, 'dd.MM.yyyy')}`
                return (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    title={`Період: ${rangeLabel}`}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5',
                      period === p ? 'bg-white text-black' : 'border border-white/20 bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                    )}
                    style={period === p ? { boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' } : {}}
                  >
                    {p === 'day' ? 'День' : p === 'week' ? 'Тиждень' : 'Місяць'}
                  </button>
                )
              })}
            </div>
          </div>

          {apiError && (
            <div className="rounded-xl p-3 bg-red-500/20 border border-red-400/30 text-red-200 text-sm">
              Помилка завантаження: {apiError}. Спробуйте натиснути «Оновити».
            </div>
          )}

          {/* Підказка періоду */}
          <div className="rounded-xl p-3 card-glass border border-white/10 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm text-gray-400">
              Період: <span className="font-medium text-white">{period === 'day' ? 'сьогодні' : period === 'week' ? 'останні 7 днів' : 'останні 30 днів'}</span>
              <span className="text-gray-500 ml-1">(від реєстрації акаунта)</span>
            </span>
            {!advancedStats && !loading && !apiError && (
              <span className="text-xs text-amber-400">Розширена аналітика завантажується…</span>
            )}
          </div>

          {/* Tabs */}
          <div className="rounded-xl p-4 md:p-6 card-glass">
            <div className="flex gap-2 flex-wrap">
              {([
                { key: 'overview', label: 'Огляд', icon: ChartIcon },
                { key: 'revenue', label: 'Прибуток', icon: MoneyIcon },
                { key: 'clients', label: 'Клієнти', icon: UsersIcon },
                { key: 'services', label: 'Послуги', icon: StarIcon },
                { key: 'masters', label: 'Спеціалісти', icon: UserIcon },
              ] as const).map(({ key: tab, label, icon: Icon }) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  title={`Вкладка «${label}»`}
                  className={cn(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
                    activeTab === tab ? 'bg-white text-black' : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white border border-white/10'
                  )}
                  style={activeTab === tab ? { boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' } : {}}
                >
                  <Icon className={cn('w-4 h-4', activeTab === tab ? 'text-black' : 'text-gray-400')} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && !advancedStats && (
            <div className="rounded-xl p-6 md:p-8 card-glass text-center">
              <p className="text-gray-400">Завантаження розширеної аналітики…</p>
              <p className="text-sm text-gray-500 mt-1">Якщо дані не зʼявляються, натисніть «Оновити».</p>
            </div>
          )}
          {activeTab === 'overview' && advancedStats && (
            <div className="space-y-3 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <button
                  type="button"
                  onClick={() => setDetailSlot({
                    title: 'Поточний прибуток',
                    value: formatCurrency(advancedStats.currentRevenue || 0),
                    explanation: 'Сума грошей від записів зі статусом «Виконано» за обраний період. Це фактичний дохід, який ви вже отримали.',
                    tip: 'Чим вища частка виконаних записів від підтверджених, тим стабільніший потік виручки.',
                    sections: [
                      ...(advancedStats.serviceAnalysis?.length ? [{
                        title: 'За послугами',
                        items: advancedStats.serviceAnalysis.slice(0, 5).map((s: any) => ({
                          label: s.serviceName,
                          value: formatCurrency(s.revenue ?? 0),
                          sub: `${s.bookings ?? 0} записів · ${(s.popularity ?? 0).toFixed(0)}%`,
                        })),
                      }] : []),
                      ...(advancedStats.masterUtilization?.length ? [{
                        title: 'За спеціалістами',
                        items: advancedStats.masterUtilization.slice(0, 5).map((m: any) => ({
                          label: m.masterName,
                          value: formatCurrency(m.revenue ?? 0),
                          sub: `${m.appointments ?? 0} записів`,
                        })),
                      }] : []),
                      ...(advancedStats.sourceAnalysis && Object.keys(advancedStats.sourceAnalysis).length ? [{
                        title: 'За джерелами записів',
                        items: Object.entries(advancedStats.sourceAnalysis).map(([src, d]: [string, any]) => ({
                          label: src === 'qr' ? 'QR код' : src === 'link' ? 'Посилання' : src === 'unknown' ? 'Інше' : src,
                          value: formatCurrency(d?.revenue ?? 0),
                          sub: `${d?.count ?? 0} записів`,
                        })),
                      }] : []),
                    ].filter(Boolean),
                  })}
                  className="rounded-xl p-4 md:p-6 card-glass text-left w-full flex flex-col items-start hover:ring-2 hover:ring-white/20 hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="text-xs text-gray-400">Поточний прибуток</span>
                    <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-purple-400 mt-1">{formatCurrency(advancedStats.currentRevenue || 0)}</div>
                  <div className="text-xs text-gray-500 mt-1">Виконані записи</div>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailSlot({
                    title: 'Прогнозований прибуток',
                    value: formatCurrency(advancedStats.forecastedRevenue || 0),
                    explanation: 'Очікуваний дохід від записів у статусі «Підтверджено». Показує суму, яку клієнти вже підтвердили; прийде після виконання записів.',
                    tip: 'Порівнюйте з поточним прибутком: велика різниця означає багато майбутніх візитів.',
                    sections: [
                      {
                        title: 'Порівняння з фактичним доходом',
                        items: [
                          { label: 'Поточний (виконано)', value: formatCurrency(advancedStats.currentRevenue || 0) },
                          { label: 'Прогнозований (підтверджено)', value: formatCurrency(advancedStats.forecastedRevenue || 0) },
                          {
                            label: 'Різниця',
                            value: (advancedStats.currentRevenue || 0) < (advancedStats.forecastedRevenue || 0) ? `+${formatCurrency((advancedStats.forecastedRevenue || 0) - (advancedStats.currentRevenue || 0))}` : formatCurrency((advancedStats.forecastedRevenue || 0) - (advancedStats.currentRevenue || 0)),
                            sub: (advancedStats.currentRevenue || 0) > 0 ? `~${Math.round(((advancedStats.forecastedRevenue || 0) - (advancedStats.currentRevenue || 0)) / (advancedStats.currentRevenue || 0) * 100)}% від поточного` : undefined,
                          },
                        ],
                      },
                    ],
                  })}
                  className="rounded-xl p-4 md:p-6 card-glass text-left w-full flex flex-col items-start hover:ring-2 hover:ring-white/20 hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="text-xs text-gray-400">Прогнозований прибуток</span>
                    <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-blue-400 mt-1">{formatCurrency(advancedStats.forecastedRevenue || 0)}</div>
                  <div className="text-xs text-gray-500 mt-1">Підтверджені записи</div>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailSlot({
                    title: 'Прогноз на наступний період',
                    value: formatCurrency(advancedStats.forecastNextPeriod || 0),
                    explanation: 'Оцінка доходу на наступний період, розрахована на основі середньоденного доходу за поточний період. Допомагає планувати витрати та очікування.',
                    tip: advancedStats.forecastGrowth !== 0
                      ? (advancedStats.forecastGrowth > 0 ? 'Позитивний тренд — варто підтримувати поточну стратегію записів.' : 'Варто активізувати запрошення клієнтів або акції.')
                      : undefined,
                    sections: [
                      {
                        title: 'Розрахунок',
                        items: [
                          {
                            label: 'Середній дохід за день',
                            value: formatCurrency(advancedStats.dailyTrends?.length ? Math.round(advancedStats.dailyTrends.reduce((s: number, d: any) => s + (d.revenue ?? 0), 0) / advancedStats.dailyTrends.length) : 0),
                            sub: `За ${advancedStats.dailyTrends?.length ?? 0} днів періоду`,
                          },
                          {
                            label: 'Тренд',
                            value: (advancedStats.forecastGrowth ?? 0) > 0 ? `+${advancedStats.forecastGrowth}%` : `${advancedStats.forecastGrowth}%`,
                            sub: 'Порівняно з поточним vs прогнозованим',
                          },
                        ],
                      },
                      ...(advancedStats.dailyTrends?.length ? [{
                        title: 'Топ дні за доходом',
                        items: [...advancedStats.dailyTrends]
                          .sort((a: any, b: any) => (b.revenue ?? 0) - (a.revenue ?? 0))
                          .slice(0, 5)
                          .map((d: any) => ({
                            label: d.dateLabel ?? d.date ?? '-',
                            value: formatCurrency(d.revenue ?? 0),
                            sub: `${d.completed ?? 0} виконаних записів`,
                          })),
                      }] : []),
                    ].filter(Boolean),
                  })}
                  className="rounded-xl p-4 md:p-6 card-glass text-left w-full flex flex-col items-start hover:ring-2 hover:ring-white/20 hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span className="text-xs text-gray-400">Прогноз на наступний період</span>
                    <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-purple-400 mt-1">{formatCurrency(advancedStats.forecastNextPeriod || 0)}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {advancedStats.forecastGrowth > 0 ? <span className="text-green-400">+{advancedStats.forecastGrowth}%</span> : <span className="text-red-400">{advancedStats.forecastGrowth}%</span>}
                  </div>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <button
                  type="button"
                  onClick={() => setDetailSlot({
                    title: 'Цінність клієнта (LTV)',
                    value: formatCurrency(advancedStats.avgLTV || 0),
                    explanation: 'LTV (Lifetime Value) — оцінка того, скільки в середньому приносить один клієнт за період. Рахується на основі витрат клієнтів та їх відвідувань.',
                    tip: 'Високий LTV означає, що клієнти часто повертаються та витрачають більше. Корисно для оцінки ефективності лояльності та акцій.',
                    sections: [
                      {
                        title: 'Як рахується',
                        items: [
                          { label: 'База розрахунку', value: `${advancedStats.totalClients ?? 0} клієнтів`, sub: 'Усі, хто колись робив запис' },
                          { label: 'Активні за 90 днів', value: String(advancedStats.activeClients ?? 0), sub: 'Відвідували за останні 3 місяці' },
                          {
                            label: 'Формула',
                            value: '≈ середній чек × візити/міс × 12',
                            sub: 'Оцінка цінності клієнта на рік',
                          },
                        ],
                      },
                      {
                        title: 'Поради для зростання LTV',
                        items: [
                          { label: 'Перехресні продажі', value: 'Пропонуйте доп. послуги під час візиту' },
                          { label: 'Нагадування', value: 'SMS/Email перед візитом знижують no-show' },
                          { label: 'Програма лояльності', value: 'Знижки за повторні візити' },
                        ],
                      },
                    ],
                  })}
                  className="rounded-xl p-4 md:p-6 card-glass text-left w-full hover:ring-2 hover:ring-white/20 hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer group"
                >
                  <h3 className="text-base font-semibold text-white mb-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><TargetIcon className="w-5 h-5 text-purple-400" />Цінність клієнта (LTV)</span>
                    <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                  </h3>
                  <div className="text-2xl md:text-3xl font-bold text-purple-400">{formatCurrency(advancedStats.avgLTV || 0)}</div>
                  <div className="text-xs text-gray-500 mt-1">Оцінка вартості клієнта за період</div>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailSlot({
                    title: 'Утримання клієнтів',
                    value: `${Math.round(advancedStats.retentionRate || 0)}%`,
                    explanation: 'Відсоток клієнтів, які були активні за останні 90 днів (мали хоча б один запис). Показує, наскільки добре ви утримуєте клієнтів.',
                    tip: `Активні клієнти: ${advancedStats.activeClients ?? 0} з ${advancedStats.totalClients ?? 0} загалом. Високий відсоток — ознака здорової бази та повторних візитів.`,
                    sections: [
                      {
                        title: 'Розбивка бази',
                        items: [
                          { label: 'Активні (90 днів)', value: String(advancedStats.activeClients ?? 0), sub: 'Мають візит за останні 3 місяці' },
                          { label: 'Неактивні', value: String(Math.max(0, (advancedStats.totalClients ?? 0) - (advancedStats.activeClients ?? 0))), sub: 'Без візитів понад 90 днів' },
                          { label: 'Всього в базі', value: String(advancedStats.totalClients ?? 0) },
                        ],
                      },
                      {
                        title: 'Рекомендації',
                        items: [
                          { label: 'Підтримувати >40%', value: 'Добре утримання', sub: 'База активна' },
                          { label: '20–40%', value: 'Середній рівень', sub: 'Розгляньте reactivation-кампанії' },
                          { label: '<20%', value: 'Потрібна увага', sub: 'Нагадування, акції для повернення' },
                        ],
                      },
                    ],
                  })}
                  className="rounded-xl p-4 md:p-6 card-glass text-left w-full hover:ring-2 hover:ring-white/20 hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer group"
                >
                  <h3 className="text-base font-semibold text-white mb-3 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><UsersIcon className="w-5 h-5 text-blue-400" />Утримання клієнтів</span>
                    <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                  </h3>
                  <div className="text-2xl md:text-3xl font-bold text-blue-400">{Math.round(advancedStats.retentionRate || 0)}%</div>
                  <div className="text-xs text-gray-500 mt-1">Активні: {advancedStats.activeClients ?? 0} / {advancedStats.totalClients ?? 0}</div>
                </button>
              </div>
              {advancedStats.conversionFunnel && (
                <div className="chart-container">
                  <h3 className="chart-title">Воронка конверсії</h3>
                  <p className="text-xs text-gray-500 mb-3">Натисніть на показник, щоб дізнатися деталі</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button
                      type="button"
                      onClick={() => setDetailSlot({
                        title: 'Всього записів',
                        value: String(advancedStats.conversionFunnel.total ?? 0),
                        explanation: 'Загальна кількість записів за обраний період у всіх статусах. Включає нові, підтверджені, виконані та скасовані.',
                        tip: 'Базовий показник для оцінки навантаження та порівняння з попередніми періодами.',
                        action: { label: 'Переглянути записи', url: '/dashboard/appointments' },
                        sections: [{
                          title: 'Воронка конверсії',
                          items: [
                            { label: 'Підтверджено', value: `${advancedStats.conversionFunnel.confirmed ?? 0} (${Math.round(advancedStats.conversionFunnel.confirmationRate ?? 0)}%)`, sub: 'від загалу' },
                            { label: 'Виконано', value: `${advancedStats.conversionFunnel.completed ?? 0} (${Math.round(advancedStats.conversionFunnel.completionRate ?? 0)}%)`, sub: 'від підтверджених' },
                            { label: 'Скасовано', value: `${advancedStats.conversionFunnel.cancelled ?? 0} (${Math.round(advancedStats.conversionFunnel.cancellationRate ?? 0)}%)`, sub: 'від загалу' },
                          ],
                        }],
                      })}
                      className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer text-left group"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs text-gray-400 uppercase tracking-wide">Всього</span>
                        <ChevronRightIcon className="w-3.5 h-3.5 text-gray-500 group-hover:text-white shrink-0" />
                      </div>
                      <div className="text-xl font-bold text-white tabular-nums mt-1">{advancedStats.conversionFunnel.total ?? 0}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailSlot({
                        title: 'Підтверджено',
                        value: `${advancedStats.conversionFunnel.confirmed ?? 0} (${Math.round(advancedStats.conversionFunnel.confirmationRate ?? 0)}%)`,
                        explanation: 'Кількість записів, які клієнт або адмін підтвердив. Це етап після створення запису — клієнт погодився прийти.',
                        tip: 'Високий відсоток підтверджень від загальної кількості означає хорошу якість ліду та менше «no-show».',
                        action: { label: 'Переглянути підтверджені записи', url: '/dashboard/appointments?status=Confirmed' },
                        sections: [{
                          title: 'Етапи воронки',
                          items: [
                            { label: 'Очікуваний дохід', value: formatCurrency(advancedStats.forecastedRevenue ?? 0), sub: 'від підтверджених записів' },
                            { label: 'Конверсія в виконані', value: `${Math.round(advancedStats.conversionFunnel.completionRate ?? 0)}%`, sub: 'серед підтверджених' },
                            { label: 'Норма', value: '>70%', sub: 'хороший показник підтверджень' },
                          ],
                        }],
                      })}
                      className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-blue-400/30 hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer text-left group"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs text-gray-400 uppercase tracking-wide">Підтверджено</span>
                        <ChevronRightIcon className="w-3.5 h-3.5 text-gray-500 group-hover:text-white shrink-0" />
                      </div>
                      <div className="text-xl font-bold text-blue-400 tabular-nums mt-1">{advancedStats.conversionFunnel.confirmed ?? 0} <span className="text-sm font-medium text-gray-400">({Math.round(advancedStats.conversionFunnel.confirmationRate ?? 0)}%)</span></div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailSlot({
                        title: 'Виконано',
                        value: `${advancedStats.conversionFunnel.completed ?? 0} (${Math.round(advancedStats.conversionFunnel.completionRate ?? 0)}%)`,
                        explanation: 'Записи, які відбулися та були відмічені як виконані. Саме з них формується фактичний дохід.',
                        tip: 'Високий % виконання від підтверджених — ознака пунктуальності клієнтів та правильної комунікації (нагадування тощо).',
                        action: { label: 'Переглянути виконані записи', url: '/dashboard/appointments?status=Done' },
                        sections: [{
                          title: 'Показники виконання',
                          items: [
                            { label: 'Фактичний дохід', value: formatCurrency(advancedStats.currentRevenue ?? 0), sub: 'від цих записів' },
                            { label: 'Середній чек', value: (advancedStats.conversionFunnel.completed ?? 0) > 0 ? formatCurrency(Math.round((advancedStats.currentRevenue ?? 0) / (advancedStats.conversionFunnel.completed ?? 0))) : formatCurrency(0), sub: 'на виконаний запис' },
                            { label: 'Норма completion rate', value: '>80%', sub: 'від підтверджених до виконаних' },
                          ],
                        }],
                      })}
                      className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-green-400/30 hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer text-left group"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs text-gray-400 uppercase tracking-wide">Виконано</span>
                        <ChevronRightIcon className="w-3.5 h-3.5 text-gray-500 group-hover:text-white shrink-0" />
                      </div>
                      <div className="text-xl font-bold text-purple-400 tabular-nums mt-1">{advancedStats.conversionFunnel.completed ?? 0} <span className="text-sm font-medium text-gray-400">({Math.round(advancedStats.conversionFunnel.completionRate ?? 0)}%)</span></div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailSlot({
                        title: 'Скасовано',
                        value: `${advancedStats.conversionFunnel.cancelled ?? 0} (${Math.round(advancedStats.conversionFunnel.cancellationRate ?? 0)}%)`,
                        explanation: 'Записи, які були скасовані (клієнтом, адміном або системою). Не входять у дохід.',
                        tip: 'Високий відсоток скасувань варто аналізувати: причини, час скасування, нагадування — щоб зменшити втрати.',
                        action: { label: 'Переглянути скасовані записи', url: '/dashboard/appointments?status=Cancelled' },
                        sections: [{
                          title: 'Що робити при високому % скасувань',
                          items: [
                            { label: 'Нагадування', value: 'SMS/Email за 1–2 дні до візиту', sub: 'знижують no-show' },
                            { label: 'Підтвердження', value: 'Запитайте клієнта підтвердити візит', sub: 'ще до дати' },
                            { label: 'Норма', value: '<15%', sub: 'прийнятний % скасувань' },
                          ],
                        }],
                      })}
                      className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-red-400/30 hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer text-left group"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs text-gray-400 uppercase tracking-wide">Скасовано</span>
                        <ChevronRightIcon className="w-3.5 h-3.5 text-gray-500 group-hover:text-white shrink-0" />
                      </div>
                      <div className="text-xl font-bold text-red-400 tabular-nums mt-1">{advancedStats.conversionFunnel.cancelled ?? 0} <span className="text-sm font-medium text-gray-400">({Math.round(advancedStats.conversionFunnel.cancellationRate ?? 0)}%)</span></div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Revenue Tab */}
          {activeTab === 'revenue' && advancedStats && (
            <div className="space-y-3 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="rounded-xl p-4 md:p-6 card-glass">
                  <h3 className="text-base font-semibold text-white mb-4">Аналіз джерел</h3>
                  <p className="text-xs text-gray-500 mb-2">Натисніть на джерело для деталей</p>
                  {advancedStats.sourceAnalysis && Object.keys(advancedStats.sourceAnalysis).length > 0 ? (
                    Object.entries(advancedStats.sourceAnalysis).map(([source, data]: [string, any]) => {
                      const label = source === 'qr' ? 'QR код' : source === 'link' ? 'Посилання' : source === 'unknown' ? 'Не вказано' : source
                      return (
                        <button
                          key={source}
                          type="button"
                          onClick={() => {
                            const totalRev = Object.values(advancedStats.sourceAnalysis || {}).reduce((s: number, d: any) => s + (d?.revenue ?? 0), 0)
                            const totalCnt = Object.values(advancedStats.sourceAnalysis || {}).reduce((s: number, d: any) => s + (d?.count ?? 0), 0)
                            const revShare = totalRev > 0 ? Math.round(((data?.revenue ?? 0) / totalRev) * 100) : 0
                            const cntShare = totalCnt > 0 ? Math.round(((data?.count ?? 0) / totalCnt) * 100) : 0
                            setDetailSlot({
                              title: `Джерело: ${label}`,
                              value: formatCurrency(data?.revenue ?? 0),
                              explanation: `Записи, створені через це джерело: ${data?.count ?? 0} записів за період. Дохід — сума від виконаних записів з цього джерела. Допомагає зрозуміти, звідки приходить більшість клієнтів.`,
                              tip: 'QR та посилання часто означають онлайн-запис; «Не вказано» — запис створений вручну або з іншого каналу.',
                              sections: [
                                {
                                  title: 'Частка від загалу',
                                  items: [
                                    { label: 'Дохід', value: `${revShare}%`, sub: `${formatCurrency(data?.revenue ?? 0)} з ${formatCurrency(totalRev)}` },
                                    { label: 'Записи', value: `${cntShare}%`, sub: `${data?.count ?? 0} з ${totalCnt}` },
                                  ],
                                },
                                ...(Object.keys(advancedStats.sourceAnalysis || {}).length > 1 ? [{
                                  title: 'Інші джерела',
                                  items: Object.entries(advancedStats.sourceAnalysis || {})
                                    .filter(([k]) => k !== source)
                                    .map(([k, d]: [string, any]) => ({
                                      label: k === 'qr' ? 'QR код' : k === 'link' ? 'Посилання' : k === 'unknown' ? 'Не вказано' : k,
                                      value: formatCurrency(d?.revenue ?? 0),
                                      sub: `${d?.count ?? 0} записів`,
                                    })),
                                }] : []),
                              ].filter(Boolean),
                            })
                          }}
                          className="w-full flex justify-between items-center p-3 border-b border-white/10 last:border-0 hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-left group"
                        >
                          <div>
                            <div className="font-medium text-white">{label}</div>
                            <div className="text-xs text-gray-400">{data?.count ?? 0} записів</div>
                          </div>
                          <div className="font-semibold text-purple-400 flex items-center gap-1">
                            {formatCurrency(data?.revenue ?? 0)}
                            <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                          </div>
                        </button>
                      )
                    })
                  ) : (
                    <p className="text-sm text-gray-400 py-4">Немає даних про джерела записів за період</p>
                  )}
                </div>
                <div className="rounded-xl p-4 md:p-6 card-glass">
                  <h3 className="text-base font-semibold text-white mb-4">Прогноз</h3>
                  <p className="text-xs text-gray-500 mb-2">Натисніть на показник для деталей</p>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setDetailSlot({
                        title: 'Поточний прибуток',
                        value: formatCurrency(advancedStats.currentRevenue || 0),
                        explanation: 'Сума від виконаних записів за період. Фактичний дохід.',
                        tip: 'Див. також вкладку «Огляд» для розбивки по послугах та спеціалістах.',
                        sections: [
                          ...(advancedStats.serviceAnalysis?.length ? [{
                            title: 'За послугами',
                            items: advancedStats.serviceAnalysis.slice(0, 5).map((s: any) => ({
                              label: s.serviceName,
                              value: formatCurrency(s.revenue ?? 0),
                              sub: `${s.bookings ?? 0} записів`,
                            })),
                          }] : []),
                        ].filter(Boolean),
                      })}
                      className="w-full p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Поточний прибуток</span>
                        <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                      </div>
                      <div className="text-xl font-bold text-purple-400 mt-1">{formatCurrency(advancedStats.currentRevenue || 0)}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailSlot({
                        title: 'Прогнозований прибуток',
                        value: formatCurrency(advancedStats.forecastedRevenue || 0),
                        explanation: 'Очікуваний дохід від підтверджених записів. Прийде після виконання.',
                        tip: 'Порівняйте з поточним для оцінки майбутнього потоку.',
                        sections: [{
                          title: 'Порівняння',
                          items: [
                            { label: 'Поточний', value: formatCurrency(advancedStats.currentRevenue || 0) },
                            { label: 'Прогнозований', value: formatCurrency(advancedStats.forecastedRevenue || 0) },
                          ],
                        }],
                      })}
                      className="w-full p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Прогнозований</span>
                        <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                      </div>
                      <div className="text-xl font-bold text-blue-400 mt-1">{formatCurrency(advancedStats.forecastedRevenue || 0)}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailSlot({
                        title: 'Прогноз на наступний період',
                        value: formatCurrency(advancedStats.forecastNextPeriod || 0),
                        explanation: 'Оцінка доходу на наступний період на основі середньоденного доходу. Ріст або падіння у % показує тренд.',
                        tip: advancedStats.forecastGrowth > 0 ? 'Позитивний тренд — підтримуйте поточну стратегію.' : advancedStats.forecastGrowth < 0 ? 'Варто активізувати запрошення та акції.' : undefined,
                        sections: advancedStats.dailyTrends?.length ? [{
                          title: 'Топ дні',
                          items: [...advancedStats.dailyTrends].sort((a: any, b: any) => (b.revenue ?? 0) - (a.revenue ?? 0)).slice(0, 5).map((d: any) => ({
                            label: d.dateLabel ?? d.date ?? '-',
                            value: formatCurrency(d.revenue ?? 0),
                            sub: `${d.completed ?? 0} записів`,
                          })),
                        }] : undefined,
                      })}
                      className="w-full p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">На наступний період</span>
                        <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                      </div>
                      <div className="text-xl font-bold text-purple-400 mt-1">{formatCurrency(advancedStats.forecastNextPeriod || 0)}</div>
                      {advancedStats.forecastGrowth !== 0 && (
                        <div className={`text-sm mt-1 ${advancedStats.forecastGrowth > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {advancedStats.forecastGrowth > 0 ? '↑' : '↓'} {Math.abs(advancedStats.forecastGrowth)}%
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Clients Tab */}
          {activeTab === 'clients' && advancedStats && (
            <div className="space-y-3 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="rounded-xl p-4 md:p-6 card-glass">
                  <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2"><UsersIcon className="w-5 h-5 text-purple-400" /> Клієнти</h3>
                  <p className="text-xs text-gray-500 mb-2">Натисніть для деталей</p>
                  <button
                    type="button"
                    onClick={() => setDetailSlot({
                      title: 'Всього клієнтів',
                      value: String(advancedStats.totalClients ?? 0),
                      explanation: 'Загальна кількість клієнтів у вашій базі (усі, хто колись робив запис).',
                      tip: 'База зростає з кожним новим клієнтом.',
                      sections: [{
                        title: 'Структура бази',
                        items: [
                          { label: 'Активні (90 днів)', value: String(advancedStats.activeClients ?? 0), sub: 'були на візиті' },
                          { label: 'Неактивні', value: String(Math.max(0, (advancedStats.totalClients ?? 0) - (advancedStats.activeClients ?? 0))), sub: '>90 днів без візиту' },
                        ],
                      }],
                    })}
                    className="w-full p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer text-left group mb-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Всього клієнтів</span>
                      <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                    </div>
                    <div className="text-2xl font-bold text-white mt-1">{advancedStats.totalClients ?? 0}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailSlot({
                      title: 'Активні клієнти (90 днів)',
                      value: String(advancedStats.activeClients ?? 0),
                      explanation: 'Клієнти, які мали хоча б один запис за останні 90 днів. Показує «живу» частину бази.',
                      tip: 'Високий відсоток активних від загалу — ознака здорової лояльності та повторних візитів.',
                      sections: [{
                        title: 'Показник',
                        items: [
                          { label: 'Утримання', value: `${Math.round(advancedStats.retentionRate ?? 0)}%`, sub: 'активних від загалу' },
                          { label: 'Середній LTV', value: formatCurrency(advancedStats.avgLTV ?? 0), sub: 'цінність клієнта' },
                        ],
                      }],
                    })}
                    className="w-full p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Активні (за останні 90 днів)</span>
                      <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                    </div>
                    <div className="text-2xl font-bold text-blue-400 mt-1">{advancedStats.activeClients ?? 0}</div>
                  </button>
                </div>
                <div className="rounded-xl p-4 md:p-6 card-glass">
                  <h3 className="text-base font-semibold text-white mb-3 flex items-center gap-2"><TargetIcon className="w-5 h-5 text-blue-400" /> Утримання та LTV</h3>
                  <p className="text-xs text-gray-500 mb-2">Натисніть для деталей</p>
                  <button
                    type="button"
                    onClick={() => setDetailSlot({
                      title: 'Утримання клієнтів',
                      value: `${Math.round(advancedStats.retentionRate ?? 0)}%`,
                      explanation: 'Відсоток клієнтів, активних за останні 90 днів, від загальної кількості. Високий показник — хороше утримання.',
                      tip: 'Працюйте над нагадуваннями та програмами лояльності для підтримки утримання.',
                      sections: [{ title: 'Розбивка', items: [{ label: 'Активні', value: String(advancedStats.activeClients ?? 0) }, { label: 'Неактивні', value: String(Math.max(0, (advancedStats.totalClients ?? 0) - (advancedStats.activeClients ?? 0))) }, { label: 'Норма >40%', value: 'Добре утримання' }] }],
                    })}
                    className="w-full p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer text-left group mb-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Утримання клієнтів</span>
                      <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                    </div>
                    <div className="text-2xl font-bold text-purple-400 mt-1">{Math.round(advancedStats.retentionRate ?? 0)}%</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailSlot({
                      title: 'Середній LTV',
                      value: formatCurrency(advancedStats.avgLTV ?? 0),
                      explanation: 'Оцінка середньої цінності клієнта (скільки він приносить за період). Допомагає оцінити ефективність утримання та маркетингу.',
                      tip: 'Зростання LTV — ознака того, що клієнти частіше повертаються або витрачають більше.',
                      sections: [{ title: 'Поради', items: [{ label: 'Перехресні продажі', value: 'Пропонуйте доп. послуги' }, { label: 'Нагадування', value: 'SMS/Email знижують no-show' }, { label: 'Лояльність', value: 'Знижки за повторні візити' }] }],
                    })}
                    className="w-full p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Середній LTV</span>
                      <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                    </div>
                    <div className="text-2xl font-bold text-purple-400 mt-1">{formatCurrency(advancedStats.avgLTV ?? 0)}</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Services Tab */}
          {activeTab === 'services' && advancedStats && (
            <div className="space-y-3 md:space-y-6">
              <div className="rounded-xl p-4 md:p-6 card-glass">
                <h3 className="text-base font-semibold text-white mb-4">Детальний аналіз послуг</h3>
                <p className="text-xs text-gray-500 mb-3">Натисніть на послугу для повної інформації</p>
                {advancedStats.serviceAnalysis && advancedStats.serviceAnalysis.length > 0 ? (
                  <div className="space-y-3">
                    {advancedStats.serviceAnalysis.map((service: any, idx: number) => (
                      <button
                        key={service.serviceId}
                        type="button"
                        onClick={() => {
                          const totalRev = (advancedStats.serviceAnalysis || []).reduce((s: number, x: any) => s + (x.revenue ?? 0), 0)
                          const revShare = totalRev > 0 ? Math.round(((service.revenue ?? 0) / totalRev) * 100) : 0
                          setDetailSlot({
                            title: service.serviceName,
                            value: formatCurrency(service.revenue ?? 0),
                            explanation: `Дохід від цієї послуги за період: ${service.bookings ?? 0} бронювань. Ціна: ${formatCurrency(service.price ?? 0)}. Популярність — частка цієї послуги серед усіх виконаних записів (${(Number(service.popularity) ?? 0).toFixed(1)}%). Середній дохід на бронювання: ${formatCurrency(service.avgRevenuePerBooking ?? 0)}.`,
                            tip: 'Популярні послуги варто виділяти в онлайн-записі та рекомендаціях.',
                            sections: [
                              {
                                title: 'Позиція та частка',
                                items: [
                                  { label: 'Місце за доходом', value: `#${idx + 1} з ${(advancedStats.serviceAnalysis || []).length}`, sub: 'топ послуг' },
                                  { label: 'Частка доходу', value: `${revShare}%`, sub: `від загального ${formatCurrency(totalRev)}` },
                                ],
                              },
                              ...((advancedStats.serviceAnalysis || []).length > 1 ? [{
                                title: 'Інші топ-послуги',
                                items: (advancedStats.serviceAnalysis || [])
                                  .filter((s: any) => s.serviceId !== service.serviceId)
                                  .slice(0, 4)
                                  .map((s: any) => ({
                                    label: s.serviceName,
                                    value: formatCurrency(s.revenue ?? 0),
                                    sub: `${s.bookings ?? 0} записів · ${(s.popularity ?? 0).toFixed(0)}%`,
                                  })),
                              }] : []),
                            ].filter(Boolean),
                          })
                        }}
                        className="w-full p-4 rounded-lg border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer text-left group"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold text-white">{service.serviceName}</div>
                            <div className="text-sm text-gray-400">{formatCurrency(service.price ?? 0)}</div>
                          </div>
                          <div className="text-right flex items-center gap-1">
                            <div className="font-semibold text-purple-400">{formatCurrency(service.revenue ?? 0)}</div>
                            <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                          </div>
                        </div>
                        <div className="flex gap-4 text-xs text-gray-400 flex-wrap">
                          <span>Популярність: <span className="font-medium text-white">{(Number(service.popularity) ?? 0).toFixed(1)}%</span></span>
                          <span>Середній дохід: <span className="font-medium text-white">{formatCurrency(service.avgRevenuePerBooking ?? 0)}</span></span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 py-4">Немає даних про послуги за період</p>
                )}
              </div>
            </div>
          )}

          {/* Masters Tab */}
          {activeTab === 'masters' && advancedStats && (
            <div className="space-y-3 md:space-y-6">
              <div className="rounded-xl p-4 md:p-6 card-glass">
                <h3 className="text-base font-semibold text-white mb-4">Завантаженість спеціалістів</h3>
                <p className="text-xs text-gray-500 mb-3">Натисніть на спеціаліста для повної інформації</p>
                {advancedStats.masterUtilization && advancedStats.masterUtilization.length > 0 ? (
                  <div className="space-y-3">
                    {advancedStats.masterUtilization.map((master: any, idx: number) => {
                      const rate = Number(master.utilizationRate) ?? 0
                      const totalH = Number(master.totalHours) ?? 0
                      const availH = Number(master.availableHours) ?? 0
                      return (
                        <button
                          key={master.masterId}
                          type="button"
                          onClick={() => {
                            const totalRev = (advancedStats.masterUtilization || []).reduce((s: number, m: any) => s + (m.revenue ?? 0), 0)
                            const revShare = totalRev > 0 ? Math.round(((master.revenue ?? 0) / totalRev) * 100) : 0
                            setDetailSlot({
                              title: master.masterName,
                              value: formatCurrency(master.revenue ?? 0),
                              explanation: `Дохід від записів цього спеціаліста за період: ${master.appointments ?? 0} записів. Завантаженість: ${rate.toFixed(1)}% — це співвідношення відпрацьованих годин (${totalH.toFixed(1)} год) до доступних (${availH.toFixed(1)} год). Середній дохід за годину: ${formatCurrency(master.avgRevenuePerHour ?? 0)}.`,
                              tip: 'Висока завантаженість означає ефективне використання графіку; низька — можливість додати слотів або акцій.',
                              action: { label: 'Записи цього спеціаліста', url: `/dashboard/appointments?masterId=${encodeURIComponent(master.masterId)}` },
                              sections: [
                                {
                                  title: 'Показники',
                                  items: [
                                    { label: 'Місце за завантаженістю', value: `#${idx + 1}`, sub: `з ${(advancedStats.masterUtilization || []).length} спеціалістів` },
                                    { label: 'Частка доходу', value: `${revShare}%`, sub: `від загального ${formatCurrency(totalRev)}` },
                                    { label: 'Години / дохід за год', value: `${totalH.toFixed(1)} год · ${formatCurrency(master.avgRevenuePerHour ?? 0)}/год`, sub: undefined },
                                  ],
                                },
                                ...((advancedStats.masterUtilization || []).length > 1 ? [{
                                  title: 'Інші спеціалісти',
                                  items: (advancedStats.masterUtilization || [])
                                    .filter((m: any) => m.masterId !== master.masterId)
                                    .slice(0, 4)
                                    .map((m: any) => ({
                                      label: m.masterName,
                                      value: formatCurrency(m.revenue ?? 0),
                                      sub: `${(m.utilizationRate ?? 0).toFixed(0)}% завантаженість`,
                                    })),
                                }] : []),
                              ].filter(Boolean),
                            })
                          }}
                          className="w-full p-4 rounded-lg border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer text-left group"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="font-semibold text-white">{master.masterName}</div>
                              <div className="text-sm text-gray-400">{master.appointments ?? 0} записів</div>
                            </div>
                            <div className="text-right flex items-center gap-1">
                              <div className="font-semibold text-purple-400">{formatCurrency(master.revenue ?? 0)}</div>
                              <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs text-gray-400">
                              <span>Завантаженість</span>
                              <span className="font-semibold text-white tabular-nums">{rate.toFixed(1)}%</span>
                            </div>
                            <div className="chart-progress-track">
                              <div
                                className="chart-progress-fill chart-bar-fill-util"
                                style={{ width: `${Math.min(rate, 100)}%` }}
                              />
                            </div>
                            <div className="text-xs text-gray-500 tabular-nums">{totalH.toFixed(1)} год / {availH.toFixed(1)} год</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 py-4">Немає даних про спеціалістів за період</p>
                )}
              </div>
            </div>
          )}

          {/* Main Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => setDetailSlot({
                title: 'Всього записів',
                value: String(stats?.totalAppointments || 0),
                explanation: 'Загальна кількість записів за обраний період (день, тиждень або місяць) у всіх статусах: нові, підтверджені, виконані та скасовані.',
                tip: 'Період рахується від дати реєстрації акаунта. Порівнюйте з попередніми періодами для оцінки динаміки.',
                action: { label: 'Переглянути записи', url: '/dashboard/appointments' },
              })}
              className="rounded-xl p-4 card-glass text-left w-full hover:ring-2 hover:ring-white/20 hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <CalendarIcon className="w-5 h-5 text-orange-400 shrink-0" />
                <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
              </div>
              <div className="text-xs text-gray-400">Всього записів</div>
              <div className="text-lg font-bold text-white">{stats?.totalAppointments || 0}</div>
            </button>
            <button
              type="button"
              onClick={() => setDetailSlot({
                title: 'Підтверджено',
                value: String(stats?.confirmedAppointments || 0),
                explanation: 'Кількість записів у статусі «Підтверджено» — клієнт або адмін підтвердив візит. Ці записи ще не виконані, але очікуються.',
                tip: 'Порівняйте з «Виконано»: велика різниця може означати багато майбутніх візитів або частину no-show.',
                action: { label: 'Переглянути підтверджені записи', url: '/dashboard/appointments?status=Confirmed' },
              })}
              className="rounded-xl p-4 card-glass text-left w-full hover:ring-2 hover:ring-white/20 hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <CheckIcon className="w-5 h-5 text-green-400 shrink-0" />
                <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
              </div>
              <div className="text-xs text-gray-400">Підтверджено</div>
              <div className="text-lg font-bold text-white">{stats?.confirmedAppointments || 0}</div>
            </button>
            <button
              type="button"
              onClick={() => setDetailSlot({
                title: 'Виконано',
                value: String(stats?.completedAppointments || 0),
                explanation: 'Кількість записів, які відбулися та були відмічені як виконані. З них формується фактичний дохід за період.',
                tip: 'Це основа для розрахунку загального доходу та середнього чеку.',
                action: { label: 'Переглянути виконані записи', url: '/dashboard/appointments?status=Done' },
              })}
              className="rounded-xl p-4 card-glass text-left w-full hover:ring-2 hover:ring-white/20 hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <CheckIcon className="w-5 h-5 text-green-400 shrink-0" />
                <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
              </div>
              <div className="text-xs text-gray-400">Виконано</div>
              <div className="text-lg font-bold text-white">{stats?.completedAppointments || 0}</div>
            </button>
            <button
              type="button"
              onClick={() => setDetailSlot({
                title: 'Скасовано',
                value: String(stats?.cancelledAppointments || 0),
                explanation: 'Кількість записів, які були скасовані за обраний період. Скасування не входять у дохід.',
                tip: 'Високий відсоток скасувань варто аналізувати: нагадування, зручність перенесення, причини скасувань.',
                action: { label: 'Переглянути скасовані записи', url: '/dashboard/appointments?status=Cancelled' },
              })}
              className="rounded-xl p-4 card-glass text-left w-full hover:ring-2 hover:ring-white/20 hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <XIcon className="w-5 h-5 text-pink-400 shrink-0" />
                <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
              </div>
              <div className="text-xs text-gray-400">Скасовано</div>
              <div className="text-lg font-bold text-white">{stats?.cancelledAppointments || 0}</div>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <button
              type="button"
              onClick={() => setDetailSlot({
                title: 'Загальний дохід',
                value: formatCurrency(stats?.totalRevenue || 0),
                explanation: 'Сума грошей від усіх виконаних записів за обраний період. Рахується за цінами послуг або індивідуальною ціною запису.',
                tip: 'Період обмежений датою реєстрації акаунта. Порівнюйте з попередніми періодами для оцінки зростання.',
                action: { label: 'Переглянути виконані записи', url: '/dashboard/appointments?status=Done' },
              })}
              className="rounded-xl p-4 md:p-6 card-glass text-left w-full hover:ring-2 hover:ring-white/20 hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <MoneyIcon className="w-5 h-5 text-blue-400 shrink-0" />
                <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
              </div>
              <div className="text-xs text-gray-400">Загальний дохід</div>
              <div className="text-xl font-bold text-purple-400">{formatCurrency(stats?.totalRevenue || 0)}</div>
            </button>
            <button
              type="button"
              onClick={() => setDetailSlot({
                title: 'Унікальні клієнти',
                value: String(stats?.uniqueClients || 0),
                explanation: 'Скільки різних клієнтів зробили хоча б один запис за обраний період. Один клієнт з кількома записами рахується один раз.',
                tip: 'Показує охват бази: нові клієнти vs повторні візити можна оцінити порівнянням з загальною кількістю записів.',
                action: { label: 'Переглянути клієнтів', url: '/dashboard/clients' },
              })}
              className="rounded-xl p-4 md:p-6 card-glass text-left w-full hover:ring-2 hover:ring-white/20 hover:bg-white/5 active:scale-[0.99] transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <UsersIcon className="w-5 h-5 text-purple-400 shrink-0" />
                <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
              </div>
              <div className="text-xs text-gray-400">Унікальні клієнти</div>
              <div className="text-xl font-bold text-white">{stats?.uniqueClients || 0}</div>
            </button>
          </div>

          {/* Service Stats */}
          {stats?.serviceStats && Object.keys(stats.serviceStats).length > 0 ? (
            <div className="rounded-xl p-4 md:p-6 card-glass">
              <h2 className="text-base font-semibold text-white mb-4">Популярність послуг</h2>
              <p className="text-xs text-gray-500 mb-3">Натисніть на послугу для деталей</p>
              <div className="space-y-3">
                {Object.entries(stats.serviceStats)
                  .map(([serviceId, count]) => ({ serviceId, count: count as number, service: services.find((s) => s.id === serviceId) }))
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 10)
                  .map(({ serviceId, count, service }, index) => (
                    <button
                      key={serviceId}
                      type="button"
                      onClick={() => setDetailSlot({
                        title: service?.name || `Послуга #${serviceId.slice(0, 8)}`,
                        value: `${count} ${count === 1 ? 'раз' : count < 5 ? 'рази' : 'разів'}`,
                        explanation: `Кількість записів за обраний період, у яких була обрана ця послуга. Показує, наскільки популярна послуга серед клієнтів.${service ? ` Ціна послуги: ${formatCurrency(service.price)}.` : ''}`,
                        tip: index === 0 ? 'Найпопулярніша послуга за період — варто підтримувати її в акціях та рекомендаціях.' : undefined,
                      })}
                      className="w-full flex items-center justify-between gap-4 p-3 rounded-lg border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">{index + 1}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{service?.name || `Послуга #${serviceId.slice(0, 8)}`}</p>
                          {service && <p className="text-xs text-gray-400">{formatCurrency(service.price)}</p>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 flex items-center gap-1">
                        <div className="text-lg font-bold text-white">{count}</div>
                        <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <div className="chart-container text-center py-12 md:py-16">
              <div className="mb-4 flex justify-center">
                <div className="w-20 h-20 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
                  <ChartIcon className="w-10 h-10 text-gray-500" />
                </div>
              </div>
              <h3 className="chart-title mb-2">Немає даних про послуги</h3>
              <p className="text-sm text-gray-400">Статистика з'явиться після перших записів</p>
            </div>
          )}

          {/* Master Stats */}
          {stats?.masterStats && stats.masterStats.length > 0 ? (
            <div className="rounded-xl p-4 md:p-6 card-glass">
              <h2 className="text-base font-semibold text-white mb-4">Статистика спеціалістів</h2>
              <p className="text-xs text-gray-500 mb-3">Натисніть на спеціаліста для деталей</p>
              <div className="space-y-3">
                {stats.masterStats
                  .map((stat: any) => ({ ...stat, master: masters.find((m) => m.id === stat.masterId) }))
                  .sort((a: any, b: any) => b.count - a.count)
                  .map((stat: any, index: number) => (
                    <button
                      key={stat.masterId}
                      type="button"
                      onClick={() => setDetailSlot({
                        title: stat.master?.name || `Спеціаліст #${stat.masterId.slice(0, 8)}`,
                        value: `${stat.count} ${stat.count === 1 ? 'запис' : stat.count < 5 ? 'записи' : 'записів'}`,
                        explanation: `Кількість записів за обраний період, які обслуговував цей спеціаліст. Показує завантаженість та внесок у загальну статистику.`,
                        tip: index === 0 ? 'Найбільше записів за період — можна врахувати при плануванні графіку та навантаження.' : undefined,
                        action: { label: 'Записи цього спеціаліста', url: `/dashboard/appointments?masterId=${encodeURIComponent(stat.masterId)}` },
                      })}
                      className="w-full flex items-center justify-between gap-4 p-3 rounded-lg border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">{index + 1}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{stat.master?.name || `Спеціаліст #${stat.masterId.slice(0, 8)}`}</p>
                          <p className="text-xs text-gray-400">{stat.count === 1 ? '1 запис' : `${stat.count} записів`}</p>
                        </div>
                      </div>
                      <div className="text-lg font-bold text-white flex-shrink-0 flex items-center gap-1">
                        {stat.count}
                        <ChevronRightIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl p-8 md:p-12 text-center card-glass">
              <div className="mb-4 flex justify-center">
                <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center"><UsersIcon className="w-12 h-12 text-gray-400" /></div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Немає даних про спеціалістів</h3>
              <p className="text-sm text-gray-400">Статистика з'явиться після перших записів</p>
            </div>
          )}

          {/* Тренди доходу — внизу сторінки, по 7 за раз */}
          {advancedStats?.dailyTrends && advancedStats.dailyTrends.length > 0 && (
            <div className="rounded-xl p-4 md:p-6 card-glass">
              <h3 className="chart-title mb-3">Тренди доходу</h3>
              <div className="space-y-3">
                {advancedStats.dailyTrends.slice(0, trendsVisibleCount).map((day: any) => {
                  const maxRevenue = Math.max(...advancedStats.dailyTrends.map((d: any) => d.revenue ?? 0), 1)
                  const barWidth = Math.min(100, ((day.revenue ?? 0) / maxRevenue) * 100)
                  return (
                    <div key={day.date} className="flex items-center gap-3 md:gap-4">
                      <div className="w-14 md:w-20 text-xs text-gray-400 tabular-nums shrink-0">{day.dateLabel}</div>
                      <div className="chart-bar-track flex-1 min-w-0">
                        <div
                          className="chart-bar-fill chart-bar-fill-revenue"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0 min-w-0">
                        <span className="text-xs font-semibold text-white tabular-nums truncate max-w-[80px] md:max-w-none">{formatCurrency(day.revenue)}</span>
                        <span className="text-xs text-gray-500 hidden sm:inline">{day.completed} зап.</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              {advancedStats.dailyTrends.length > TRENDS_PAGE_SIZE && (
                <button
                  type="button"
                  onClick={() =>
                    trendsVisibleCount >= advancedStats.dailyTrends.length
                      ? setTrendsVisibleCount(TRENDS_PAGE_SIZE)
                      : setTrendsVisibleCount((n) => Math.min(n + TRENDS_PAGE_SIZE, advancedStats.dailyTrends.length))
                  }
                  className="mt-3 w-full py-2 rounded-lg text-sm font-medium border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  {trendsVisibleCount >= advancedStats.dailyTrends.length
                    ? 'Згорнути'
                    : `Показати ще (ще ${Math.min(TRENDS_PAGE_SIZE, advancedStats.dailyTrends.length - trendsVisibleCount)})`}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-3 md:space-y-6 flex flex-col min-w-0 w-full max-w-full overflow-hidden">
          <MonthProgressCard stats={stats} loading={!stats} />
          <div className="rounded-xl p-4 md:p-6 card-glass min-w-0 overflow-hidden">
            <h3 className="text-base font-semibold text-white mb-3 md:mb-4 flex items-center gap-2" style={{ letterSpacing: '-0.01em' }}>
              <LightBulbIcon className="w-5 h-5 text-purple-400" /> Інсайти
            </h3>
            <p className="text-xs text-gray-500 mb-2">Натисніть для пояснень</p>
            <div className="space-y-2 md:space-y-3">
              <button
                type="button"
                onClick={() => setDetailSlot({
                  title: 'Період аналітики',
                  value: period === 'day' ? 'День' : period === 'week' ? 'Тиждень' : 'Місяць',
                  explanation: 'Обраний період для всіх показників на цій сторінці: День — сьогодні, Тиждень — останні 7 днів, Місяць — останні 30 днів. Початкова дата не раніше дати реєстрації акаунта.',
                  tip: 'Змініть період кнопками вгорі сторінки, щоб порівняти різні інтервали.',
                })}
                className="w-full flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer text-left group"
              >
                <span className="text-sm text-gray-300">Період</span>
                <span className="text-sm font-semibold text-purple-400 flex items-center gap-1">
                  {period === 'day' ? 'День' : period === 'week' ? 'Тиждень' : 'Місяць'}
                  <ChevronRightIcon className="w-3.5 h-3.5 text-gray-500 group-hover:text-white shrink-0" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDetailSlot({
                  title: 'Середній дохід на запис',
                  value: stats?.totalAppointments && stats.totalAppointments > 0 && stats?.totalRevenue != null
                    ? formatCurrency(Math.round(stats.totalRevenue / stats.totalAppointments))
                    : formatCurrency(0),
                  explanation: 'Загальний дохід за період, поділений на кількість виконаних записів. Показує середній чек за візит.',
                  tip: 'Зростання середнього чеку — ознака вдалого апселлу або популярності дорожчих послуг.',
                })}
                className="w-full flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer text-left group"
              >
                <span className="text-sm text-gray-300">Середній дохід на запис</span>
                <span className="text-sm font-semibold text-blue-400 flex items-center gap-1">
                  {stats?.totalAppointments && stats.totalAppointments > 0 && stats?.totalRevenue != null
                    ? formatCurrency(Math.round(stats.totalRevenue / stats.totalAppointments))
                    : formatCurrency(0)}
                  <ChevronRightIcon className="w-3.5 h-3.5 text-gray-500 group-hover:text-white shrink-0" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDetailSlot({
                  title: 'Конверсія (підтверджено)',
                  value: stats?.totalAppointments && stats.totalAppointments > 0 && stats?.confirmedAppointments != null
                    ? `${Math.round((stats.confirmedAppointments / stats.totalAppointments) * 100)}%`
                    : '0%',
                  explanation: 'Відсоток записів, які отримали статус «Підтверджено» від загальної кількості записів за період. Показує, яка частка створених записів підтверджується.',
                  tip: 'Висока конверсія в підтвердження означає менше «холодних» записів та кращу якість ліду.',
                })}
                className="w-full flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/10 active:scale-[0.99] transition-all cursor-pointer text-left group"
              >
                <span className="text-sm text-gray-300">Конверсія (підтверджено)</span>
                <span className="text-sm font-semibold text-green-400 flex items-center gap-1">
                  {stats?.totalAppointments && stats.totalAppointments > 0 && stats?.confirmedAppointments != null
                    ? Math.round((stats.confirmedAppointments / stats.totalAppointments) * 100)
                    : 0}%
                  <ChevronRightIcon className="w-3.5 h-3.5 text-gray-500 group-hover:text-white shrink-0" />
                </span>
              </button>
            </div>
          </div>
          <div className="rounded-xl p-4 md:p-6 card-glass min-w-0 overflow-hidden">
            <h3 className="text-base font-semibold text-white mb-3 md:mb-4" style={{ letterSpacing: '-0.01em' }}>Швидкі дії</h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/dashboard/appointments')}
                className="w-full px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-all active:scale-[0.98] flex items-center gap-2"
                style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
                title="Відкрити сторінку записів"
              >
                <CalendarIcon className="w-4 h-4 shrink-0" />
                Записи
              </button>
              <button
                onClick={() => router.push('/dashboard/clients')}
                className="w-full px-3 py-2.5 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-all flex items-center gap-2 active:scale-[0.98]"
                title="Відкрити базу клієнтів"
              >
                <UsersIcon className="w-4 h-4 shrink-0 opacity-80" />
                Клієнти
              </button>
              <button
                onClick={() => router.push('/dashboard/price')}
                className="w-full px-3 py-2.5 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-all flex items-center gap-2 active:scale-[0.98]"
                title="Редагувати прайс послуг"
              >
                <FileTextIcon className="w-4 h-4 shrink-0 opacity-80" />
                Прайс
              </button>
              <button
                onClick={() => router.push('/dashboard/schedule')}
                className="w-full px-3 py-2.5 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg text-sm font-medium transition-all flex items-center gap-2 active:scale-[0.98]"
                title="Налаштування графіку та спеціалістів"
              >
                <ClockIcon className="w-4 h-4 shrink-0 opacity-80" />
                Графік та спеціалісти
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={!!detailSlot}
        onClose={() => setDetailSlot(null)}
        title={detailSlot?.title}
        size="md"
        footer={
          detailSlot?.action ? (
            <button
              type="button"
              onClick={() => {
                const url = detailSlot?.action?.url
                if (url && typeof url === 'string' && url.startsWith('/')) {
                  try {
                    router.push(url)
                    setDetailSlot(null)
                  } catch {
                    toast({ title: 'В розробці', description: 'Перехід тимчасово недоступний. Спробуйте пізніше.', type: 'error' })
                  }
                } else {
                  toast({ title: 'В розробці', description: 'Цей розділ готується до запуску.', type: 'error' })
                }
              }}
              className="w-full px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.25)' }}
            >
              <CalendarIcon className="w-4 h-4" />
              {detailSlot.action.label}
            </button>
          ) : undefined
        }
      >
        {detailSlot && (
          <div className="space-y-4">
            <div className="text-2xl font-bold text-white/90">{detailSlot.value}</div>
            <p className="text-sm text-gray-300 leading-relaxed">{detailSlot.explanation}</p>
            {detailSlot.tip && (
              <p className="text-xs text-purple-300/90 bg-purple-500/10 rounded-lg p-3 border border-purple-400/20">
                💡 {detailSlot.tip}
              </p>
            )}
            {detailSlot.sections && detailSlot.sections.length > 0 && (
              <div className="space-y-4 pt-2 border-t border-white/10">
                {detailSlot.sections.map((section, idx) => (
                  <div key={idx}>
                    {section.title && (
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{section.title}</h4>
                    )}
                    {section.items && section.items.length > 0 ? (
                      <div className="space-y-2">
                        {section.items.map((item, i) => (
                          <div key={i} className="flex justify-between items-baseline gap-3 py-1.5 border-b border-white/5 last:border-0">
                            <div>
                              <span className="text-sm text-gray-300">{item.label}</span>
                              {item.sub && <span className="text-xs text-gray-500 block">{item.sub}</span>}
                            </div>
                            <span className="text-sm font-semibold text-white shrink-0">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : section.content ? (
                      section.content
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, formatDistanceToNow } from 'date-fns'
import { uk } from 'date-fns/locale'
import { ModalPortal } from '@/components/ui/modal-portal'
import { toast } from '@/components/ui/toast'
import { 
  BuildingIcon, 
  UsersIcon, 
  PhoneIcon, 
  CalendarIcon,
  CheckIcon,
  XIcon,
  SearchIcon,
  FilterIcon,
  DownloadIcon,
  ChartIcon,
  SettingsIcon,
  ShieldIcon,
  MoneyIcon,
  LinkIcon,
  FileTextIcon,
  DatabaseIcon,
  CreditCardIcon
} from '@/components/icons'

type Tab = 'overview' | 'businesses' | 'subscriptions' | 'activity' | 'phones' | 'clients' | 'finances' | 'system'
type SystemSubTab = 'admins' | 'integrations' | 'settings' | 'export' | 'security'

interface Business {
  id: string
  businessId: string
  name: string
  email: string
  phone: string | null
  isActive: boolean
  aiChatEnabled?: boolean
  aiHasKey?: boolean
  aiProvider?: string | null
  aiModel?: string | null
  aiUsage24h?: {
    total: number
    llm: number
    heuristic: number
    fallback: number
    rateLimited: number
    lastUsedAiAt: Date | string | null
    lastRateLimitedAt: Date | string | null
  }
  aiUsageToday?: {
    total: number
    llm: number
    heuristic: number
    fallback: number
    rateLimited: number
    lastUsedAiAt: Date | string | null
    lastRateLimitedAt: Date | string | null
  }
  registeredAt: Date
  lastLoginAt: Date | null
  lastSeenAt: Date | null
  registrationType: 'telegram' | 'google' | 'standard'
  businessIdentifier: string | null
  niche: string
  subscriptionPlan?: string
  trialEndsAt?: Date | string | null
  subscriptionStatus?: string | null
  subscriptionCurrentPeriodEnd?: Date | string | null
}

type LmStudioInfo = {
  baseUrl: string | null
  model: string | null
  isConfigured: boolean
}

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000 // 2 хвилини

function getOnlineStatus(lastSeenAt: Date | string | null) {
  if (!lastSeenAt) return { isOnline: false, label: 'Офлайн' }
  const diff = Date.now() - new Date(lastSeenAt).getTime()
  if (diff < ONLINE_THRESHOLD_MS) {
    return { isOnline: true, label: 'Онлайн' }
  }
  return {
    isOnline: false,
    label: `Був(ла) ${formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true, locale: uk })}`,
  }
}

// Helper function для отримання заголовків з токеном
const getAuthHeaders = () => {
  const token = localStorage.getItem('adminToken')
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export default function ControlCenterPage() {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [systemSubTab, setSystemSubTab] = useState<SystemSubTab>('admins')
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [togglingAi, setTogglingAi] = useState<Record<string, boolean>>({})
  const [lmStudio, setLmStudio] = useState<LmStudioInfo>({ baseUrl: null, model: null, isConfigured: false })

  const defaultStats = {
    total: 0,
    active: 0,
    inactive: 0,
    telegram: 0,
    google: 0,
    standard: 0,
    byNiche: [] as Array<{ niche: string; _count: number }>,
  }

  // Перевірка авторизації
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('adminToken')
      
      if (!token) {
        setIsLoadingAuth(false)
        router.push('/admin/login')
        return
      }

      // Перевіряємо токен на сервері
      try {
        const response = await fetch('/api/admin/auth/verify', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        if (response.ok) {
          setIsAuthorized(true)
        } else {
          localStorage.removeItem('adminToken')
          localStorage.removeItem('adminEmail')
          router.push('/admin/login')
        }
      } catch (error) {
        console.error('Auth check error:', error)
        localStorage.removeItem('adminToken')
        localStorage.removeItem('adminEmail')
        router.push('/admin/login')
      } finally {
        setIsLoadingAuth(false)
      }
    }

    checkAuth()
  }, [router])

  useEffect(() => {
    if (isAuthorized) {
      loadData()
    }
  }, [page, search, statusFilter, isAuthorized])

  const handleRefresh = () => {
    loadData()
    setRefreshTrigger((t: number) => t + 1)
  }

  // Оновлює дані + Live Stats Bar + статистику після блок/видалення
  const handleDataChanged = async () => {
    await loadData()
    setRefreshTrigger((t: number) => t + 1)
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/admin/sync-management', {
        method: 'POST',
        headers: getAuthHeaders(),
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.ok) {
        await handleDataChanged()
      } else {
        alert(data.error || 'Помилка синхронізації')
      }
    } catch (error) {
      console.error('Sync error:', error)
      alert('Помилка синхронізації')
    } finally {
      setSyncing(false)
    }
  }

  const handleToggleAiChat = async (business: Business) => {
    const id = business.businessId
    if (!id) return
    const next = !(business.aiChatEnabled === true)

    // optimistic UI
    setBusinesses((prev) => prev.map((b) => (b.businessId === id ? { ...b, aiChatEnabled: next } : b)))
    setTogglingAi((prev) => ({ ...prev, [id]: true }))
    try {
      const response = await fetch('/api/admin/control-center', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        cache: 'no-store',
        body: JSON.stringify({
          businessId: id,
          action: 'setAiChatEnabled',
          data: { aiChatEnabled: next },
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Не вдалося оновити AI')
      }

      toast({
        title: next ? 'AI увімкнено' : 'AI вимкнено',
        type: 'success',
        duration: 1500,
      })
    } catch (error) {
      // revert
      setBusinesses((prev) => prev.map((b) => (b.businessId === id ? { ...b, aiChatEnabled: !next } : b)))
      toast({
        title: 'Помилка',
        description: error instanceof Error ? error.message : 'Не вдалося оновити AI',
        type: 'error',
      })
    } finally {
      setTogglingAi((prev) => ({ ...prev, [id]: false }))
    }
  }

  const loadData = async (overrides?: { status?: 'all' | 'active' | 'inactive'; page?: number }) => {
    setLoading(true)
    setLoadError(null)
    try {
      const token = localStorage.getItem('adminToken')
      if (!token) {
        router.push('/admin/login')
        return
      }

      const effectiveStatus = overrides?.status ?? statusFilter
      const effectivePage = overrides?.page ?? page

      const params = new URLSearchParams({
        page: effectivePage.toString(),
        limit: '20',
        _t: Date.now().toString(),
        ...(search && { search }),
        ...(effectiveStatus !== 'all' && { status: effectiveStatus }),
      })

      const response = await fetch(`/api/admin/control-center?${params}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      })

      let data: {
        businesses?: Business[]
        stats?: typeof defaultStats
        pagination?: { totalPages?: number }
        lmStudio?: LmStudioInfo
        error?: string
      }
      try {
        data = await response.json()
      } catch {
        throw new Error('Не вдалося прочитати відповідь сервера')
      }

      if (response.status === 401) {
        localStorage.removeItem('adminToken')
        localStorage.removeItem('adminEmail')
        router.push('/admin/login')
        return
      }

      setBusinesses(Array.isArray(data.businesses) ? data.businesses : [])
      setStats(data.stats && typeof data.stats === 'object' ? data.stats : defaultStats)
      setTotalPages(data.pagination?.totalPages || 1)
      if (data.lmStudio && typeof data.lmStudio === 'object') {
        setLmStudio({
          baseUrl: typeof data.lmStudio.baseUrl === 'string' ? data.lmStudio.baseUrl : null,
          model: typeof data.lmStudio.model === 'string' ? data.lmStudio.model : null,
          isConfigured: data.lmStudio.isConfigured === true,
        })
      }

      if (data.error) {
        setLoadError(data.error)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Помилка завантаження даних'
      setLoadError(msg)
      setBusinesses([])
      setStats(defaultStats)
      setTotalPages(1)
      console.error('Control center load error:', error)
    } finally {
      setLoading(false)
    }
  }


  const formatDate = (date: Date | null) => {
    if (!date) return 'Ніколи'
    return format(new Date(date), 'dd.MM.yyyy HH:mm', { locale: uk })
  }

  const tabs = [
    { id: 'overview', label: 'Огляд', icon: ChartIcon },
    { id: 'businesses', label: 'Бізнеси', icon: UsersIcon },
    { id: 'subscriptions', label: 'Підписки', icon: CreditCardIcon },
    { id: 'activity', label: 'Архів', icon: CalendarIcon },
    { id: 'phones', label: 'Телефони', icon: PhoneIcon },
    { id: 'clients', label: 'Клієнти', icon: UsersIcon },
    { id: 'finances', label: 'Фінанси', icon: MoneyIcon },
    { id: 'system', label: 'Система', icon: SettingsIcon },
  ]

  const systemSubTabs: { id: SystemSubTab; label: string; icon: typeof ShieldIcon }[] = [
    { id: 'admins', label: 'Адміністратори', icon: ShieldIcon },
    { id: 'integrations', label: 'Інтеграції', icon: LinkIcon },
    { id: 'export', label: 'Експорт', icon: DownloadIcon },
    { id: 'settings', label: 'Налаштування', icon: SettingsIcon },
    { id: 'security', label: 'Безпека', icon: ShieldIcon },
  ]

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)' }}>
        <div className="text-center">
          <p className="text-gray-300 mb-4" style={{ letterSpacing: '-0.01em' }}>Перевірка доступу...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return (
    <div className="min-h-screen p-2 sm:p-4 md:p-6 pb-[max(1rem,env(safe-area-inset-bottom)+0.5rem)] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]">
      <div className="w-full max-w-7xl mx-auto min-w-0 overflow-x-hidden">
      {loadError && (
        <div className="mb-4 rounded-xl p-4 bg-red-500/20 border border-red-500/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <p className="text-red-300">
              {/can't reach database|connection refused|database server/i.test(loadError)
                ? 'База даних тимчасово недоступна (наприклад, після паузи). Спробуйте «Повторити» через кілька секунд.'
                : loadError}
            </p>
          </div>
          <button
            onClick={() => { setLoadError(null); loadData(); }}
            className="min-h-[44px] px-4 py-2 bg-red-500/30 hover:bg-red-500/50 text-white rounded-lg font-medium shrink-0 touch-manipulation"
          >
            Повторити
          </button>
        </div>
      )}
      {/* Live Stats Bar */}
      <LiveStatsBar refreshTrigger={refreshTrigger} onManualRefresh={handleRefresh} />

      {/* Header — як у dashboard */}
      <div className="flex items-center justify-between gap-3 mb-4 md:mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-white truncate" style={{ letterSpacing: '-0.02em' }}>
              Центр управління
            </h1>
            <a
              href="/admin/login"
              onClick={(e) => {
                e.preventDefault()
                localStorage.removeItem('adminToken')
                localStorage.removeItem('adminEmail')
                router.push('/admin/login')
              }}
              className="text-xs text-gray-400 hover:text-white transition-colors shrink-0"
            >
              Вийти
            </a>
          </div>
          <p className="text-sm text-gray-400 mt-0.5 hidden sm:block">Бізнеси, підписки, архів · дані в реальному часі</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors font-medium text-sm"
            title="Синхронізувати з центром"
          >
            {syncing ? '…' : 'Синхр.'}
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-50 transition-colors font-medium text-sm"
          >
            {loading ? '…' : 'Оновити'}
          </button>
        </div>
      </div>

      {/* Tabs — мобільний вибір */}
      <div className="mb-4 md:hidden">
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as Tab)}
          className="w-full min-h-[44px] px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-base font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer touch-manipulation"
          style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            backgroundSize: '20px',
            paddingRight: '44px',
          }}
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id} className="bg-[#1e293b] text-white">
              {tab.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs — десктоп */}
      <div className="mb-4 hidden md:flex flex-wrap gap-1 overflow-x-auto pb-px">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content — стиль як dashboard */}
      <div className="rounded-xl p-4 sm:p-6 card-glass-subtle min-w-0 overflow-hidden border border-white/10">
        {activeTab === 'overview' && (
          <OverviewTab stats={stats ?? defaultStats} loading={loading} refreshTrigger={refreshTrigger} getAuthHeaders={getAuthHeaders} />
        )}

        {activeTab === 'businesses' && (
          <BusinessesTab
            businesses={businesses}
            loading={loading}
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            page={page}
            setPage={setPage}
            totalPages={totalPages}
            formatDate={formatDate}
            onDataChanged={handleDataChanged}
            loadData={loadData}
            setRefreshTrigger={setRefreshTrigger}
            refreshTrigger={refreshTrigger}
            onToggleAiChat={handleToggleAiChat}
            togglingAi={togglingAi}
            lmStudio={lmStudio}
          />
        )}

        {activeTab === 'phones' && (
          <PhonesTab refreshTrigger={refreshTrigger} />
        )}

        {activeTab === 'activity' && (
          <ActivityTab refreshTrigger={refreshTrigger} />
        )}

        {activeTab === 'finances' && (
          <FinancesTab refreshTrigger={refreshTrigger} />
        )}

        {activeTab === 'subscriptions' && (
          <SubscriptionsTab
            businesses={businesses}
            loading={loading}
            formatDate={formatDate}
            onDataChanged={handleDataChanged}
          />
        )}

        {activeTab === 'system' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 border-b border-white/10 scrollbar-hide sm:flex-wrap">
              {systemSubTabs.map((st) => {
                const Icon = st.icon
                return (
                  <button
                    key={st.id}
                    onClick={() => setSystemSubTab(st.id)}
                    className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 touch-manipulation ${
                      systemSubTab === st.id ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {st.label}
                  </button>
                )
              })}
            </div>
            {systemSubTab === 'admins' && <AdminsTab refreshTrigger={refreshTrigger} />}
            {systemSubTab === 'integrations' && <IntegrationsTab refreshTrigger={refreshTrigger} />}
            {systemSubTab === 'export' && <ExportTab />}
            {systemSubTab === 'settings' && <SettingsTab />}
            {systemSubTab === 'security' && <SecurityTab />}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

// Live Stats Bar — оновлюється при натисканні «Оновити» або кнопки на панелі
function LiveStatsBar({ refreshTrigger, onManualRefresh }: { refreshTrigger?: number; onManualRefresh?: () => void }) {
  const [realtimeStats, setRealtimeStats] = useState<{
    total: number
    online: number
    idle: number
    offline: number
    newToday: number
    blocked: number
    updatedAt?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/stats/realtime?_t=${Date.now()}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setRealtimeStats(data)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [refreshTrigger])

  if (loading && !realtimeStats) {
    return (
      <div className="mb-4 rounded-xl p-4 bg-white/5 border border-white/10 animate-pulse">
        <div className="h-10 bg-white/10 rounded-lg" />
      </div>
    )
  }

  const s = realtimeStats || { total: 0, online: 0, idle: 0, offline: 0, newToday: 0, blocked: 0 }

  return (
    <div className="mb-3 sm:mb-4 rounded-xl p-3 sm:p-4 bg-white/5 border border-white/10">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-4">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span className="relative flex h-2 w-2 sm:h-2.5 sm:w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-full w-full bg-green-500" />
          </span>
          <span className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">Live</span>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 sm:gap-4 md:gap-6">
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-sm sm:text-base md:text-xl font-bold text-white tabular-nums">{s.total}</span>
            <span className="text-[10px] sm:text-xs text-gray-400">всього</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg md:text-xl font-bold text-green-400">{s.online}</span>
            <span className="text-xs sm:text-sm text-gray-400">онлайн</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg md:text-xl font-bold text-orange-400">{s.idle}</span>
            <span className="text-xs sm:text-sm text-gray-400">в простої</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg md:text-xl font-bold text-gray-400">{s.offline}</span>
            <span className="text-sm text-gray-400">офлайн</span>
          </div>
          {s.newToday > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-lg md:text-xl font-bold text-blue-400">+{s.newToday}</span>
              <span className="text-sm text-gray-400">сьогодні</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg md:text-xl font-bold text-red-400">{s.blocked}</span>
            <span className="text-xs sm:text-sm text-gray-400">заблок.</span>
          </div>
        </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 mt-1 sm:mt-0">
          {s.updatedAt && (
            <span className="text-[10px] sm:text-xs text-gray-500 hidden xs:inline">
              {new Date(s.updatedAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          {onManualRefresh && (
            <button
              type="button"
              onClick={() => onManualRefresh()}
              disabled={loading}
              className="p-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex items-center justify-center touch-manipulation"
              title="Оновити всі дані та статистику"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Overview Tab Component — огляд + аналітика за період
function OverviewTab({ stats, loading, refreshTrigger, getAuthHeaders }: { stats: any; loading: boolean; refreshTrigger?: number; getAuthHeaders: () => Record<string, string> }) {
  const [analytics, setAnalytics] = useState<any>(null)
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('week')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/analytics?period=${period}&_t=${Date.now()}`, { headers: getAuthHeaders(), cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setAnalytics(data)
        }
      } catch { setAnalytics(null) }
    }
    load()
  }, [period, refreshTrigger])

  if (loading && !stats) {
    return <div className="text-center py-12 text-gray-400">Завантаження...</div>
  }

  const cards = [
    {
      title: 'Всього бізнесів',
      value: stats?.total || 0,
      icon: BuildingIcon,
      colorClass: 'text-blue-400',
    },
    {
      title: 'Активні',
      value: stats?.active || 0,
      icon: CheckIcon,
      colorClass: 'text-green-400',
    },
    {
      title: 'Неактивні',
      value: stats?.inactive || 0,
      icon: XIcon,
      colorClass: 'text-red-400',
    },
    {
      title: 'Через Telegram',
      value: stats?.telegram || 0,
      icon: PhoneIcon,
      colorClass: 'text-purple-400',
    },
    {
      title: 'Через Google',
      value: stats?.google || 0,
      icon: UsersIcon,
      colorClass: 'text-orange-400',
    },
    {
      title: 'Стандартна реєстрація',
      value: stats?.standard || 0,
      icon: BuildingIcon,
      colorClass: 'text-gray-400',
    },
  ]

  const byNiche = (stats?.byNiche || []) as Array<{ niche: string; _count: number }>
  const hasData = (stats?.total ?? 0) > 0

  return (
    <div className="space-y-6">
      {loading && (
        <div className="text-xs text-gray-500">Оновлення статистики…</div>
      )}
      {!hasData && (
        <div className="rounded-xl p-6 bg-white/5 border border-white/10 text-center text-gray-300">
          <p className="mb-2">Ще немає даних у системі.</p>
          <p className="text-sm">Натисніть кнопку <strong>«Синхронізувати»</strong> або <strong>«Оновити»</strong> вгорі, щоб підтягнути бізнеси.</p>
        </div>
      )}
      <h2 className="text-lg font-semibold text-white mb-2">
        Статистика системи
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
        {cards.map((card, index) => {
          const Icon = card.icon
          return (
            <div
              key={index}
              className="rounded-xl p-3 sm:p-4 md:p-5 bg-white/5 border border-white/10 min-w-0"
            >
              <div className="flex items-center justify-between gap-2 mb-1 sm:mb-2">
                <Icon className={`w-5 h-5 sm:w-6 sm:h-6 shrink-0 ${card.colorClass}`} />
                <span className="text-lg sm:text-xl md:text-2xl font-bold text-white tabular-nums truncate">
                  {card.value}
                </span>
              </div>
              <p className="text-[10px] sm:text-xs md:text-sm text-gray-400 line-clamp-2">
                {card.title}
              </p>
            </div>
          )
        })}
      </div>
      {byNiche.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">За нішею</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {byNiche.map((n: { niche: string; _count: number }) => (
              <div key={n.niche || 'empty'} className="rounded-xl p-4 bg-white/5 border border-white/10">
                <div className="text-lg font-bold text-white">{n._count}</div>
                <div className="text-sm text-gray-400">{n.niche || 'Інше'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Аналітика за період */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-3">
          <h3 className="text-base sm:text-lg font-semibold text-white">Реєстрації за період</h3>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="min-h-[44px] w-full sm:w-auto px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white text-sm touch-manipulation"
          >
            <option value="day">День</option>
            <option value="week">Тиждень</option>
            <option value="month">Місяць</option>
            <option value="year">Рік</option>
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl p-3 sm:p-4 bg-white/5 border border-white/10 min-h-[60px] flex flex-col justify-center">
            <div className="text-xs sm:text-sm text-gray-400">Реєстрацій</div>
            <div className="text-xl sm:text-2xl font-bold text-white">{analytics?.registrations?.total ?? '—'}</div>
          </div>
          <div className="rounded-xl p-3 sm:p-4 bg-white/5 border border-white/10 min-h-[60px] flex flex-col justify-center">
            <div className="text-xs sm:text-sm text-gray-400">Всього бізнесів</div>
            <div className="text-xl sm:text-2xl font-bold text-white">{analytics?.overview?.totalBusinesses ?? stats?.total ?? '—'}</div>
          </div>
          <div className="rounded-xl p-3 sm:p-4 bg-white/5 border border-white/10 min-h-[60px] flex flex-col justify-center">
            <div className="text-xs sm:text-sm text-gray-400">Активних</div>
            <div className="text-xl sm:text-2xl font-bold text-white">{analytics?.overview?.activeBusinesses ?? stats?.active ?? '—'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Businesses Tab Component
function BusinessesTab({ businesses, loading, search, setSearch, statusFilter, setStatusFilter, page, setPage, totalPages, formatDate, onDataChanged, loadData, setRefreshTrigger, refreshTrigger, onToggleAiChat, togglingAi, lmStudio }: any) {
  const [selectedBusinesses, setSelectedBusinesses] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState<string>('')
  const [blockModalOpen, setBlockModalOpen] = useState(false)
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)
  const [blockReason, setBlockReason] = useState('')
  const [isBlocking, setIsBlocking] = useState(false)
  const [blockInfoModalOpen, setBlockInfoModalOpen] = useState(false)
  const [blockInfoBusiness, setBlockInfoBusiness] = useState<Business | null>(null)
  const [blockInfo, setBlockInfo] = useState<any>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [searchBy, setSearchBy] = useState<'all' | 'id' | 'name' | 'email'>('all')
  const [detailModalBusiness, setDetailModalBusiness] = useState<Business | null>(null)
  const [aiKeyDraft, setAiKeyDraft] = useState('')
  const [aiModelDraft, setAiModelDraft] = useState('')
  const [savingAiConfig, setSavingAiConfig] = useState(false)
  const [lmStudioUrlDraft, setLmStudioUrlDraft] = useState('')
  const [lmStudioModelDraft, setLmStudioModelDraft] = useState('')
  const [savingLmStudio, setSavingLmStudio] = useState(false)

  useEffect(() => {
    if (lmStudio) {
      setLmStudioUrlDraft(lmStudio.baseUrl || 'http://127.0.0.1:1234/v1')
      setLmStudioModelDraft(lmStudio.model || '')
    }
  }, [lmStudio?.baseUrl, lmStudio?.model])
  const [quickIdSearch, setQuickIdSearch] = useState('')
  const quickSearchInputRef = useRef<HTMLInputElement>(null)
  const rowRefsMap = useRef<Record<string, HTMLTableRowElement | null>>({})

  const handleBulkAction = async () => {
    if (!bulkAction || selectedBusinesses.length === 0) return

    if (bulkAction === 'delete') {
      if (!confirm(`Ви впевнені, що хочете видалити ${selectedBusinesses.length} акаунтів? Цю дію неможливо скасувати!`)) {
        return
      }
    }

    try {
      for (const businessId of selectedBusinesses) {
        // Знаходимо businessIdentifier для бізнесу
        const business = businesses.find((b: Business) => b.businessId === businessId)
        if (business && business.businessIdentifier) {
          if (bulkAction === 'delete') {
            await fetch(`/api/business/delete?businessIdentifier=${business.businessIdentifier}`, {
              method: 'DELETE',
              headers: getAuthHeaders(),
            })
          } else {
            await fetch('/api/business/block', {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({
                businessIdentifier: business.businessIdentifier,
                isActive: bulkAction === 'activate',
                reason: bulkAction === 'deactivate' ? 'Масове блокування' : undefined,
              }),
            })
          }
        }
      }
      setSelectedBusinesses([])
      setBulkAction('')
      onDataChanged?.()
    } catch (error) {
      console.error('Error performing bulk action:', error)
      alert('Помилка при виконанні дії')
    }
  }

  const handleBlockClick = (business: Business) => {
    setSelectedBusiness(business)
    setBlockReason('')
    setBlockModalOpen(true)
  }

  const handleBlockConfirm = async () => {
    if (!selectedBusiness || !selectedBusiness.businessIdentifier) return

    setIsBlocking(true)
    try {
      const response = await fetch('/api/business/block', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          businessIdentifier: selectedBusiness.businessIdentifier,
          isActive: false,
          reason: blockReason || 'Блокування через центр управління',
        }),
      })

      if (response.ok) {
        setBlockModalOpen(false)
        setSelectedBusiness(null)
        setBlockReason('')
        setStatusFilter('inactive')
        setPage(1)
        loadData({ status: 'inactive', page: 1 })
        setRefreshTrigger((t: number) => t + 1)
        toast({ title: 'Акаунт заблоковано', description: 'Показано список неактивних (заблокованих) — можна розблокувати тут.', type: 'success' })
      } else {
        const data = await response.json()
        alert(data.error || 'Помилка при блокуванні')
      }
    } catch (error) {
      console.error('Error blocking business:', error)
      alert('Помилка при блокуванні акаунту')
    } finally {
      setIsBlocking(false)
    }
  }

  const handleUnblock = async (business: Business) => {
    if (!business.businessIdentifier) return

    if (!confirm(`Розблокувати акаунт "${business.name}"?`)) return

    try {
      const response = await fetch('/api/business/block', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          businessIdentifier: business.businessIdentifier,
          isActive: true,
        }),
      })

      if (response.ok) {
        onDataChanged?.()
      } else {
        const data = await response.json()
        alert(data.error || 'Помилка при розблоковуванні')
      }
    } catch (error) {
      console.error('Error unblocking business:', error)
      alert('Помилка при розблоковуванні акаунту')
    }
  }

  const handleViewBlockInfo = async (business: Business) => {
    if (!business.businessIdentifier) return

    setBlockInfoBusiness(business)
    
    try {
      const response = await fetch(`/api/business/block?businessIdentifier=${business.businessIdentifier}`, {
        headers: getAuthHeaders(),
      })
      
      if (response.ok) {
        const data = await response.json()
        setBlockInfo(data.blockInfo)
        setBlockInfoModalOpen(true)
      }
    } catch (error) {
      console.error('Error fetching block info:', error)
    }
  }

  const handleDeleteClick = (business: Business) => {
    setSelectedBusiness(business)
    setDeleteConfirm('')
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedBusiness || !selectedBusiness.businessIdentifier) return
    
    if (deleteConfirm !== 'ВИДАЛИТИ') {
      alert('Введіть "ВИДАЛИТИ" для підтвердження')
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/business/delete?businessIdentifier=${selectedBusiness.businessIdentifier}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })

      if (response.ok) {
        setDeleteModalOpen(false)
        setSelectedBusiness(null)
        setDeleteConfirm('')
        onDataChanged?.()
        toast({ title: 'Акаунт видалено', description: 'Бізнес та всі пов’язані дані видалено назавжди.', type: 'success' })
      } else {
        const data = await response.json()
        toast({ title: data.error || 'Помилка при видаленні', type: 'error' })
      }
    } catch (error) {
      console.error('Error deleting business:', error)
      toast({ title: 'Помилка при видаленні акаунту', type: 'error' })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCopyId = (businessIdentifier: string) => {
    navigator.clipboard.writeText(businessIdentifier)
    toast({ title: `ID ${businessIdentifier} скопійовано`, type: 'success' })
  }

  const filteredBusinesses = businesses.filter((business: Business) => {
    if (!search) return true
    
    const searchLower = search.toLowerCase().trim()
    
    switch (searchBy) {
      case 'id':
        return (
          business.businessIdentifier?.toLowerCase().includes(searchLower) ||
          business.id.toLowerCase().includes(searchLower)
        )
      case 'name':
        return business.name.toLowerCase().includes(searchLower)
      case 'email':
        return business.email.toLowerCase().includes(searchLower)
      default:
        return (
          business.name.toLowerCase().includes(searchLower) ||
          business.email.toLowerCase().includes(searchLower) ||
          business.phone?.toLowerCase().includes(searchLower) ||
          business.businessIdentifier?.toLowerCase().includes(searchLower) ||
          business.id.toLowerCase().includes(searchLower)
        )
    }
  })

  // Швидкий пошук за ID — Ctrl+K / Cmd+K фокусує інпут
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        quickSearchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleQuickIdSearch = useCallback(() => {
    const q = quickIdSearch.trim()
    if (!q) return
    setSearchBy('id')
    setSearch(q)
    setPage(1)
  }, [quickIdSearch, setSearch, setPage])

  // Після завантаження: якщо пошук за ID і знайдено 1 акаунт — відкрити деталі
  useEffect(() => {
    const q = quickIdSearch.trim()
    if (!loading && search && searchBy === 'id' && q && filteredBusinesses.length === 1) {
      const biz = filteredBusinesses[0]
      setDetailModalBusiness(biz)
      setQuickIdSearch('')
      setTimeout(() => {
        rowRefsMap.current[biz.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 150)
    }
  }, [loading, search, searchBy, quickIdSearch, filteredBusinesses])

  return (
    <div className="min-w-0 overflow-hidden">
      {/* Швидкий пошук за ID — Ctrl+K */}
      <div className="mb-4 p-3 sm:p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex flex-col sm:flex-row gap-2">
          <input
            ref={quickSearchInputRef}
            type="text"
            placeholder="Пошук за ID (56836) — Ctrl+K"
            value={quickIdSearch}
            onChange={(e) => setQuickIdSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickIdSearch()}
            className="flex-1 min-h-[44px] px-4 py-2.5 border border-white/10 rounded-lg bg-white/5 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:border-blue-500/50"
          />
          <button
            type="button"
            onClick={handleQuickIdSearch}
            className="min-h-[44px] px-4 py-2.5 bg-blue-500/30 text-blue-300 rounded-lg hover:bg-blue-500/50 font-medium shrink-0"
          >
            Знайти
          </button>
        </div>
        <span className="text-xs text-gray-500 self-center hidden sm:inline">Ctrl+K — фокус</span>
      </div>

      {/* LM Studio (для всіх акаунтів) */}
      <div className="mb-4 p-3 sm:p-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-sm font-semibold text-white">LM Studio (для всіх акаунтів)</div>
          <div className="text-xs text-gray-300">
            {lmStudio?.isConfigured ? 'Налаштовано' : 'Не налаштовано'}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            type="text"
            value={lmStudioUrlDraft}
            onChange={(e) => setLmStudioUrlDraft(e.target.value)}
            placeholder="LM Studio URL (http://127.0.0.1:1234/v1)"
            className="w-full min-h-[44px] px-4 py-2.5 border border-white/10 rounded-lg bg-white/5 text-white placeholder-gray-500 text-sm"
          />
          <input
            type="text"
            value={lmStudioModelDraft}
            onChange={(e) => setLmStudioModelDraft(e.target.value)}
            placeholder="Модель (порожньо = авто)"
            className="w-full min-h-[44px] px-4 py-2.5 border border-white/10 rounded-lg bg-white/5 text-white placeholder-gray-500 text-sm"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <button
            type="button"
            disabled={savingLmStudio}
            onClick={async () => {
              setSavingLmStudio(true)
              try {
                const res = await fetch('/api/admin/control-center', {
                  method: 'PATCH',
                  headers: getAuthHeaders(),
                  cache: 'no-store',
                  body: JSON.stringify({
                    businessId: 'global',
                    action: 'setGlobalLmStudioConfig',
                    data: {
                      lmStudioBaseUrl: lmStudioUrlDraft.trim() || 'http://127.0.0.1:1234/v1',
                      lmStudioModel: lmStudioModelDraft.trim() || null,
                    },
                  }),
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(data.error || 'Не вдалося зберегти LM Studio')
                toast({ title: 'LM Studio збережено', type: 'success', duration: 1500 })
                await onDataChanged?.()
              } catch (e) {
                toast({ title: 'Помилка', description: e instanceof Error ? e.message : 'Не вдалося зберегти LM Studio', type: 'error' })
              } finally {
                setSavingLmStudio(false)
              }
            }}
            className="min-h-[44px] px-4 py-2.5 bg-white/10 text-white rounded-lg hover:bg-white/20 disabled:opacity-50"
          >
            {savingLmStudio ? 'Збереження...' : 'Зберегти'}
          </button>
        </div>
        <div className="text-[11px] text-gray-400 mt-2">
          Запустіть LM Studio локально, завантажте модель. За замовчуванням: http://127.0.0.1:1234/v1
        </div>
      </div>

      <div className="mb-4 md:mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={
              searchBy === 'id' ? 'Пошук за ID (56836 або UUID)...' :
              searchBy === 'name' ? 'Пошук за назвою...' :
              searchBy === 'email' ? 'Пошук за email...' :
              'Пошук по назві, email, телефону, ID...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[44px] pl-10 pr-4 py-2 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm text-white"
          />
        </div>
        
        <div className="flex gap-2 flex-wrap">
        <select
          value={searchBy}
          onChange={(e) => setSearchBy(e.target.value as any)}
          className="min-h-[44px] px-4 py-2 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm text-white flex-1 sm:flex-none min-w-0"
          title="Тип пошуку"
        >
          <option value="all">Всюди</option>
          <option value="id">За ID</option>
          <option value="name">За назвою</option>
          <option value="email">За email</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
          className="px-4 py-2 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm text-white"
          title="Оберіть «Неактивні (заблоковані)», щоб знайти та розблокувати акаунти"
        >
          <option value="all">Всі статуси</option>
          <option value="active">Активні</option>
          <option value="inactive">Неактивні (заблоковані)</option>
        </select>

        {selectedBusinesses.length > 0 && (
          <div className="flex gap-2 flex-wrap w-full sm:w-auto">
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="min-h-[44px] px-4 py-2 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm text-white focus:outline-none focus:border-white/20 flex-1 sm:flex-none min-w-0"
            >
              <option value="" className="bg-[#2A2A2A]">Оберіть дію</option>
              <option value="activate" className="bg-[#2A2A2A]">Активувати</option>
              <option value="deactivate" className="bg-[#2A2A2A]">Деактивувати</option>
              <option value="delete" className="bg-[#2A2A2A]">Видалити</option>
            </select>
            <button
              onClick={handleBulkAction}
              className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors font-semibold shrink-0"
              style={{ letterSpacing: '-0.01em', boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.25)' }}
            >
              Застосувати ({selectedBusinesses.length})
            </button>
          </div>
        )}

        <button 
          onClick={() => {
            const dataToExport = search ? filteredBusinesses : businesses
            if (dataToExport.length === 0) {
              alert('Немає даних для експорту')
              return
            }
            const data: Record<string, string>[] = dataToExport.map((b: Business) => {
              const { label } = getOnlineStatus(b.lastSeenAt)
              return {
                ID: b.businessIdentifier || '-',
                Назва: b.name,
                Email: b.email,
                Телефон: b.phone || '-',
                Статус: b.isActive ? 'Активний' : 'Неактивний',
                Сторінка: label,
                'Тип реєстрації': b.registrationType === 'telegram' ? 'Telegram' : b.registrationType === 'google' ? 'Google' : 'Стандартна',
                'Дата реєстрації': formatDate(b.registeredAt),
                'Останній вхід': formatDate(b.lastLoginAt),
              }
            })
            const csv = [
              Object.keys(data[0] || {}).join(','),
              ...data.map((row: Record<string, string>) => Object.values(row).map((v: string) => `"${String(v).replace(/"/g, '""')}"`).join(','))
            ].join('\n')
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = `businesses-${new Date().toISOString().split('T')[0]}.csv`
            link.click()
          }}
          className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center justify-center gap-2 font-semibold transition-colors shrink-0 w-full sm:w-auto"
          style={{ letterSpacing: '-0.01em', boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.25)' }}
        >
          <DownloadIcon className="w-5 h-5 shrink-0" />
          <span>Експорт CSV</span>
        </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Завантаження...</div>
      ) : (
        <>
          {/* Мобільний вигляд — картки */}
          <div className="block md:hidden space-y-3">
            {(search ? filteredBusinesses : businesses).map((business: Business) => {
              const { isOnline, label } = getOnlineStatus(business.lastSeenAt)
              return (
                <div
                  key={business.id}
                  ref={(el) => { rowRefsMap.current[business.id] = el as unknown as HTMLTableRowElement }}
                  className="rounded-xl p-4 card-glass border border-white/10 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white truncate cursor-pointer" onClick={() => setDetailModalBusiness(business)}>
                        {business.name}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">ID: {business.businessIdentifier || '-'}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedBusinesses.includes(business.businessId)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedBusinesses([...selectedBusinesses, business.businessId])
                        else setSelectedBusinesses(selectedBusinesses.filter(id => id !== business.businessId))
                      }}
                      className="mt-1 shrink-0 w-5 h-5"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${business.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {business.isActive ? 'Активний' : 'Неактивний'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${isOnline ? 'text-green-400' : 'text-gray-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                      {label}
                    </span>
                    <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-gray-300">
                      {business.registrationType === 'telegram' ? 'TG' : business.registrationType === 'google' ? 'Google' : 'Стандарт'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 truncate">{business.email}</div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button onClick={() => setDetailModalBusiness(business)} className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded-lg">Деталі</button>
                    <button
                      onClick={() => onToggleAiChat?.(business)}
                      disabled={togglingAi[business.businessId] === true}
                      className={`px-3 py-1.5 text-xs rounded-lg ${
                        business.aiChatEnabled
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-gray-500/20 text-gray-300'
                      } ${togglingAi[business.businessId] === true ? 'opacity-60 cursor-not-allowed' : ''}`}
                      title="Увімкнути/вимкнути AI чат"
                    >
                      AI: {business.aiChatEnabled ? 'ON' : 'OFF'}
                    </button>
                    {business.isActive ? (
                      <>
                        <button onClick={() => handleBlockClick(business)} className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 rounded-lg">Заблокувати</button>
                        <button onClick={() => handleDeleteClick(business)} className="px-3 py-1.5 text-xs bg-gray-500/20 text-gray-300 rounded-lg">Видалити</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleUnblock(business)} className="px-3 py-1.5 text-xs bg-green-500/20 text-green-400 rounded-lg">Розблокувати</button>
                        <button onClick={() => handleDeleteClick(business)} className="px-3 py-1.5 text-xs bg-gray-500/20 text-gray-300 rounded-lg">Видалити</button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Десктоп — таблиця (фіксована ширина, без горизонтального скролу сторінки) */}
          <div className="hidden md:block min-w-0 overflow-hidden">
            <table className="w-full table-fixed" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-2 w-10">
                    <input
                      type="checkbox"
                      checked={selectedBusinesses.length === (search ? filteredBusinesses : businesses).length && (search ? filteredBusinesses : businesses).length > 0}
                      onChange={(e) => {
                        const businessesToSelect = search ? filteredBusinesses : businesses
                        if (e.target.checked) {
                          setSelectedBusinesses(businessesToSelect.map((b: Business) => b.businessId))
                        } else {
                          setSelectedBusinesses([])
                        }
                      }}
                    />
                  </th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-300 text-sm w-[9%]">ID</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-300 text-sm w-[13%]">Назва</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-300 text-sm w-[14%]">Email</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-300 text-sm w-[10%]">Телефон</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-300 text-sm w-[8%]">Реєстр.</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-300 text-sm w-[7%]">Статус</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-300 text-sm w-[12%]">Сторінка</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-300 text-sm w-[10%]">Вхід</th>
                  <th className="text-left py-2 px-2 font-semibold text-gray-300 text-sm w-[15%]">Дії</th>
                </tr>
              </thead>
              <tbody>
                {(search ? filteredBusinesses : businesses).map((business: Business) => (
                  <tr
                    key={business.id}
                    ref={(el) => { rowRefsMap.current[business.id] = el }}
                    className="border-b border-white/10 hover:bg-white/5"
                  >
                    <td className="py-2 px-2 w-10">
                      <input
                        type="checkbox"
                        checked={selectedBusinesses.includes(business.businessId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBusinesses([...selectedBusinesses, business.businessId])
                          } else {
                            setSelectedBusinesses(selectedBusinesses.filter(id => id !== business.businessId))
                          }
                        }}
                      />
                    </td>
                    <td className="py-2 px-2 min-w-0">
                      {business.businessIdentifier ? (
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-mono text-xs font-bold text-blue-400 truncate" title={business.businessIdentifier}>
                            {business.businessIdentifier}
                          </span>
                          <button
                            onClick={() => handleCopyId(business.businessIdentifier!)}
                            className="p-0.5 shrink-0 hover:bg-white/10 rounded transition-colors"
                            title="Копіювати ID"
                          >
                            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2 min-w-0">
                      <div className="font-medium text-white cursor-pointer text-sm truncate" title={business.name} onClick={() => setDetailModalBusiness(business)}>
                        {business.name}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-gray-300 text-sm truncate min-w-0" title={business.email}>
                      {business.email}
                    </td>
                    <td className="py-2 px-2 text-gray-300 text-sm truncate min-w-0" title={business.phone || '-'}>
                      {business.phone || '-'}
                    </td>
                    <td className="py-2 px-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                        business.registrationType === 'telegram' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                        business.registrationType === 'google' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        'bg-gray-500/20 text-gray-300 border border-gray-500/50'
                      }`}>
                        {business.registrationType === 'telegram' ? 'TG' :
                         business.registrationType === 'google' ? 'Google' :
                         'Станд.'}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      {business.isActive ? (
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Актив.
                        </span>
                      ) : (
                        <button
                          onClick={() => handleViewBlockInfo(business)}
                          className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 transition-colors cursor-pointer"
                          title="Натисніть для перегляду причини блокування"
                        >
                          Неакт.
                        </button>
                      )}
                    </td>
                    <td className="py-2 px-2 min-w-0">
                      {(() => {
                        const { isOnline, label } = getOnlineStatus(business.lastSeenAt)
                        return (
                          <div className="flex items-center gap-1 min-w-0" title={label}>
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
                              }`}
                            />
                            <span className={`text-xs truncate ${isOnline ? 'text-green-400' : 'text-gray-400'}`}>
                              {label}
                            </span>
                          </div>
                        )
                      })()}
                    </td>
                    <td className="py-2 px-2 text-xs text-gray-300 truncate min-w-0" title={formatDate(business.lastLoginAt)}>
                      {formatDate(business.lastLoginAt)}
                    </td>
                    <td className="py-2 px-2 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button 
                          onClick={() => setDetailModalBusiness(business)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                        >
                          Деталі
                        </button>
                        <button
                          onClick={() => onToggleAiChat?.(business)}
                          disabled={togglingAi[business.businessId] === true}
                          className={`px-2 py-0.5 text-white text-xs rounded transition-colors ${
                            business.aiChatEnabled ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-600 hover:bg-gray-700'
                          } ${togglingAi[business.businessId] === true ? 'opacity-60 cursor-not-allowed' : ''}`}
                          title="Увімкнути/вимкнути AI чат"
                        >
                          AI {business.aiChatEnabled ? 'ON' : 'OFF'}
                        </button>
                        {business.isActive ? (
                          <>
                            <button
                              onClick={() => handleBlockClick(business)}
                              className="px-2 py-0.5 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                            >
                              Блок
                            </button>
                            <button
                              onClick={() => handleDeleteClick(business)}
                              className="px-2 py-0.5 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
                            >
                              Видалити
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleUnblock(business)}
                              className="px-2 py-0.5 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                            >
                              Розбл.
                            </button>
                            <button
                              onClick={() => handleDeleteClick(business)}
                              className="px-2 py-0.5 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
                            >
                              Видалити
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Статистика — адаптивна сітка */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="text-sm text-blue-400 mb-1">Всього {search ? '(знайдено)' : ''}</div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {search ? filteredBusinesses.length : businesses.length}
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <div className="text-sm text-green-600 dark:text-green-400 mb-1">Активних</div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {(search ? filteredBusinesses : businesses).filter((b: Business) => b.isActive).length}
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <div className="text-sm text-red-600 dark:text-red-400 mb-1">Заблокованих</div>
              <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                {(search ? filteredBusinesses : businesses).filter((b: Business) => !b.isActive).length}
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <div className="text-sm text-purple-600 dark:text-purple-400 mb-1">Вибрано</div>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{selectedBusinesses.length}</div>
            </div>
          </div>

          {filteredBusinesses.length === 0 && search && (
            <div className="text-center py-12">
              <p className="text-gray-300 mb-2" style={{ letterSpacing: '-0.01em' }}>Нічого не знайдено</p>
              <p className="text-sm text-gray-400">
                Спробуйте змінити параметри пошуку
              </p>
            </div>
          )}

          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-gray-300">
              Показано {filteredBusinesses.length} з {businesses.length} бізнесів
              {search && ` (фільтр: "${search}")`}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-white/10 rounded-lg disabled:opacity-50 bg-white/5 text-white hover:bg-white/10 transition-colors"
                style={{ letterSpacing: '-0.01em' }}
              >
                Назад
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-white/10 rounded-lg disabled:opacity-50 bg-white/5 text-white hover:bg-white/10 transition-colors"
                style={{ letterSpacing: '-0.01em' }}
              >
                Вперед
              </button>
            </div>
          </div>
        </>
      )}

      {/* Block Modal */}
      {blockModalOpen && selectedBusiness && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => { setBlockModalOpen(false); setSelectedBusiness(null); setBlockReason('') }}>
            <div className="relative w-[95%] sm:w-full sm:max-w-md sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-4 text-white" style={{ letterSpacing: '-0.02em' }}>
              Заблокувати акаунт
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-300 mb-2">
                Бізнес: <span className="font-semibold text-white">{selectedBusiness.name}</span>
              </p>
              <p className="text-sm text-gray-300 mb-2">
                ID: <span className="font-mono font-semibold text-blue-400">{selectedBusiness.businessIdentifier}</span>
              </p>
              <p className="text-sm text-gray-300 mb-2">
                Сторінка: {(() => {
                  const { isOnline, label } = getOnlineStatus(selectedBusiness.lastSeenAt)
                  return <span className={isOnline ? 'text-green-400' : 'text-gray-400'}>{label}</span>
                })()}
              </p>
              <p className="text-sm text-gray-300">
                Email: <span className="font-semibold text-white">{selectedBusiness.email}</span>
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2" style={{ letterSpacing: '-0.01em' }}>
                Причина блокування (необов'язково)
              </label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Введіть причину блокування..."
                className="w-full px-4 py-2 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm text-white placeholder-gray-400 resize-none focus:outline-none focus:border-white/20"
                rows={3}
                style={{ letterSpacing: '-0.01em' }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setBlockModalOpen(false)
                  setSelectedBusiness(null)
                  setBlockReason('')
                }}
                className="px-4 py-2 border border-white/10 rounded-lg text-gray-300 hover:bg-white/10 transition-colors bg-white/5"
                disabled={isBlocking}
                style={{ letterSpacing: '-0.01em' }}
              >
                Скасувати
              </button>
              <button
                onClick={handleBlockConfirm}
                disabled={isBlocking}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
                style={{ letterSpacing: '-0.01em' }}
              >
                {isBlocking ? 'Блокування...' : 'Заблокувати'}
              </button>
            </div>
          </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal видалення акаунту */}
      {deleteModalOpen && selectedBusiness && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => { if (!isDeleting) { setDeleteModalOpen(false); setSelectedBusiness(null); setDeleteConfirm('') } }}>
            <div className="relative w-[95%] sm:w-full sm:max-w-md sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-xl font-bold mb-2 text-white" style={{ letterSpacing: '-0.02em' }}>
                Видалити акаунт назавжди
              </h3>
              <p className="text-sm text-red-300/90 mb-3">
                Цю дію не можна скасувати. Буде безповоротно видалено:
              </p>
              <ul className="text-sm text-gray-300 mb-4 list-disc list-inside space-y-1">
                <li>профіль бізнесу та налаштування</li>
                <li>всі записи, клієнти, спеціалісти, послуги</li>
                <li>дані в центрі управління, Telegram-лог</li>
              </ul>
              <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-gray-300"><span className="text-gray-500">Бізнес:</span> <span className="font-semibold text-white">{selectedBusiness.name}</span></p>
                <p className="text-sm text-gray-300"><span className="text-gray-500">Email:</span> <span className="text-white">{selectedBusiness.email}</span></p>
                <p className="text-sm text-gray-300"><span className="text-gray-500">ID:</span> <span className="font-mono text-blue-400">{selectedBusiness.businessIdentifier || '-'}</span></p>
              </div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Введіть <span className="font-mono font-bold text-white">ВИДАЛИТИ</span> для підтвердження:
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="ВИДАЛИТИ"
                className="w-full px-4 py-2.5 border border-white/10 rounded-lg bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50"
                disabled={isDeleting}
                autoComplete="off"
              />
              <div className="flex gap-2 justify-end mt-5">
                <button
                  onClick={() => { if (!isDeleting) { setDeleteModalOpen(false); setSelectedBusiness(null); setDeleteConfirm('') } }}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-white/10 rounded-lg text-gray-300 hover:bg-white/10 transition-colors bg-white/5 disabled:opacity-50"
                >
                  Скасувати
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting || deleteConfirm !== 'ВИДАЛИТИ'}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
                >
                  {isDeleting ? 'Видалення...' : 'Видалити назавжди'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal деталей бізнесу */}
      {detailModalBusiness && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => setDetailModalBusiness(null)}>
            <div className="relative w-[95%] sm:w-full sm:max-w-lg sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setDetailModalBusiness(null)} className="modal-close text-gray-400 hover:text-white rounded-full" aria-label="Закрити">
              <XIcon className="w-5 h-5" />
            </button>
            <div className="pr-10 mb-4">
              <h3 className="modal-title">{detailModalBusiness.name}</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">ID:</span><span className="font-mono text-blue-400">{detailModalBusiness.businessIdentifier || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">UUID:</span><span className="font-mono text-xs text-gray-400 truncate max-w-[200px]" title={detailModalBusiness.id}>{detailModalBusiness.id}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Email:</span><span className="text-white">{detailModalBusiness.email}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Телефон:</span><span className="text-white">{detailModalBusiness.phone || '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Статус:</span><span className={detailModalBusiness.isActive ? 'text-green-400' : 'text-red-400'}>{detailModalBusiness.isActive ? 'Активний' : 'Неактивний'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Реєстрація:</span><span className="text-white">{detailModalBusiness.registrationType === 'telegram' ? 'Telegram' : detailModalBusiness.registrationType === 'google' ? 'Google' : 'Стандартна'}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Дата реєстрації:</span><span className="text-white">{formatDate(detailModalBusiness.registeredAt)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Останній вхід:</span><span className="text-white">{formatDate(detailModalBusiness.lastLoginAt)}</span></div>
            </div>

            <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm font-semibold text-white">AI</div>
                <button
                  onClick={() => onToggleAiChat?.(detailModalBusiness)}
                  disabled={togglingAi?.[detailModalBusiness.businessId] === true}
                  className={`min-h-[36px] px-3 py-1.5 text-xs rounded-lg ${
                    detailModalBusiness.aiChatEnabled ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-600 hover:bg-gray-700'
                  } ${togglingAi?.[detailModalBusiness.businessId] === true ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  AI {detailModalBusiness.aiChatEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-300 flex flex-wrap gap-2">
                <span>
                  Today: {detailModalBusiness.aiUsageToday?.llm ?? 0}/{detailModalBusiness.aiUsageToday?.total ?? 0} LLM
                </span>
                <span>24h: {detailModalBusiness.aiUsage24h?.llm ?? 0}/{detailModalBusiness.aiUsage24h?.total ?? 0} LLM</span>
                <span>429/cooldown 24h: {detailModalBusiness.aiUsage24h?.rateLimited ?? 0}</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                Лічильник показує використання, яке зафіксував наш сервер.
              </div>

              <div className="mt-3 space-y-2 hidden">
                <label className="text-xs text-gray-400">LM Studio (глобально)</label>
                <input
                  type="password"
                  value={aiKeyDraft}
                  onChange={() => {}}
                  placeholder="AIza..."
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white text-sm"
                />
                <label className="text-xs text-gray-400">Модель</label>
                <select
                  value={aiModelDraft}
                  onChange={() => {}}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-black/20 border border-white/10 text-white text-sm"
                >
                  <option value="local-model">local-model</option>
                  <option value="codellama">codellama</option>
                  <option value="llama-3.2">llama-3.2</option>
                  <option value="mistral">mistral</option>
                </select>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={async () => {
                      setSavingAiConfig(true)
                      try {
                        const body: any = {
                          businessId: detailModalBusiness.businessId,
                          action: 'setAiConfig',
                          data: { aiProvider: 'lm_studio' },
                        }

                        const res = await fetch('/api/admin/control-center', {
                          method: 'PATCH',
                          headers: getAuthHeaders(),
                          cache: 'no-store',
                          body: JSON.stringify(body),
                        })
                        const data = await res.json().catch(() => ({}))
                        if (!res.ok) throw new Error(data.error || 'Не вдалося зберегти AI налаштування')

                        setDetailModalBusiness((prev) =>
                          prev
                            ? {
                                ...prev,
                                aiProvider: 'lm_studio',
                                aiModel: aiModelDraft,
                                aiHasKey: prev.aiHasKey || !!aiKeyDraft.trim(),
                              }
                            : prev
                        )
                        setAiKeyDraft('')
                        toast({ title: 'AI налаштування збережено', type: 'success', duration: 1500 })
                        await onDataChanged?.()
                      } catch (e) {
                        toast({
                          title: 'Помилка',
                          description: e instanceof Error ? e.message : 'Не вдалося зберегти AI налаштування',
                          type: 'error',
                        })
                      } finally {
                        setSavingAiConfig(false)
                      }
                    }}
                    disabled={savingAiConfig}
                    className="min-h-[44px] px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 disabled:opacity-50"
                  >
                    {savingAiConfig ? 'Збереження...' : 'Зберегти AI'}
                  </button>
                  <button
                    onClick={async () => {
                      setSavingAiConfig(true)
                      try {
                        const res = await fetch('/api/admin/control-center', {
                          method: 'PATCH',
                          headers: getAuthHeaders(),
                          cache: 'no-store',
                          body: JSON.stringify({
                            businessId: detailModalBusiness.businessId,
                            action: 'setAiConfig',
                            data: { aiProvider: 'lm_studio' },
                          }),
                        })
                        const data = await res.json().catch(() => ({}))
                        if (!res.ok) throw new Error(data.error || 'Не вдалося оновити')
                        setDetailModalBusiness((prev) => (prev ? { ...prev, aiProvider: 'lm_studio' } : prev))
                        toast({ title: 'AI: lm_studio', type: 'success', duration: 1500 })
                        await onDataChanged?.()
                      } catch (e) {
                        toast({ title: 'Помилка', description: e instanceof Error ? e.message : 'Не вдалося очистити ключ', type: 'error' })
                      } finally {
                        setSavingAiConfig(false)
                      }
                    }}
                    disabled={savingAiConfig}
                    className="min-h-[44px] px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 disabled:opacity-50"
                  >
                    Очистити key
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {detailModalBusiness.isActive ? (
                <button onClick={() => { setDetailModalBusiness(null); handleBlockClick(detailModalBusiness) }} className="min-h-[44px] px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30">Заблокувати</button>
              ) : (
                <button onClick={async () => { await handleUnblock(detailModalBusiness); setDetailModalBusiness(null); onDataChanged?.(); }} className="min-h-[44px] px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30">Розблокувати</button>
              )}
              <button onClick={() => { const id = detailModalBusiness.businessIdentifier || ''; navigator.clipboard.writeText(id); toast({ title: id ? 'ID скопійовано' : 'ID відсутній', type: id ? 'success' : 'info' }); }} className="min-h-[44px] px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20">Копіювати ID</button>
              <button
                onClick={() => {
                  setSelectedBusiness(detailModalBusiness)
                  setDeleteConfirm('')
                  setDetailModalBusiness(null)
                  setDeleteModalOpen(true)
                }}
                className="min-h-[44px] px-4 py-2 bg-gray-500/20 text-gray-300 rounded-lg hover:bg-red-500/20 hover:text-red-400 border border-gray-500/30"
              >
                Видалити акаунт
              </button>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  )
}

// Phones Tab Component
function PhonesTab({ refreshTrigger }: { refreshTrigger?: number }) {
  const [phones, setPhones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<'all' | 'BUSINESS' | 'CLIENT'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadPhones()
  }, [category, search, refreshTrigger])

  const loadPhones = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        _t: Date.now().toString(),
        ...(category !== 'all' && { category }),
        ...(search && { search }),
      })
      const response = await fetch(`/api/admin/phone-directory?${params}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.ok) {
        setPhones(data.phones || [])
      }
    } catch (error) {
      console.error('Error loading phones:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 min-w-0">
      <h2 className="text-xl sm:text-2xl font-bold text-white">
        Телефонний довідник
      </h2>
      
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as any)}
          className="min-h-[44px] px-4 py-2 border border-white/10 rounded-lg bg-white/5 text-white w-full sm:w-auto touch-manipulation"
        >
          <option value="all">Всі категорії</option>
          <option value="BUSINESS">Бізнеси</option>
          <option value="CLIENT">Клієнти</option>
        </select>
        
        <input
          type="text"
          placeholder="Пошук по номеру..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-h-[44px] min-w-0 px-4 py-2 border border-white/10 rounded-lg bg-white/5 text-white placeholder-gray-400 touch-manipulation"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-white">Завантаження...</div>
      ) : phones.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Немає номерів у довіднику</div>
      ) : (
        <>
          {/* Мобільні картки */}
          <div className="block md:hidden space-y-3">
            {phones.map((phone: any) => (
              <div key={phone.id} className="rounded-xl p-4 card-glass border border-white/10 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <a href={`tel:${phone.phone}`} className="font-semibold text-white text-lg">{phone.phone}</a>
                  <span className={`px-2 py-0.5 rounded text-xs shrink-0 ${
                    phone.category === 'BUSINESS' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'
                  }`}>
                    {phone.category === 'BUSINESS' ? 'Бізнес' : 'Клієнт'}
                  </span>
                </div>
                <div className="text-sm text-gray-300">{phone.businessName || phone.clientName || '-'}</div>
                <div className="flex items-center gap-2">
                  {phone.isActive ? (
                    <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-300">Активний</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-300">Неактивний</span>
                  )}
                  <span className="text-xs text-gray-500">
                    {phone.lastUsedAt ? format(new Date(phone.lastUsedAt), 'dd.MM.yyyy', { locale: uk }) : 'Ніколи'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {/* Десктоп таблиця */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-gray-300 font-semibold">Номер</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-semibold">Категорія</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-semibold">Назва</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-semibold">Статус</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-semibold">Останнє використання</th>
                </tr>
              </thead>
              <tbody>
                {phones.map((phone: any) => (
                  <tr key={phone.id} className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-3 px-4 font-medium text-white">{phone.phone}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs ${
                        phone.category === 'BUSINESS' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'
                      }`}>
                        {phone.category === 'BUSINESS' ? 'Бізнес' : 'Клієнт'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-300">{phone.businessName || phone.clientName || '-'}</td>
                    <td className="py-3 px-4">
                      {phone.isActive ? (
                        <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-300">Активний</span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-300">Неактивний</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {phone.lastUsedAt ? format(new Date(phone.lastUsedAt), 'dd.MM.yyyy', { locale: uk }) : 'Ніколи'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// Activity Tab Component
function ActivityTab({ refreshTrigger }: { refreshTrigger?: number }) {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionType, setActionType] = useState<string>('all')

  useEffect(() => {
    loadLogs()
  }, [actionType, refreshTrigger])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        _t: Date.now().toString(),
        ...(actionType !== 'all' && { actionType }),
      })
      const response = await fetch(`/api/admin/activity-log?${params}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.ok) {
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Error loading logs:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">
        Архів дій
      </h2>
      
      <div className="mb-6">
        <select
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          className="px-4 py-2 border border-white/10 rounded-lg bg-white/5 text-white"
        >
          <option value="all">Всі дії</option>
          <option value="business_created">Створення бізнесу</option>
          <option value="client_created">Створення клієнта</option>
          <option value="appointment_created">Створення запису</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white">Завантаження...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Немає записів в архіві</div>
      ) : (
        <div className="space-y-4">
          {logs.map((log: any, index: number) => (
            <div key={index} className="border border-white/10 rounded-lg p-4 card-glass">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="font-medium text-white">{log.action_type}</div>
                  <div className="text-sm text-gray-400">
                    Бізнес: {log.business_name || log.business_id}
                  </div>
                  {log.client_name && (
                    <div className="text-sm text-gray-400">
                      Клієнт: {log.client_name} ({log.client_phone})
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-500 shrink-0">
                  {format(new Date(log.created_at), 'dd.MM.yyyy HH:mm', { locale: uk })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Graph Tab Component
function GraphTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">
        Граф зв'язків
      </h2>
      <div className="card-glass rounded-xl p-8 text-center">
        <LinkIcon className="w-16 h-16 mx-auto mb-4 text-blue-400/50" />
        <p className="text-gray-300 mb-2">
          Візуалізація зв'язків між бізнесами, клієнтами та спеціалістами
        </p>
        <p className="text-sm text-gray-500">
          Модуль у розробці. Тут буде інтерактивний граф: бізнеси — майстри — клієнти — записи.
        </p>
      </div>
    </div>
  )
}

// Analytics Tab Component
function AnalyticsTab({ stats, refreshTrigger }: { stats: any; refreshTrigger?: number }) {
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month')

  useEffect(() => {
    loadAnalytics()
  }, [period, refreshTrigger])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/analytics?period=${period}`, {
        headers: getAuthHeaders(),
      })
      const data = await response.json()
      if (response.ok) {
        setAnalytics(data)
      }
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-white">Завантаження...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-white">
          Аналітика
        </h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as any)}
          className="px-4 py-2 border border-white/10 rounded-lg bg-white/5 text-white"
        >
          <option value="day">День</option>
          <option value="week">Тиждень</option>
          <option value="month">Місяць</option>
          <option value="year">Рік</option>
        </select>
      </div>

      {analytics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="card-glass rounded-xl p-6">
            <div className="text-sm text-gray-400 mb-2">Всього бізнесів</div>
            <div className="text-3xl font-bold text-white">{analytics.overview?.totalBusinesses || 0}</div>
          </div>
          <div className="card-glass rounded-xl p-6">
            <div className="text-sm text-gray-400 mb-2">Активні</div>
            <div className="text-3xl font-bold text-white">{analytics.overview?.activeBusinesses || 0}</div>
          </div>
          <div className="card-glass rounded-xl p-6">
            <div className="text-sm text-gray-400 mb-2">Реєстрацій за період</div>
            <div className="text-3xl font-bold text-white">{analytics.registrations?.total || 0}</div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">Немає даних аналітики</div>
      )}
    </div>
  )
}

// Integrations Tab Component
function IntegrationsTab({ refreshTrigger }: { refreshTrigger?: number }) {
  const [integrations, setIntegrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadIntegrations()
  }, [refreshTrigger])

  const loadIntegrations = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/integrations?_t=${Date.now()}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.ok) {
        setIntegrations(data.integrations || [])
      }
    } catch (error) {
      console.error('Error loading integrations:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">
        Інтеграції
      </h2>
      {loading ? (
        <div className="text-center py-12 text-white">Завантаження...</div>
      ) : integrations.length === 0 ? (
        <div className="card-glass rounded-xl p-8 text-center">
          <LinkIcon className="w-16 h-16 mx-auto mb-4 text-gray-400/50" />
          <p className="text-gray-400">Немає активних інтеграцій</p>
        </div>
      ) : (
        <div className="space-y-4">
          {integrations.map((integration: any) => (
            <div key={integration.id} className="border border-white/10 rounded-lg p-4 card-glass">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <div className="font-medium text-white">{integration.platform}</div>
                  <div className="text-sm text-gray-400">
                    {integration.business?.name || 'Невідомий бізнес'}
                  </div>
                </div>
                <div>
                  {integration.isConnected ? (
                    <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-300">Підключено</span>
                  ) : (
                    <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-300">Відключено</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Security Tab Component
function SecurityTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">
        Безпека
      </h2>
      <div className="card-glass rounded-xl p-8 text-center">
        <ShieldIcon className="w-16 h-16 mx-auto mb-4 text-green-400/50" />
        <p className="text-gray-300 mb-2">
          Управління безпекою та доступом
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Модуль у розробці. Планується: аудит логів, 2FA, обмеження IP, сесії.
        </p>
        <div className="text-left max-w-md mx-auto text-sm text-gray-400 space-y-1">
          <p>• JWT токени для авторизації</p>
          <p>• RLS для ізоляції даних бізнесів</p>
          <p>• Ролі: SUPER_ADMIN, ADMIN, VIEWER</p>
        </div>
      </div>
    </div>
  )
}

// Finances Tab Component
function FinancesTab({ refreshTrigger }: { refreshTrigger?: number }) {
  const [finances, setFinances] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month')

  useEffect(() => {
    loadFinances()
  }, [period, refreshTrigger])

  const loadFinances = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/finances?period=${period}&_t=${Date.now()}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.ok) {
        setFinances(data)
      }
    } catch (error) {
      console.error('Error loading finances:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(amount))
  }

  if (loading) {
    return <div className="text-center py-12 text-white">Завантаження...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-white">
          Фінанси
        </h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as any)}
          className="px-4 py-2 border border-white/10 rounded-lg bg-white/5 text-white"
        >
          <option value="day">День</option>
          <option value="week">Тиждень</option>
          <option value="month">Місяць</option>
          <option value="year">Рік</option>
        </select>
      </div>

      {finances ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card-glass rounded-xl p-6">
              <div className="text-sm text-gray-400 mb-2">Загальний дохід</div>
              <div className="text-3xl font-bold text-white">{formatCurrency(finances.totalRevenue || 0)}</div>
            </div>
            <div className="card-glass rounded-xl p-6">
              <div className="text-sm text-gray-400 mb-2">Всього платежів</div>
              <div className="text-3xl font-bold text-white">{finances.totalPayments || 0}</div>
            </div>
          </div>

          {finances.topBusinesses?.length > 0 && (
            <div>
              <h3 className="text-xl font-bold mb-4 text-white">Топ бізнеси за доходами</h3>
              <div className="space-y-2">
                {finances.topBusinesses.map((business: any, index: number) => (
                  <div key={index} className="flex justify-between items-center border-b border-white/10 py-2">
                    <div className="text-gray-300">{business.businessName}</div>
                    <div className="font-bold text-white">{formatCurrency(business.revenue)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">Немає фінансових даних</div>
      )}
    </div>
  )
}

// Clients Tab Component
function ClientsTab({ refreshTrigger }: { refreshTrigger?: number }) {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadClients()
  }, [search, refreshTrigger])

  const loadClients = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        _t: Date.now().toString(),
        ...(search && { search }),
      })
      const response = await fetch(`/api/admin/clients?${params}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      })
      const data = await response.json()
      if (response.ok) {
        setClients(data.clients || [])
      }
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 min-w-0">
      <h2 className="text-xl sm:text-2xl font-bold text-white">
        Клієнти
      </h2>
      
      <div className="mb-6">
        <input
          type="text"
          placeholder="Пошук клієнтів..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full min-h-[44px] px-4 py-2 border border-white/10 rounded-lg bg-white/5 text-white placeholder-gray-400"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-white">Завантаження...</div>
      ) : clients.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Немає клієнтів</div>
      ) : (
        <>
          {/* Мобільні картки */}
          <div className="block md:hidden space-y-3">
            {clients.map((client: any) => (
              <div key={client.id} className="rounded-xl p-4 card-glass border border-white/10 space-y-2">
                <div className="font-semibold text-white">{client.name}</div>
                <a href={`tel:${client.phone}`} className="text-blue-300 text-sm">{client.phone}</a>
                <div className="text-sm text-gray-400">{client.business?.name || '-'}</div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-300">{client.appointments?.length || 0} візитів</span>
                  <span className="font-medium text-white">
                    {new Intl.NumberFormat('uk-UA', {
                      style: 'currency',
                      currency: 'UAH',
                      minimumFractionDigits: 0,
                    }).format((Number(client.totalSpent) || 0) / 100)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {/* Десктоп таблиця */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-gray-300 font-semibold">Ім'я</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-semibold">Телефон</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-semibold">Бізнес</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-semibold">Візитів</th>
                  <th className="text-left py-3 px-4 text-gray-300 font-semibold">Витрачено</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client: any) => (
                  <tr key={client.id} className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-3 px-4 font-medium text-white">{client.name}</td>
                    <td className="py-3 px-4 text-gray-300">{client.phone}</td>
                    <td className="py-3 px-4 text-gray-300">{client.business?.name || '-'}</td>
                    <td className="py-3 px-4 text-gray-300">{client.appointments?.length || 0}</td>
                    <td className="py-3 px-4 text-white font-medium">
                      {new Intl.NumberFormat('uk-UA', {
                        style: 'currency',
                        currency: 'UAH',
                        minimumFractionDigits: 0,
                      }).format((Number(client.totalSpent) || 0) / 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// Settings Tab Component
function SettingsTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">
        Налаштування Центру управління
      </h2>
      <div className="card-glass rounded-xl p-8 text-center">
        <SettingsIcon className="w-16 h-16 mx-auto mb-4 text-gray-400/50" />
        <p className="text-gray-300 mb-2">
          Системні налаштування
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Модуль у розробці. Планується: теми, частота оновлень, формати експорту, webhook.
        </p>
        <div className="text-left max-w-md mx-auto text-sm text-gray-400 space-y-1">
          <p>• Оновлення даних: кожні 15 сек</p>
          <p>• Live Stats Bar: кожні 3 сек</p>
        </div>
      </div>
    </div>
  )
}

// Підписки — керування тарифами та trial
const PLAN_LABELS: Record<string, string> = {
  FREE: 'Безкоштовний',
  START: 'Старт',
  BUSINESS: 'Бізнес',
  PRO: 'Про',
}

function SubscriptionsTab({
  businesses,
  loading,
  formatDate,
  onDataChanged,
}: {
  businesses: Business[]
  loading: boolean
  formatDate: (date: Date | null) => string
  onDataChanged: () => void
}) {
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [trialFilter, setTrialFilter] = useState<'all' | 'trial' | 'expired'>('all')
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editBusiness, setEditBusiness] = useState<Business | null>(null)
  const [editPlan, setEditPlan] = useState<string>('FREE')
  const [extendTrialDays, setExtendTrialDays] = useState<number>(0)
  const [saving, setSaving] = useState(false)

  const filtered = businesses.filter((b: Business) => {
    if (planFilter !== 'all' && (b.subscriptionPlan || 'FREE') !== planFilter) return false
    const trialEnd = b.trialEndsAt ? new Date(b.trialEndsAt) : null
    const now = new Date()
    if (trialFilter === 'trial' && (!trialEnd || trialEnd <= now)) return false
    if (trialFilter === 'expired') {
      if (!trialEnd || trialEnd > now) return false
      if ((b.subscriptionPlan || 'FREE') !== 'FREE') return false
    }
    return true
  })

  const handleOpenEdit = (b: Business) => {
    setEditBusiness(b)
    setEditPlan(b.subscriptionPlan || 'FREE')
    setExtendTrialDays(0)
    setEditModalOpen(true)
  }

  const handleSaveSubscription = async () => {
    if (!editBusiness) return
    setSaving(true)
    try {
      const body: { subscriptionPlan?: string; trialEndsAt?: string | null; extendTrialDays?: number; subscriptionStatus?: string } = {}
      if (editPlan === 'FREE' || editPlan === 'START' || editPlan === 'BUSINESS' || editPlan === 'PRO') {
        body.subscriptionPlan = editPlan
      }
      if (extendTrialDays > 0) {
        body.extendTrialDays = extendTrialDays
      }
      const response = await fetch('/api/admin/control-center', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          businessId: editBusiness.id,
          action: 'updateSubscription',
          data: body,
        }),
      })
      if (response.ok) {
        setEditModalOpen(false)
        setEditBusiness(null)
        onDataChanged?.()
        toast({ title: 'Підписку оновлено', type: 'success' })
      } else {
        const data = await response.json()
        toast({ title: data.error || 'Помилка оновлення', type: 'error' })
      }
    } catch (e) {
      console.error(e)
      toast({ title: 'Помилка оновлення підписки', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const getTrialLabel = (b: Business) => {
    const trialEnd = b.trialEndsAt ? new Date(b.trialEndsAt) : null
    if (!trialEnd) return '—'
    const now = new Date()
    if (trialEnd > now) return `Trial до ${formatDate(trialEnd)}`
    return `Trial закінчився ${formatDate(trialEnd)}`
  }

  return (
    <div className="min-w-0">
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Підписки та trial</h2>
      <p className="text-gray-400 text-sm mb-4">
        Керування тарифами (Старт, Бізнес, Про) та безкоштовним trial. Новий бізнес отримує 14 днів trial.
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="min-h-[44px] px-4 py-2 border border-white/10 rounded-lg bg-white/5 text-white"
        >
          <option value="all">Всі тарифи</option>
          {Object.entries(PLAN_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={trialFilter}
          onChange={(e) => setTrialFilter(e.target.value as 'all' | 'trial' | 'expired')}
          className="min-h-[44px] px-4 py-2 border border-white/10 rounded-lg bg-white/5 text-white"
        >
          <option value="all">Усі по trial</option>
          <option value="trial">На trial</option>
          <option value="expired">Trial закінчився</option>
        </select>
      </div>

      {loading ? (
        <div className="text-gray-400 py-8">Завантаження...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-2 text-gray-400 font-medium">Бізнес</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">Тариф</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">Trial</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">Дії</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b: Business) => (
                <tr key={b.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-2">
                    <div className="font-medium text-white">{b.name}</div>
                    <div className="text-sm text-gray-400">{b.email}</div>
                  </td>
                  <td className="py-3 px-2 text-white">{PLAN_LABELS[b.subscriptionPlan || 'FREE'] || b.subscriptionPlan}</td>
                  <td className="py-3 px-2 text-gray-300">{getTrialLabel(b)}</td>
                  <td className="py-3 px-2">
                    <button
                      onClick={() => handleOpenEdit(b)}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium"
                    >
                      Змінити
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-gray-400 py-8 text-center">Немає бізнесів за обраними фільтрами</div>
          )}
        </div>
      )}

      {editModalOpen && editBusiness && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => { if (!saving) { setEditModalOpen(false); setEditBusiness(null) } }}>
            <div className="bg-[#1e293b] rounded-xl p-6 max-w-md w-full border border-white/10" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Редагувати підписку · {editBusiness.name}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Тариф</label>
                <select
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                  className="w-full min-h-[44px] px-4 py-2 border border-white/10 rounded-lg bg-white/5 text-white"
                >
                  {Object.entries(PLAN_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Продовжити trial (днів)</label>
                <input
                  type="number"
                  min={0}
                  value={extendTrialDays || ''}
                  onChange={(e) => setExtendTrialDays(parseInt(e.target.value, 10) || 0)}
                  className="w-full min-h-[44px] px-4 py-2 border border-white/10 rounded-lg bg-white/5 text-white"
                  placeholder="0 — не змінювати"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveSubscription}
                disabled={saving}
                className="flex-1 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50"
              >
                {saving ? 'Збереження...' : 'Зберегти'}
              </button>
              <button
                onClick={() => { if (!saving) { setEditModalOpen(false); setEditBusiness(null) } }}
                className="px-4 py-2 rounded-lg border border-white/20 text-gray-300 hover:bg-white/10"
              >
                Скасувати
              </button>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  )
}

// Admins Tab Component
function AdminsTab({ refreshTrigger }: { refreshTrigger?: number }) {
  const [admins, setAdmins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingAdmin, setEditingAdmin] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER'>('all')

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'ADMIN' as 'SUPER_ADMIN' | 'ADMIN' | 'VIEWER',
    permissions: [] as string[],
    isActive: true,
  })

  const allPermissions = [
    'VIEW_BUSINESSES',
    'EDIT_BUSINESSES',
    'DELETE_BUSINESSES',
    'VIEW_CLIENTS',
    'VIEW_ANALYTICS',
    'VIEW_FINANCES',
    'MANAGE_ADMINS',
    'EXPORT_DATA',
  ]

  useEffect(() => {
    loadAdmins()
  }, [search, roleFilter, refreshTrigger])

  const loadAdmins = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(roleFilter !== 'all' && { role: roleFilter }),
      })
      const response = await fetch(`/api/admin/admins?${params}`, {
        headers: getAuthHeaders(),
      })
      const data = await response.json()
      if (response.ok) {
        setAdmins(data.admins || [])
      }
    } catch (error) {
      console.error('Error loading admins:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const response = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        setShowCreateModal(false)
        setFormData({
          email: '',
          password: '',
          name: '',
          role: 'ADMIN',
          permissions: [],
          isActive: true,
        })
        loadAdmins()
      } else {
        alert(data.error || 'Помилка створення адміна')
      }
    } catch (error) {
      console.error('Error creating admin:', error)
      alert('Помилка створення адміна')
    }
  }

  const handleUpdate = async () => {
    if (!editingAdmin) return

    try {
      const response = await fetch(`/api/admin/admins/${editingAdmin.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        setEditingAdmin(null)
        setFormData({
          email: '',
          password: '',
          name: '',
          role: 'ADMIN',
          permissions: [],
          isActive: true,
        })
        loadAdmins()
      } else {
        alert(data.error || 'Помилка оновлення адміна')
      }
    } catch (error) {
      console.error('Error updating admin:', error)
      alert('Помилка оновлення адміна')
    }
  }

  const handleDelete = async (adminId: string) => {
    if (!confirm('Ви впевнені, що хочете видалити цього адміна?')) return

    try {
      const response = await fetch(`/api/admin/admins/${adminId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })

      if (response.ok) {
        loadAdmins()
      } else {
        const data = await response.json()
        alert(data.error || 'Помилка видалення адміна')
      }
    } catch (error) {
      console.error('Error deleting admin:', error)
      alert('Помилка видалення адміна')
    }
  }

  const handleEdit = (admin: any) => {
    setEditingAdmin(admin)
    setFormData({
      email: admin.email,
      password: '',
      name: admin.name || '',
      role: admin.role,
      permissions: admin.permissions || [],
      isActive: admin.isActive,
    })
    setShowCreateModal(true)
  }

  const togglePermission = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission],
    }))
  }

  return (
    <div className="min-w-0">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          Адміністратори
        </h2>
        <button
          onClick={() => {
            setEditingAdmin(null)
            setFormData({
              email: '',
              password: '',
              name: '',
              role: 'ADMIN',
              permissions: [],
              isActive: true,
            })
            setShowCreateModal(true)
          }}
          className="min-h-[44px] px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shrink-0"
        >
          + Додати адміна
        </button>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="flex-1 relative min-w-0">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Пошук по email або імені..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[44px] pl-10 pr-4 py-2 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm text-white"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
          className="min-h-[44px] px-4 py-2 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm text-white w-full sm:w-auto"
        >
          <option value="all">Всі ролі</option>
          <option value="SUPER_ADMIN">Супер адмін</option>
          <option value="ADMIN">Адмін</option>
          <option value="VIEWER">Переглядач</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">Завантаження...</div>
      ) : (
        <>
          {/* Мобільні картки */}
          <div className="block md:hidden space-y-3">
            {admins.map((admin: any) => (
              <div key={admin.id} className="rounded-xl p-4 card-glass border border-white/10 space-y-3">
                <div className="font-medium text-white">{admin.email}</div>
                <div className="text-sm text-gray-400">{admin.name || '-'}</div>
                <div className="flex flex-wrap gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    admin.role === 'SUPER_ADMIN' ? 'bg-purple-500/20 text-purple-300' :
                    admin.role === 'ADMIN' ? 'bg-blue-500/20 text-blue-300' :
                    'bg-gray-500/20 text-gray-300'
                  }`}>
                    {admin.role === 'SUPER_ADMIN' ? 'Супер адмін' :
                     admin.role === 'ADMIN' ? 'Адмін' :
                     'Переглядач'}
                  </span>
                  {admin.isActive ? (
                    <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-300">Активний</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-300">Неактивний</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  Останній вхід: {admin.lastLoginAt ? format(new Date(admin.lastLoginAt), 'dd.MM.yyyy HH:mm', { locale: uk }) : 'Ніколи'}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleEdit(admin)}
                    className="min-h-[40px] px-3 py-2 text-blue-400 text-sm font-medium rounded-lg bg-blue-500/20 hover:bg-blue-500/30"
                  >
                    Редагувати
                  </button>
                  <button
                    onClick={() => handleDelete(admin.id)}
                    className="min-h-[40px] px-3 py-2 text-red-400 text-sm font-medium rounded-lg bg-red-500/20 hover:bg-red-500/30"
                  >
                    Видалити
                  </button>
                </div>
              </div>
            ))}
          </div>
          {/* Десктоп таблиця */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4">Email</th>
                  <th className="text-left py-3 px-4">Ім'я</th>
                  <th className="text-left py-3 px-4">Роль</th>
                  <th className="text-left py-3 px-4">Права доступу</th>
                  <th className="text-left py-3 px-4">Статус</th>
                  <th className="text-left py-3 px-4">Останній вхід</th>
                  <th className="text-left py-3 px-4">Дії</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin: any) => (
                  <tr key={admin.id} className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-3 px-4 font-medium">{admin.email}</td>
                    <td className="py-3 px-4">{admin.name || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        admin.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                        admin.role === 'ADMIN' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {admin.role === 'SUPER_ADMIN' ? 'Супер адмін' :
                         admin.role === 'ADMIN' ? 'Адмін' :
                         'Переглядач'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-gray-300">
                        {admin.permissions?.length || 0} прав
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {admin.isActive ? (
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">Активний</span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">Неактивний</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-300">
                      {admin.lastLoginAt ? format(new Date(admin.lastLoginAt), 'dd.MM.yyyy HH:mm', { locale: uk }) : 'Ніколи'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(admin)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                        >
                          Редагувати
                        </button>
                        <button
                          onClick={() => handleDelete(admin.id)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400"
                        >
                          Видалити
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card-glass rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-white">
              {editingAdmin ? 'Редагувати адміна' : 'Створити нового адміна'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-sm font-medium">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingAdmin}
                  className="w-full px-4 py-2 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm text-white disabled:opacity-50"
                  required
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium">
                  Пароль {editingAdmin ? '(залиште порожнім, щоб не змінювати)' : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm text-white"
                  required={!editingAdmin}
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium">Ім'я</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm text-white"
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium">Роль *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-4 py-2 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm text-white"
                >
                  <option value="SUPER_ADMIN">Супер адмін</option>
                  <option value="ADMIN">Адмін</option>
                  <option value="VIEWER">Переглядач</option>
                </select>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium">Права доступу</label>
                <div className="space-y-2 border border-white/10 rounded-lg p-4">
                  {allPermissions.map((permission) => (
                    <label key={permission} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(permission)}
                        onChange={() => togglePermission(permission)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-300">
                        {permission.replace(/_/g, ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium">Активний</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex gap-4 justify-end">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setEditingAdmin(null)
                  setFormData({
                    email: '',
                    password: '',
                    name: '',
                    role: 'ADMIN',
                    permissions: [],
                    isActive: true,
                  })
                }}
                className="px-4 py-2 border border-white/10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Скасувати
              </button>
              <button
                onClick={editingAdmin ? handleUpdate : handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {editingAdmin ? 'Оновити' : 'Створити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Export Tab Component
function ExportTab() {
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'json'>('csv')
  const [exportType, setExportType] = useState<'businesses' | 'clients' | 'phones' | 'all'>('businesses')
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const response = await fetch(`/api/admin/export?format=${exportFormat}&type=${exportType}&_t=${Date.now()}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-${exportType}-${new Date().toISOString().split('T')[0]}.${exportFormat}`
      a.click()
    } catch (error) {
      console.error('Error exporting:', error)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">
        Експорт/Імпорт даних
      </h2>
      
      <div className="card-glass rounded-xl p-6 max-w-md space-y-4">
        <div>
          <label className="block mb-2 text-gray-300">Формат експорту</label>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as any)}
            className="w-full px-4 py-2 border border-white/10 rounded-lg bg-white/5 text-white"
          >
            <option value="csv">CSV</option>
            <option value="excel">Excel</option>
            <option value="json">JSON</option>
          </select>
        </div>

        <div>
          <label className="block mb-2 text-gray-300">Тип даних</label>
          <select
            value={exportType}
            onChange={(e) => setExportType(e.target.value as any)}
            className="w-full px-4 py-2 border border-white/10 rounded-lg bg-white/5 text-white"
          >
            <option value="businesses">Бізнеси</option>
            <option value="clients">Клієнти</option>
            <option value="phones">Телефонний довідник</option>
            <option value="all">Всі дані</option>
          </select>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <DownloadIcon className="w-5 h-5" />
          {exporting ? 'Експорт...' : 'Експортувати'}
        </button>
      </div>
    </div>
  )
}


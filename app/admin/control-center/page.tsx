'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
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
  DatabaseIcon
} from '@/components/icons'

type Tab = 'overview' | 'businesses' | 'phones' | 'activity' | 'graph' | 'analytics' | 'integrations' | 'security' | 'finances' | 'clients' | 'settings' | 'export'

interface Business {
  id: string
  businessId: string
  name: string
  email: string
  phone: string | null
  isActive: boolean
  registeredAt: Date
  lastLoginAt: Date | null
  registrationType: 'telegram' | 'google' | 'standard'
  businessIdentifier: string | null
  niche: string
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
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Перевірка авторизації
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('adminToken')
      
      if (!token) {
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

  const loadData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('adminToken')
      if (!token) {
        router.push('/admin/login')
        return
      }

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      })

      const response = await fetch(`/api/admin/control-center?${params}`, {
        headers: getAuthHeaders(),
      })
      const data = await response.json()

      if (response.ok) {
        setBusinesses(data.businesses || [])
        setStats(data.stats || {})
        setTotalPages(data.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBusinessClick = (businessId: string) => {
    router.push(`/admin/control-center/business/${businessId}`)
  }

  const formatDate = (date: Date | null) => {
    if (!date) return 'Ніколи'
    return format(new Date(date), 'dd.MM.yyyy HH:mm', { locale: uk })
  }

  const tabs = [
    { id: 'overview', label: 'Огляд', icon: BuildingIcon },
    { id: 'businesses', label: 'Бізнеси', icon: UsersIcon },
    { id: 'phones', label: 'Телефонний довідник', icon: PhoneIcon },
    { id: 'activity', label: 'Архів дій', icon: CalendarIcon },
    { id: 'graph', label: 'Граф зв\'язків', icon: LinkIcon },
    { id: 'analytics', label: 'Аналітика', icon: ChartIcon },
    { id: 'integrations', label: 'Інтеграції', icon: LinkIcon },
    { id: 'security', label: 'Безпека', icon: ShieldIcon },
    { id: 'finances', label: 'Фінанси', icon: MoneyIcon },
    { id: 'clients', label: 'Клієнти', icon: UsersIcon },
    { id: 'settings', label: 'Налаштування', icon: SettingsIcon },
    { id: 'export', label: 'Експорт/Імпорт', icon: DownloadIcon },
  ]

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Перевірка доступу...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-2">
          🎯 Центр управління
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Управління всіма бізнесами та процесами системи
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`px-4 py-2 flex items-center gap-2 font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        {activeTab === 'overview' && (
          <OverviewTab stats={stats} loading={loading} />
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
            onBusinessClick={handleBusinessClick}
            formatDate={formatDate}
          />
        )}

        {activeTab === 'phones' && (
          <PhonesTab />
        )}

        {activeTab === 'activity' && (
          <ActivityTab />
        )}

        {activeTab === 'graph' && (
          <GraphTab />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab stats={stats} />
        )}

        {activeTab === 'integrations' && (
          <IntegrationsTab />
        )}

        {activeTab === 'security' && (
          <SecurityTab />
        )}

        {activeTab === 'finances' && (
          <FinancesTab />
        )}

        {activeTab === 'clients' && (
          <ClientsTab />
        )}

        {activeTab === 'settings' && (
          <SettingsTab />
        )}

        {activeTab === 'export' && (
          <ExportTab />
        )}
      </div>
    </div>
  )
}

// Overview Tab Component
function OverviewTab({ stats, loading }: { stats: any; loading: boolean }) {
  if (loading) {
    return <div className="text-center py-12">Завантаження...</div>
  }

  const cards = [
    {
      title: 'Всього бізнесів',
      value: stats?.total || 0,
      icon: BuildingIcon,
      color: 'blue',
    },
    {
      title: 'Активні',
      value: stats?.active || 0,
      icon: CheckIcon,
      color: 'green',
    },
    {
      title: 'Неактивні',
      value: stats?.inactive || 0,
      icon: XIcon,
      color: 'red',
    },
    {
      title: 'Через Telegram',
      value: stats?.telegram || 0,
      icon: PhoneIcon,
      color: 'purple',
    },
    {
      title: 'Через Google',
      value: stats?.google || 0,
      icon: UsersIcon,
      color: 'orange',
    },
    {
      title: 'Стандартна реєстрація',
      value: stats?.standard || 0,
      icon: BuildingIcon,
      color: 'gray',
    },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Статистика системи
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, index) => {
          const Icon = card.icon
          return (
            <div
              key={index}
              className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-600"
            >
              <div className="flex items-center justify-between mb-4">
                <Icon className={`w-8 h-8 text-${card.color}-500`} />
                <span className="text-3xl font-black text-gray-900 dark:text-white">
                  {card.value}
                </span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                {card.title}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Businesses Tab Component
function BusinessesTab({ businesses, loading, search, setSearch, statusFilter, setStatusFilter, page, setPage, totalPages, onBusinessClick, formatDate }: any) {
  const [selectedBusinesses, setSelectedBusinesses] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState<string>('')

  const handleBulkAction = async () => {
    if (!bulkAction || selectedBusinesses.length === 0) return

    try {
      for (const businessId of selectedBusinesses) {
        await fetch('/api/admin/control-center', {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            businessId,
            action: bulkAction,
          }),
        })
      }
      setSelectedBusinesses([])
      setBulkAction('')
      window.location.reload()
    } catch (error) {
      console.error('Error performing bulk action:', error)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Пошук по назві, email, телефону..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="all">Всі статуси</option>
          <option value="active">Активні</option>
          <option value="inactive">Неактивні</option>
        </select>

        {selectedBusinesses.length > 0 && (
          <div className="flex gap-2">
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
            >
              <option value="">Оберіть дію</option>
              <option value="activate">Активувати</option>
              <option value="deactivate">Деактивувати</option>
            </select>
            <button
              onClick={handleBulkAction}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Застосувати ({selectedBusinesses.length})
            </button>
          </div>
        )}

        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
          <DownloadIcon className="w-5 h-5" />
          Експорт
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Завантаження...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4">
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBusinesses(businesses.map((b: Business) => b.businessId))
                        } else {
                          setSelectedBusinesses([])
                        }
                      }}
                    />
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Назва</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Телефон</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Тип реєстрації</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Статус</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Останній вхід</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Дії</th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((business: Business) => (
                  <tr
                    key={business.id}
                    className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="py-3 px-4">
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
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900 dark:text-white cursor-pointer" onClick={() => onBusinessClick(business.businessId)}>
                        {business.name}
                      </div>
                      {business.businessIdentifier && (
                        <div className="text-sm text-gray-500">
                          ID: {business.businessIdentifier}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                      {business.email}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                      {business.phone || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        business.registrationType === 'telegram' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                        business.registrationType === 'google' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {business.registrationType === 'telegram' ? 'Telegram' :
                         business.registrationType === 'google' ? 'Google' :
                         'Стандартна'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {business.isActive ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Активний
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          Неактивний
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(business.lastLoginAt)}
                    </td>
                    <td className="py-3 px-4">
                      <button 
                        onClick={() => onBusinessClick(business.businessId)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Деталі →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Сторінка {page} з {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
              >
                Назад
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50"
              >
                Вперед
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Phones Tab Component
function PhonesTab() {
  const [phones, setPhones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<'all' | 'BUSINESS' | 'CLIENT'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadPhones()
  }, [category, search])

  const loadPhones = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        ...(category !== 'all' && { category }),
        ...(search && { search }),
      })
      const response = await fetch(`/api/admin/phone-directory?${params}`, {
        headers: getAuthHeaders(),
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
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Телефонний довідник
      </h2>
      
      <div className="mb-6 flex gap-4">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
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
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
        />
      </div>

      {loading ? (
        <div className="text-center py-12">Завантаження...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4">Номер</th>
                <th className="text-left py-3 px-4">Категорія</th>
                <th className="text-left py-3 px-4">Назва</th>
                <th className="text-left py-3 px-4">Статус</th>
                <th className="text-left py-3 px-4">Останнє використання</th>
              </tr>
            </thead>
            <tbody>
              {phones.map((phone: any) => (
                <tr key={phone.id} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-3 px-4 font-medium">{phone.phone}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      phone.category === 'BUSINESS' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {phone.category === 'BUSINESS' ? 'Бізнес' : 'Клієнт'}
                    </span>
                  </td>
                  <td className="py-3 px-4">{phone.businessName || phone.clientName || '-'}</td>
                  <td className="py-3 px-4">
                    {phone.isActive ? (
                      <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">Активний</span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">Неактивний</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {phone.lastUsedAt ? format(new Date(phone.lastUsedAt), 'dd.MM.yyyy', { locale: uk }) : 'Ніколи'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Activity Tab Component
function ActivityTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionType, setActionType] = useState<string>('all')

  useEffect(() => {
    loadLogs()
  }, [actionType])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        ...(actionType !== 'all' && { actionType }),
      })
      const response = await fetch(`/api/admin/activity-log?${params}`, {
        headers: getAuthHeaders(),
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
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Архів дій
      </h2>
      
      <div className="mb-6">
        <select
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
        >
          <option value="all">Всі дії</option>
          <option value="business_created">Створення бізнесу</option>
          <option value="client_created">Створення клієнта</option>
          <option value="appointment_created">Створення запису</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">Завантаження...</div>
      ) : (
        <div className="space-y-4">
          {logs.map((log: any, index: number) => (
            <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{log.action_type}</div>
                  <div className="text-sm text-gray-600">
                    Бізнес: {log.business_name || log.business_id}
                  </div>
                  {log.client_name && (
                    <div className="text-sm text-gray-600">
                      Клієнт: {log.client_name} ({log.client_phone})
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-500">
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
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Граф зв'язків
      </h2>
      <p className="text-gray-600 dark:text-gray-400">
        Візуалізація зв'язків між бізнесами, клієнтами та майстрами (в розробці)
      </p>
    </div>
  )
}

// Analytics Tab Component
function AnalyticsTab({ stats }: { stats: any }) {
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month')

  useEffect(() => {
    loadAnalytics()
  }, [period])

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
    return <div className="text-center py-12">Завантаження...</div>
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Аналітика
        </h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
        >
          <option value="day">День</option>
          <option value="week">Тиждень</option>
          <option value="month">Місяць</option>
          <option value="year">Рік</option>
        </select>
      </div>

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Всього бізнесів</div>
            <div className="text-3xl font-bold">{analytics.overview?.totalBusinesses || 0}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Активні</div>
            <div className="text-3xl font-bold">{analytics.overview?.activeBusinesses || 0}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Реєстрацій за період</div>
            <div className="text-3xl font-bold">{analytics.registrations?.total || 0}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// Integrations Tab Component
function IntegrationsTab() {
  const [integrations, setIntegrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadIntegrations()
  }, [])

  const loadIntegrations = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/integrations', {
        headers: getAuthHeaders(),
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
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Інтеграції
      </h2>
      {loading ? (
        <div className="text-center py-12">Завантаження...</div>
      ) : (
        <div className="space-y-4">
          {integrations.map((integration: any) => (
            <div key={integration.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{integration.platform}</div>
                  <div className="text-sm text-gray-600">
                    {integration.business?.name || 'Невідомий бізнес'}
                  </div>
                </div>
                <div>
                  {integration.isConnected ? (
                    <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">Підключено</span>
                  ) : (
                    <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">Відключено</span>
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
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Безпека
      </h2>
      <p className="text-gray-600 dark:text-gray-400">
        Управління безпекою та доступом (в розробці)
      </p>
    </div>
  )
}

// Finances Tab Component
function FinancesTab() {
  const [finances, setFinances] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month')

  useEffect(() => {
    loadFinances()
  }, [period])

  const loadFinances = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/finances?period=${period}`, {
        headers: getAuthHeaders(),
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
    }).format(amount)
  }

  if (loading) {
    return <div className="text-center py-12">Завантаження...</div>
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Фінанси
        </h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
        >
          <option value="day">День</option>
          <option value="week">Тиждень</option>
          <option value="month">Місяць</option>
          <option value="year">Рік</option>
        </select>
      </div>

      {finances && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Загальний дохід</div>
              <div className="text-3xl font-bold">{formatCurrency(finances.totalRevenue || 0)}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Всього платежів</div>
              <div className="text-3xl font-bold">{finances.totalPayments || 0}</div>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-4">Топ бізнеси за доходами</h3>
            <div className="space-y-2">
              {finances.topBusinesses?.map((business: any, index: number) => (
                <div key={index} className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 py-2">
                  <div>{business.businessName}</div>
                  <div className="font-bold">{formatCurrency(business.revenue)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Clients Tab Component
function ClientsTab() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadClients()
  }, [search])

  const loadClients = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        ...(search && { search }),
      })
      const response = await fetch(`/api/admin/clients?${params}`, {
        headers: getAuthHeaders(),
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
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Клієнти
      </h2>
      
      <div className="mb-6">
        <input
          type="text"
          placeholder="Пошук клієнтів..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
        />
      </div>

      {loading ? (
        <div className="text-center py-12">Завантаження...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4">Ім'я</th>
                <th className="text-left py-3 px-4">Телефон</th>
                <th className="text-left py-3 px-4">Бізнес</th>
                <th className="text-left py-3 px-4">Візитів</th>
                <th className="text-left py-3 px-4">Витрачено</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client: any) => (
                <tr key={client.id} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-3 px-4 font-medium">{client.name}</td>
                  <td className="py-3 px-4">{client.phone}</td>
                  <td className="py-3 px-4">{client.business?.name || '-'}</td>
                  <td className="py-3 px-4">{client.appointments?.length || 0}</td>
                  <td className="py-3 px-4">
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
      )}
    </div>
  )
}

// Settings Tab Component
function SettingsTab() {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Налаштування Центру управління
      </h2>
      <p className="text-gray-600 dark:text-gray-400">
        Системні налаштування (в розробці)
      </p>
    </div>
  )
}

// Export Tab Component
function ExportTab() {
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'json'>('csv')
  const [exportType, setExportType] = useState<'businesses' | 'clients' | 'phones' | 'all'>('businesses')

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/admin/export?format=${exportFormat}&type=${exportType}`, {
        headers: getAuthHeaders(),
      })
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export.${exportFormat}`
      a.click()
    } catch (error) {
      console.error('Error exporting:', error)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Експорт/Імпорт даних
      </h2>
      
      <div className="space-y-4">
        <div>
          <label className="block mb-2">Формат експорту</label>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as any)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            <option value="csv">CSV</option>
            <option value="excel">Excel</option>
            <option value="json">JSON</option>
          </select>
        </div>

        <div>
          <label className="block mb-2">Тип даних</label>
          <select
            value={exportType}
            onChange={(e) => setExportType(e.target.value as any)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            <option value="businesses">Бізнеси</option>
            <option value="clients">Клієнти</option>
            <option value="phones">Телефонний довідник</option>
            <option value="all">Всі дані</option>
          </select>
        </div>

        <button
          onClick={handleExport}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Експортувати
        </button>
      </div>
    </div>
  )
}


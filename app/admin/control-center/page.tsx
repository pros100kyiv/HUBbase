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

type Tab = 'overview' | 'businesses' | 'phones' | 'activity' | 'graph' | 'analytics' | 'integrations' | 'security' | 'finances' | 'clients' | 'admins' | 'settings' | 'export'

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
    { id: 'admins', label: 'Адміністратори', icon: ShieldIcon },
    { id: 'settings', label: 'Налаштування', icon: SettingsIcon },
    { id: 'export', label: 'Експорт/Імпорт', icon: DownloadIcon },
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
    <div className="min-h-screen p-4 md:p-6" style={{ backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black text-white mb-2" style={{ letterSpacing: '-0.02em' }}>
          🎯 Центр управління
        </h1>
        <p className="text-gray-300">
          Управління всіма бізнесами та процесами системи
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-white/10 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`px-4 py-2 flex items-center gap-2 font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-white text-white'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
              style={{ letterSpacing: '-0.01em' }}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="card-floating rounded-xl p-6">
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

        {activeTab === 'admins' && (
          <AdminsTab />
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
      <h2 className="text-2xl font-bold mb-6 text-white">
        Статистика системи
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, index) => {
          const Icon = card.icon
          return (
            <div
              key={index}
              className="card-floating rounded-xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <Icon className={`w-8 h-8 text-${card.color}-500`} />
                <span className="text-3xl font-black text-white">
                  {card.value}
                </span>
              </div>
              <p className="text-gray-300 font-medium">
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
      window.location.reload()
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
        window.location.reload()
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
        window.location.reload()
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
        window.location.reload()
      } else {
        const data = await response.json()
        alert(data.error || 'Помилка при видаленні')
      }
    } catch (error) {
      console.error('Error deleting business:', error)
      alert('Помилка при видаленні акаунту')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCopyId = (businessIdentifier: string) => {
    navigator.clipboard.writeText(businessIdentifier)
    alert(`ID ${businessIdentifier} скопійовано!`)
  }

  const filteredBusinesses = businesses.filter((business: Business) => {
    if (!search) return true
    
    const searchLower = search.toLowerCase()
    
    switch (searchBy) {
      case 'id':
        return business.businessIdentifier?.toLowerCase().includes(searchLower)
      case 'name':
        return business.name.toLowerCase().includes(searchLower)
      case 'email':
        return business.email.toLowerCase().includes(searchLower)
      default:
        return (
          business.name.toLowerCase().includes(searchLower) ||
          business.email.toLowerCase().includes(searchLower) ||
          business.phone?.toLowerCase().includes(searchLower) ||
          business.businessIdentifier?.toLowerCase().includes(searchLower)
        )
    }
  })

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={
              searchBy === 'id' ? 'Пошук за ID (наприклад: 56836)...' :
              searchBy === 'name' ? 'Пошук за назвою...' :
              searchBy === 'email' ? 'Пошук за email...' :
              'Пошук по назві, email, телефону, ID...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm text-white"
          />
        </div>
        
        <select
          value={searchBy}
          onChange={(e) => setSearchBy(e.target.value as any)}
          className="px-4 py-2 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm text-white"
          title="Тип пошуку"
        >
          <option value="all">Всюди</option>
          <option value="id">За ID</option>
          <option value="name">За назвою</option>
          <option value="email">За email</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm text-white"
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
              className="px-4 py-2 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm text-white focus:outline-none focus:border-white/20"
            >
              <option value="" className="bg-[#2A2A2A]">Оберіть дію</option>
              <option value="activate" className="bg-[#2A2A2A]">Активувати</option>
              <option value="deactivate" className="bg-[#2A2A2A]">Деактивувати</option>
              <option value="delete" className="bg-[#2A2A2A]">Видалити</option>
            </select>
            <button
              onClick={handleBulkAction}
              className="px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-colors font-semibold"
              style={{ letterSpacing: '-0.01em', boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
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
            const data = dataToExport.map((b: Business) => ({
              ID: b.businessIdentifier || '-',
              Назва: b.name,
              Email: b.email,
              Телефон: b.phone || '-',
              Статус: b.isActive ? 'Активний' : 'Неактивний',
              'Тип реєстрації': b.registrationType === 'telegram' ? 'Telegram' : b.registrationType === 'google' ? 'Google' : 'Стандартна',
              'Дата реєстрації': formatDate(b.registeredAt),
              'Останній вхід': formatDate(b.lastLoginAt),
            }))
            const csv = [
              Object.keys(data[0] || {}).join(','),
              ...data.map((row: Record<string, any>) => Object.values(row).map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(','))
            ].join('\n')
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = `businesses-${new Date().toISOString().split('T')[0]}.csv`
            link.click()
          }}
          className="px-4 py-2 bg-white text-black rounded-lg hover:bg-gray-100 flex items-center gap-2 font-semibold transition-colors"
          style={{ letterSpacing: '-0.01em', boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
        >
          <DownloadIcon className="w-5 h-5" />
          Експорт CSV
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Завантаження...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4">
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
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">Назва</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">Email</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">Телефон</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">Тип реєстрації</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">Статус</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">Дії</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">Останній вхід</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-300">Дії</th>
                </tr>
              </thead>
              <tbody>
                {(search ? filteredBusinesses : businesses).map((business: Business) => (
                  <tr
                    key={business.id}
                    className="border-b border-white/10 hover:bg-white/5"
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
                      {business.businessIdentifier ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-blue-400">
                            {business.businessIdentifier}
                          </span>
                          <button
                            onClick={() => handleCopyId(business.businessIdentifier!)}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Копіювати ID"
                          >
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-white cursor-pointer" onClick={() => onBusinessClick(business.businessId)}>
                        {business.name}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {business.email}
                    </td>
                    <td className="py-3 px-4 text-gray-300">
                      {business.phone || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        business.registrationType === 'telegram' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                        business.registrationType === 'google' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        'bg-gray-500/20 text-gray-300 border border-gray-500/50'
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
                        <button
                          onClick={() => handleViewBlockInfo(business)}
                          className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800 transition-colors cursor-pointer"
                          title="Натисніть для перегляду причини блокування"
                        >
                          Неактивний
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-300">
                      {formatDate(business.lastLoginAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button 
                          onClick={() => onBusinessClick(business.businessId)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                        >
                          Деталі
                        </button>
                        {business.isActive ? (
                          <>
                            <button
                              onClick={() => handleBlockClick(business)}
                              className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                            >
                              Заблокувати
                            </button>
                            <button
                              onClick={() => handleDeleteClick(business)}
                              className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
                            >
                              Видалити
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleUnblock(business)}
                              className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 transition-colors"
                            >
                              Розблокувати
                            </button>
                            <button
                              onClick={() => handleDeleteClick(business)}
                              className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
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
          
          {/* Статистика */}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card-floating rounded-lg shadow-xl p-6 w-full max-w-md">
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
      <h2 className="text-2xl font-bold mb-6 text-white">
        Телефонний довідник
      </h2>
      
      <div className="mb-6 flex gap-4">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as any)}
          className="px-4 py-2 border border-white/10 rounded-lg"
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
          className="flex-1 px-4 py-2 border border-white/10 rounded-lg"
        />
      </div>

      {loading ? (
        <div className="text-center py-12">Завантаження...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4">Номер</th>
                <th className="text-left py-3 px-4">Категорія</th>
                <th className="text-left py-3 px-4">Назва</th>
                <th className="text-left py-3 px-4">Статус</th>
                <th className="text-left py-3 px-4">Останнє використання</th>
              </tr>
            </thead>
            <tbody>
              {phones.map((phone: any) => (
                <tr key={phone.id} className="border-b border-white/10 hover:bg-white/5">
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
      <h2 className="text-2xl font-bold mb-6 text-white">
        Архів дій
      </h2>
      
      <div className="mb-6">
        <select
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          className="px-4 py-2 border border-white/10 rounded-lg"
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
            <div key={index} className="border border-white/10 rounded-lg p-4">
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
      <h2 className="text-2xl font-bold mb-6 text-white">
        Граф зв'язків
      </h2>
      <p className="text-gray-300">
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
        <h2 className="text-2xl font-bold text-white">
          Аналітика
        </h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as any)}
          className="px-4 py-2 border border-white/10 rounded-lg"
        >
          <option value="day">День</option>
          <option value="week">Тиждень</option>
          <option value="month">Місяць</option>
          <option value="year">Рік</option>
        </select>
      </div>

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-lg p-6">
            <div className="text-sm text-gray-300 mb-2">Всього бізнесів</div>
            <div className="text-3xl font-bold">{analytics.overview?.totalBusinesses || 0}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-6">
            <div className="text-sm text-gray-300 mb-2">Активні</div>
            <div className="text-3xl font-bold">{analytics.overview?.activeBusinesses || 0}</div>
          </div>
          <div className="bg-white/5 rounded-lg p-6">
            <div className="text-sm text-gray-300 mb-2">Реєстрацій за період</div>
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
      <h2 className="text-2xl font-bold mb-6 text-white">
        Інтеграції
      </h2>
      {loading ? (
        <div className="text-center py-12">Завантаження...</div>
      ) : (
        <div className="space-y-4">
          {integrations.map((integration: any) => (
            <div key={integration.id} className="border border-white/10 rounded-lg p-4">
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
      <h2 className="text-2xl font-bold mb-6 text-white">
        Безпека
      </h2>
      <p className="text-gray-300">
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
        <h2 className="text-2xl font-bold text-white">
          Фінанси
        </h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as any)}
          className="px-4 py-2 border border-white/10 rounded-lg"
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
            <div className="bg-white/5 rounded-lg p-6">
              <div className="text-sm text-gray-300 mb-2">Загальний дохід</div>
              <div className="text-3xl font-bold">{formatCurrency(finances.totalRevenue || 0)}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-6">
              <div className="text-sm text-gray-300 mb-2">Всього платежів</div>
              <div className="text-3xl font-bold">{finances.totalPayments || 0}</div>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold mb-4">Топ бізнеси за доходами</h3>
            <div className="space-y-2">
              {finances.topBusinesses?.map((business: any, index: number) => (
                <div key={index} className="flex justify-between items-center border-b border-white/10 py-2">
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
      <h2 className="text-2xl font-bold mb-6 text-white">
        Клієнти
      </h2>
      
      <div className="mb-6">
        <input
          type="text"
          placeholder="Пошук клієнтів..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border border-white/10 rounded-lg"
        />
      </div>

      {loading ? (
        <div className="text-center py-12">Завантаження...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4">Ім'я</th>
                <th className="text-left py-3 px-4">Телефон</th>
                <th className="text-left py-3 px-4">Бізнес</th>
                <th className="text-left py-3 px-4">Візитів</th>
                <th className="text-left py-3 px-4">Витрачено</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client: any) => (
                <tr key={client.id} className="border-b border-white/10 hover:bg-white/5">
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
      <h2 className="text-2xl font-bold mb-6 text-white">
        Налаштування Центру управління
      </h2>
      <p className="text-gray-300">
        Системні налаштування (в розробці)
      </p>
    </div>
  )
}

// Admins Tab Component
function AdminsTab() {
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
  }, [search, roleFilter])

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
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">
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
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Додати адміна
        </button>
      </div>

      <div className="mb-6 flex gap-4">
        <div className="flex-1 relative">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Пошук по email або імені..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm text-white"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
          className="px-4 py-2 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm text-white"
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
        <div className="overflow-x-auto">
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
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card-floating rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
      <h2 className="text-2xl font-bold mb-6 text-white">
        Експорт/Імпорт даних
      </h2>
      
      <div className="space-y-4">
        <div>
          <label className="block mb-2">Формат експорту</label>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as any)}
            className="w-full px-4 py-2 border border-white/10 rounded-lg"
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
            className="w-full px-4 py-2 border border-white/10 rounded-lg"
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


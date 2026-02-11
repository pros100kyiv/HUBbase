'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BusinessCardEditor } from '@/components/admin/BusinessCardEditor'
import { TelegramSettings } from '@/components/admin/TelegramSettings'
import { IntegrationsSettings } from '@/components/admin/IntegrationsSettings'
import {
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UserIcon,
  UsersIcon,
  ChartIcon,
  TrashIcon,
  MoneyIcon,
  ImageIcon,
} from '@/components/icons'
import { toast } from '@/components/ui/toast'
import { Confetti, triggerConfetti } from '@/components/ui/confetti'
import { cn } from '@/lib/utils'

interface Business {
  id: string
  name: string
  slug?: string
  email: string
  phone?: string
  address?: string
  description?: string
  primaryColor?: string
  secondaryColor?: string
  backgroundColor?: string
  surfaceColor?: string
  businessCardBackgroundImage?: string
  slogan?: string
  additionalInfo?: string
  socialMedia?: string
  workingHours?: string
  location?: string
  niche?: string
  customNiche?: string
  businessIdentifier?: string
  profileCompleted?: boolean
  telegramBotToken?: string | null
  settings?: string | null
}

interface Master {
  id: string
  name: string
  photo?: string
  bio?: string
  rating: number
  workingHours?: any
}

interface Service {
  id: string
  name: string
  price: number
  duration: number
  category?: string
  subcategory?: string
  description?: string
}

const getCategoryColor = (index: number) => {
  const colors = [
    { bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500' },
    { bg: 'bg-green-500', text: 'text-green-500', border: 'border-green-500' },
    { bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500' },
    { bg: 'bg-pink-500', text: 'text-pink-500', border: 'border-pink-500' },
    { bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500' },
    { bg: 'bg-indigo-500', text: 'text-indigo-500', border: 'border-indigo-500' },
  ]
  return colors[index % colors.length]
}

type Tab = 'info' | 'schedule' | 'masters' | 'services' | 'businessCard' | 'telegram' | 'integrations'

const TAB_LABELS: Record<Tab, string> = {
  info: 'Інформація',
  schedule: 'Робочі години',
  masters: 'Спеціалісти',
  services: 'Послуги',
  businessCard: 'Візитівка',
  telegram: 'Telegram',
  integrations: 'Інтеграції',
}

const DAY_NAMES: Record<string, string> = {
  monday: 'Понеділок',
  tuesday: 'Вівторок',
  wednesday: 'Середа',
  thursday: 'Четвер',
  friday: 'П\'ятниця',
  saturday: 'Субота',
  sunday: 'Неділя',
}

const DEFAULT_HOURS = {
  monday: { enabled: true, start: '09:00', end: '18:00' },
  tuesday: { enabled: true, start: '09:00', end: '18:00' },
  wednesday: { enabled: true, start: '09:00', end: '18:00' },
  thursday: { enabled: true, start: '09:00', end: '18:00' },
  friday: { enabled: true, start: '09:00', end: '18:00' },
  saturday: { enabled: false, start: '09:00', end: '18:00' },
  sunday: { enabled: false, start: '09:00', end: '18:00' },
}

function BusinessWorkingHoursEditor({
  businessId,
  currentHours,
  onSave,
}: {
  businessId: string
  currentHours?: string
  onSave: (hours: string) => void
}) {
  const [hours, setHours] = useState<Record<string, { enabled: boolean; start: string; end: string }>>(DEFAULT_HOURS)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentHours) {
      try {
        const parsed = JSON.parse(currentHours)
        setHours({ ...DEFAULT_HOURS, ...parsed })
      } catch {}
    }
  }, [currentHours])

  const updateDay = (day: string, field: string, value: boolean | string) => {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/business/${businessId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workingHours: JSON.stringify(hours) }),
      })
      if (res.ok) {
        onSave(JSON.stringify(hours))
      } else {
        const err = await res.json().catch(() => ({}))
        toast({ title: 'Помилка', description: err.error || 'Не вдалося зберегти', type: 'error' })
      }
    } catch {
      toast({ title: 'Помилка', description: 'Не вдалося зберегти графік', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl p-4 md:p-6 card-glass">
      <h2 className="text-lg font-bold text-white mb-4" style={{ letterSpacing: '-0.02em' }}>
        Робочі години бізнесу
      </h2>
      <p className="text-sm text-gray-400 mb-6">
        Загальний графік роботи вашого бізнесу. Клієнти бачитимуть цей графік при бронюванні.
      </p>
      <div className="space-y-3">
        {Object.entries(DAY_NAMES).map(([key, name]) => (
          <div
            key={key}
            className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
          >
            <div className="flex items-center gap-2 min-w-[120px]">
              <input
                type="checkbox"
                checked={hours[key]?.enabled ?? true}
                onChange={(e) => updateDay(key, 'enabled', e.target.checked)}
                className="w-4 h-4 rounded border-white/30 bg-white/10 text-white focus:ring-white/30"
              />
              <label className="text-sm font-medium text-white">{name}</label>
            </div>
            {hours[key]?.enabled && (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={hours[key].start}
                  onChange={(e) => updateDay(key, 'start', e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:ring-2 focus:ring-white/30"
                />
                <span className="text-gray-400">—</span>
                <input
                  type="time"
                  value={hours[key].end}
                  onChange={(e) => updateDay(key, 'end', e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:ring-2 focus:ring-white/30"
                />
              </div>
            )}
            {!hours[key]?.enabled && <span className="text-xs text-gray-500">Вихідний</span>}
          </div>
        ))}
      </div>
      <Button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100"
        style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
      >
        {saving ? 'Збереження...' : 'Зберегти графік'}
      </Button>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('info')
  const [business, setBusiness] = useState<Business | null>(null)
  const [masters, setMasters] = useState<Master[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [formData, setFormData] = useState<Partial<Business>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const serviceFormRef = useRef<HTMLDivElement>(null)
  const businessCardRef = useRef<HTMLDivElement>(null)

  const CONFIRM_DELETE_PHRASE = 'ВИДАЛИТИ'

  // Service form
  const [serviceForm, setServiceForm] = useState({
    name: '',
    price: '',
    duration: '',
    category: '',
    subcategory: '',
  })

  // Автоматична прокрутка до форми послуги
  useEffect(() => {
    if (showServiceForm && serviceFormRef.current) {
      setTimeout(() => {
        serviceFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [showServiceForm])

  // Автоматична прокрутка до візитівки
  useEffect(() => {
    if (activeTab === 'businessCard' && businessCardRef.current) {
      setTimeout(() => {
        businessCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [activeTab])

  const loadData = useCallback(async () => {
    // Перевіряємо чи є дані в localStorage
    if (typeof window === 'undefined') return
    
    const businessData = localStorage.getItem('business')
    if (!businessData) {
      router.push('/login')
      return
    }

    try {
      const parsed = JSON.parse(businessData)
      
      // Перевіряємо чи є обов'язкові поля
      if (!parsed || !parsed.id || !parsed.name) {
        console.error('Invalid business data:', parsed)
        localStorage.removeItem('business')
        router.push('/login')
        return
      }
      
      // Спочатку встановлюємо дані з localStorage
      setBusiness(parsed)
      setFormData(parsed)
      setIsLoading(false) // Показуємо інтерфейс одразу

      // Потім завантажуємо актуальні дані з сервера (неблокуюче)
      Promise.all([
        fetch(`/api/business/${parsed.id}`).then(res => res.ok ? res.json() : null).catch(() => null),
        fetch(`/api/masters?businessId=${parsed.id}`).then(res => res.ok ? res.json() : null).catch(() => null),
        fetch(`/api/services?businessId=${parsed.id}`).then(res => res.ok ? res.json() : null).catch(() => null),
      ]).then(([businessData, mastersData, servicesData]) => {
        if (businessData?.business) {
          // Перевіряємо чи є ID в даних з сервера, якщо ні - використовуємо з localStorage
          const updatedBusiness = {
            ...businessData.business,
            id: businessData.business.id || parsed.id,
          }
          setBusiness(updatedBusiness)
          setFormData(updatedBusiness)
          localStorage.setItem('business', JSON.stringify(updatedBusiness))
        }
        if (mastersData) {
          setMasters(mastersData)
        }
        if (servicesData) {
          setServices(servicesData)
        }
      }).catch(err => {
        console.error('Error loading data from server:', err)
        // Не показуємо помилку користувачу, дані з localStorage вже є
      })
    } catch (error) {
      console.error('Error parsing business data:', error)
      localStorage.removeItem('business')
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    // Додаємо перевірку на клієнтській стороні
    if (typeof window !== 'undefined') {
      loadData()
    }
  }, [loadData])

  // Синхронізація вкладки з URL (?tab=...)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    const allowedTabs: Tab[] = ['info', 'schedule', 'masters', 'services', 'businessCard', 'telegram', 'integrations']
    if (tabParam && allowedTabs.includes(tabParam as Tab)) {
      setActiveTab(tabParam as Tab)
    }
  }, [])

  const setTab = (tab: Tab) => {
    setActiveTab(tab)
    const path = '/dashboard/settings'
    const search = `?tab=${tab}`
    router.replace(path + search, { scroll: false })
  }

  const handleSaveBusiness = async () => {
    if (!business) {
      toast({ title: 'Помилка', description: 'Бізнес не знайдено', type: 'error' })
      return
    }

    if (!business.id) {
      toast({ title: 'Помилка', description: 'ID бізнесу відсутній', type: 'error' })
      return
    }

    // Перевіряємо чи ID є валідним UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(business.id)) {
      console.error('Invalid business ID format:', business.id)
      toast({ 
        title: 'Помилка', 
        description: 'Невірний формат ID бізнесу. Будь ласка, увійдіть знову.', 
        type: 'error' 
      })
      localStorage.removeItem('business')
      setTimeout(() => router.push('/login'), 2000)
      return
    }

    setIsSaving(true)
    try {
      console.log('Saving business with ID:', business.id)
      console.log('Form data:', formData)
      
      const response = await fetch(`/api/business/${business.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const updated = await response.json()
        setBusiness(updated.business)
        // Оновлюємо formData з новими даними
        setFormData({
          name: updated.business.name,
          email: updated.business.email,
          phone: updated.business.phone || '',
          address: updated.business.address || '',
          description: updated.business.description || '',
          niche: updated.business.niche || 'OTHER',
          customNiche: updated.business.customNiche || '',
          businessIdentifier: updated.business.businessIdentifier || '',
        })
        localStorage.setItem('business', JSON.stringify(updated.business))
        toast({ title: 'Збережено', type: 'success', duration: 1500 })
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 2000)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Помилка при збереженні' }))
        console.error('Error response:', errorData)
        const errorMessage = errorData.details || errorData.error || 'Помилка при збереженні'
        toast({ title: 'Помилка', description: errorMessage, type: 'error' })
      }
    } catch (error) {
      console.error('Error saving business:', error)
      toast({ title: 'Помилка', description: 'Помилка при збереженні', type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveService = async () => {
    if (!business) return
    const priceNum = parseInt(serviceForm.price, 10)
    const durationNum = parseInt(serviceForm.duration, 10)
    if (!serviceForm.name?.trim() || isNaN(priceNum) || priceNum < 0 || isNaN(durationNum) || durationNum < 1) {
      toast({ title: 'Помилка', description: 'Заповніть назву, ціну (≥ 0) та тривалість (≥ 1 хв)', type: 'error' })
      return
    }

    try {
      const url = editingService
        ? `/api/services/${editingService.id}`
        : '/api/services'
      const method = editingService ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingService ? { businessId: business.id } : { businessId: business.id }),
          name: serviceForm.name.trim(),
          price: priceNum,
          duration: durationNum,
          category: serviceForm.category?.trim() || null,
          subcategory: serviceForm.subcategory?.trim() || null,
        }),
      })

      if (response.ok) {
        await loadData()
        setShowServiceForm(false)
        setEditingService(null)
        setServiceForm({ name: '', price: '', duration: '', category: '', subcategory: '' })
        toast({ 
          title: 'Успішно!', 
          description: editingService ? 'Послугу оновлено' : 'Послугу додано', 
          type: 'success' 
        })
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 2000)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Помилка при збереженні' }))
        toast({ 
          title: 'Помилка', 
          description: errorData.error || 'Помилка при збереженні послуги', 
          type: 'error' 
        })
      }
    } catch (error) {
      toast({ title: 'Помилка', description: 'Помилка при збереженні послуги', type: 'error' })
    }
  }

  const handleDeleteService = async (id: string) => {
    if (!window.confirm('Видалити цю послугу?')) return
    if (!business?.id) return

    try {
      const response = await fetch(`/api/services/${id}?businessId=${encodeURIComponent(business.id)}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadData()
        toast({ title: 'Успішно!', description: 'Послугу видалено', type: 'success' })
      } else {
        toast({ title: 'Помилка', description: 'Не вдалося видалити послугу', type: 'error' })
      }
    } catch (error) {
      toast({ title: 'Помилка', description: 'Помилка при видаленні', type: 'error' })
    }
  }

  const handleDeleteAccount = async () => {
    if (!business) return
    if (deleteConfirmText !== CONFIRM_DELETE_PHRASE) {
      toast({ title: 'Помилка', description: `Введіть "${CONFIRM_DELETE_PHRASE}" для підтвердження`, type: 'error' })
      return
    }

    setIsDeleting(true)
    try {
      const res = await fetch('/api/business/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: business.id }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.success) {
        localStorage.removeItem('business')
        toast({ title: 'Акаунт видалено', type: 'success' })
        router.push('/login')
      } else {
        toast({ title: 'Помилка', description: data.error || 'Не вдалося видалити акаунт', type: 'error' })
      }
    } catch (err) {
      console.error('Delete account error:', err)
      toast({ title: 'Помилка', description: 'Помилка при видаленні акаунту', type: 'error' })
    } finally {
      setIsDeleting(false)
    }
  }

  const startEditService = (service: Service) => {
    setEditingService(service)
    // Parse category if it contains subcategory format
    let category = service.category || ''
    let subcategory = service.subcategory || ''
    
    if (category.includes(' > ')) {
      const parts = category.split(' > ')
      category = parts[0]
      subcategory = parts[1] || ''
    }
    
    setServiceForm({
      name: service.name,
      price: service.price.toString(), // Вартість у гривнях (ціле число, без копійок)
      duration: service.duration.toString(),
      category: category,
      subcategory: subcategory,
    })
    setShowServiceForm(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-gray-400">Завантаження...</p>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center rounded-xl p-8 card-glass max-w-sm">
          <p className="text-gray-300 mb-4">Бізнес не знайдено</p>
          <Button
            onClick={() => router.push('/login')}
            className="px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors"
            style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
          >
            Увійти
          </Button>
        </div>
      </div>
    )
  }

  const bookingUrl = typeof window !== 'undefined' && business?.slug
    ? `${window.location.origin}/booking/${business.slug}`
    : ''

  const copyBookingLink = () => {
    if (bookingUrl) {
      navigator.clipboard.writeText(bookingUrl)
      toast({ title: 'Посилання скопійовано', type: 'success', duration: 2000 })
    }
  }

  return (
    <div className="min-h-screen">
      <Confetti trigger={showConfetti} />
      <div className="w-full max-w-7xl mx-auto min-w-0 overflow-hidden">
        {/* Header + Status cards + Tabs */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white mb-1" style={{ letterSpacing: '-0.02em' }}>
                Налаштування
              </h1>
              <p className="text-sm text-gray-400">
                Управління бізнесом та налаштування
              </p>
            </div>
            {bookingUrl && (
              <div className="flex items-center gap-2">
                <code className="px-3 py-2 rounded-lg bg-white/10 text-gray-300 text-xs truncate max-w-[200px] md:max-w-xs" title={bookingUrl}>
                  {bookingUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyBookingLink}
                  className="shrink-0 border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs"
                >
                  Копіювати посилання
                </Button>
              </div>
            )}
          </div>

          {/* Status cards - швидкий огляд */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-4">
            <button
              onClick={() => setTab('info')}
              className={cn(
                'rounded-xl p-3 text-left transition-all border',
                activeTab === 'info' ? 'card-glass border-white/30 bg-white/15' : 'card-glass-subtle border-white/10 hover:border-white/20'
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', business?.profileCompleted ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400')}>
                  <UserIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Профіль</p>
                  <p className="text-sm font-bold text-white">{business?.profileCompleted ? 'Заповнено' : 'Заповніть'}</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setTab('masters')}
              className={cn(
                'rounded-xl p-3 text-left transition-all border',
                activeTab === 'masters' ? 'card-glass border-white/30 bg-white/15' : 'card-glass-subtle border-white/10 hover:border-white/20'
              )}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <UsersIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Спеціалісти</p>
                  <p className="text-sm font-bold text-white">{masters.length}</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setTab('services')}
              className={cn(
                'rounded-xl p-3 text-left transition-all border',
                activeTab === 'services' ? 'card-glass border-white/30 bg-white/15' : 'card-glass-subtle border-white/10 hover:border-white/20'
              )}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <MoneyIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Послуги</p>
                  <p className="text-sm font-bold text-white">{services.length}</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setTab('telegram')}
              className={cn(
                'rounded-xl p-3 text-left transition-all border',
                activeTab === 'telegram' ? 'card-glass border-white/30 bg-white/15' : 'card-glass-subtle border-white/10 hover:border-white/20'
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', business?.telegramBotToken ? 'bg-sky-500/20 text-sky-400' : 'bg-gray-500/20 text-gray-400')}>
                  <span className="text-sm">TG</span>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Telegram</p>
                  <p className="text-sm font-bold text-white">{business?.telegramBotToken ? 'Підключено' : '—'}</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setTab('integrations')}
              className={cn(
                'rounded-xl p-3 text-left transition-all border',
                activeTab === 'integrations' ? 'card-glass border-white/30 bg-white/15' : 'card-glass-subtle border-white/10 hover:border-white/20'
              )}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <ChartIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Інтеграції</p>
                  <p className="text-sm font-bold text-white">AI · SMS · Email</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setTab('schedule')}
              className={cn(
                'rounded-xl p-3 text-left transition-all border',
                activeTab === 'schedule' ? 'card-glass border-white/30 bg-white/15' : 'card-glass-subtle border-white/10 hover:border-white/20'
              )}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ClockIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Графік</p>
                  <p className="text-sm font-bold text-white">Бізнес</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setTab('businessCard')}
              className={cn(
                'rounded-xl p-3 text-left transition-all border',
                activeTab === 'businessCard' ? 'card-glass border-white/30 bg-white/15' : 'card-glass-subtle border-white/10 hover:border-white/20'
              )}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Візитівка</p>
                  <p className="text-sm font-bold text-white">Картка</p>
                </div>
              </div>
            </button>
          </div>

          {/* Tabs - card-glass dark theme */}
          <div className="rounded-xl p-3 card-glass-subtle">
            <div className="flex gap-2 flex-wrap">
              {(['info', 'schedule', 'masters', 'services', 'businessCard', 'telegram', 'integrations'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTab(tab)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-[0.98] whitespace-nowrap',
                    activeTab === tab
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-white/10 text-gray-300 border border-white/20 hover:bg-white/15 hover:text-white'
                  )}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Інформація */}
          {activeTab === 'info' && (
            <div className="rounded-xl p-4 md:p-6 card-glass">
              <h2 className="text-lg font-bold text-white mb-6" style={{ letterSpacing: '-0.02em' }}>Основна інформація</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Назва бізнесу</label>
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Email</label>
                  <Input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Телефон</label>
                  <Input
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0XX XXX XX XX"
                    className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Адреса</label>
                  <Input
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Опис</label>
                  <Input
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Короткий опис вашого бізнесу"
                    className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Категорія бізнесу</label>
                  <select
                    value={formData.niche || 'OTHER'}
                    onChange={(e) => setFormData({ ...formData, niche: e.target.value, customNiche: e.target.value !== 'OTHER' ? '' : formData.customNiche })}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                  >
                    <option value="SALON">Салон краси</option>
                    <option value="BARBERSHOP">Барбершоп</option>
                    <option value="STO">СТО (Станція технічного обслуговування)</option>
                    <option value="CAR_WASH">Автомийка</option>
                    <option value="SPA">СПА</option>
                    <option value="FITNESS">Фітнес тренер</option>
                    <option value="BEAUTY">Бюті сфера</option>
                    <option value="TIRE_SERVICE">Шиномонтаж</option>
                    <option value="EDUCATION">Освіта</option>
                    <option value="MEDICINE">Медицина</option>
                    <option value="RESTAURANT">Ресторан</option>
                    <option value="OTHER">Інше</option>
                  </select>
                </div>

                {formData.niche === 'OTHER' && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Вкажіть вашу категорію</label>
                    <Input
                      value={formData.customNiche || ''}
                      onChange={(e) => setFormData({ ...formData, customNiche: e.target.value })}
                      placeholder="Наприклад: Автосервіс, Стоматологія..."
                      className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Ідентифікатор бізнесу</label>
                  <div className="px-4 py-2 rounded-lg bg-white/10 border border-white/20">
                    <p className="text-lg font-bold text-blue-400">
                      {formData.businessIdentifier || 'Не встановлено'}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Унікальний ідентифікатор вашого бізнесу (не можна змінити)
                  </p>
                </div>

                <Button
                  onClick={handleSaveBusiness}
                  disabled={isSaving}
                  className="w-full px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-all active:scale-[0.98]"
                  style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
                >
                  {isSaving ? 'Збереження...' : 'Зберегти'}
                </Button>
              </div>
            </div>
          )}

          {/* Робочі години бізнесу */}
          {activeTab === 'schedule' && business && (
            <BusinessWorkingHoursEditor
              businessId={business.id}
              currentHours={business.workingHours || undefined}
              onSave={(hours) => {
                setBusiness(prev => prev ? { ...prev, workingHours: hours } : null)
                setFormData(prev => ({ ...prev, workingHours: hours }))
                toast({ title: 'Графік збережено', type: 'success', duration: 1500 })
              }}
            />
          )}

          {/* Майстри — керуються в Графік роботи */}
          {activeTab === 'masters' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-white" style={{ letterSpacing: '-0.02em' }}>Спеціалісти</h2>
              <div className="rounded-xl p-6 md:p-8 card-glass border border-white/10 text-center">
                <UserIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-white font-medium mb-1">Спеціалісти та їх графіки об’єднані в одному місці.</p>
                <p className="text-sm text-gray-400 mb-4">Додавання, редагування профілю, графік роботи та видалення — у розділі «Графік роботи».</p>
                <Button
                  onClick={() => router.push('/dashboard/schedule')}
                  className="px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98] inline-flex items-center gap-2"
                  style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
                >
                  <ClockIcon className="w-5 h-5" />
                  Перейти до графіка та спеціалістів
                </Button>
              </div>
            </div>
          )}

          {/* Послуги */}
          {activeTab === 'services' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-lg font-bold text-white" style={{ letterSpacing: '-0.02em' }}>Послуги</h2>
                <Button
                  onClick={() => {
                    setShowServiceForm(true)
                    setEditingService(null)
                    setServiceForm({ name: '', price: '', duration: '', category: '', subcategory: '' })
                  }}
                  className="px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98]"
                  style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
                >
                  + Додати послугу
                </Button>
              </div>

              {showServiceForm && (
                <div ref={serviceFormRef}>
                <div className="rounded-xl p-4 md:p-6 card-glass">
                  <h3 className="text-lg font-bold text-white mb-4" style={{ letterSpacing: '-0.02em' }}>
                    {editingService ? 'Редагувати послугу' : 'Нова послуга'}
                  </h3>
                  <div className="space-y-4">
                    <Input
                      placeholder="Назва послуги"
                      value={serviceForm.name}
                      onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                      className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        type="number"
                        placeholder="Ціна (₴)"
                        value={serviceForm.price}
                        onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                        className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                      />
                      <Input
                        type="number"
                        placeholder="Тривалість (хв)"
                        value={serviceForm.duration}
                        onChange={(e) => setServiceForm({ ...serviceForm, duration: e.target.value })}
                        className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                      />
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-sm font-medium mb-1.5 text-gray-300">
                          Категорія (папка)
                        </label>
                        <Input
                          placeholder="Наприклад: Стрижка, Манікюр"
                          value={serviceForm.category}
                          onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                          className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                        />
                        {services.length > 0 && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                setServiceForm({ ...serviceForm, category: e.target.value })
                              }
                            }}
                            className="mt-1.5 w-full px-3 py-2 rounded-lg border border-white/20 bg-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                          >
                            <option value="">Або виберіть існуючу категорію</option>
                            {Array.from(new Set(services.map(s => {
                              const cat = s.category || ''
                              return cat.includes(' > ') ? cat.split(' > ')[0] : cat
                            }).filter(Boolean))).map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      {serviceForm.category && (
                        <div>
                          <label className="block text-sm font-medium mb-1.5 text-gray-300">
                            Підкатегорія (підпапка) - опціонально
                          </label>
                          <Input
                            placeholder="Наприклад: Чоловіча, Жіноча, Дитяча"
                            value={serviceForm.subcategory}
                            onChange={(e) => setServiceForm({ ...serviceForm, subcategory: e.target.value })}
                            className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                          />
                          {services.length > 0 && serviceForm.category && (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  setServiceForm({ ...serviceForm, subcategory: e.target.value })
                                }
                              }}
                              className="mt-1.5 w-full px-3 py-2 rounded-lg border border-white/20 bg-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                            >
                              <option value="">Або виберіть існуючу підкатегорію</option>
                              {Array.from(new Set(services
                                .filter(s => {
                                  const cat = s.category || ''
                                  const mainCat = cat.includes(' > ') ? cat.split(' > ')[0] : cat
                                  return mainCat === serviceForm.category
                                })
                                .map(s => {
                                  const cat = s.category || ''
                                  if (cat.includes(' > ')) {
                                    return cat.split(' > ')[1]
                                  }
                                  return s.subcategory || ''
                                })
                                .filter(Boolean))).map(sub => (
                                <option key={sub} value={sub}>{sub}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button
                        onClick={handleSaveService}
                        className="flex-1 px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-all active:scale-[0.98]"
                        style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
                      >
                        Зберегти
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowServiceForm(false)
                          setEditingService(null)
                        }}
                        className="px-6 py-3 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg font-medium transition-all active:scale-[0.98]"
                      >
                        Скасувати
                      </Button>
                    </div>
                  </div>
                </div>
                </div>
              )}

              {/* Empty state */}
              {services.length === 0 && !showServiceForm && (
                <div className="rounded-xl p-8 card-glass border border-white/10 text-center">
                  <MoneyIcon className="w-12 h-12 text-gray-500/60 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-white mb-1">Ще немає послуг</h3>
                  <p className="text-sm text-gray-400 mb-4 max-w-sm mx-auto">
                    Додайте першу послугу — вона зʼявиться у прайсі та при бронюванні.
                  </p>
                  <Button
                    onClick={() => {
                      setShowServiceForm(true)
                      setEditingService(null)
                      setServiceForm({ name: '', price: '', duration: '', category: '', subcategory: '' })
                    }}
                    className="px-5 py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors active:scale-[0.98]"
                    style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
                  >
                    Додати послугу
                  </Button>
                </div>
              )}

              {/* Group services by category */}
              {services.length > 0 && (() => {
                const categoryGroups = services.reduce((acc, service) => {
                  let category = service.category || 'Інші'
                  let subcategory = service.subcategory || null
                  
                  if (category.includes(' > ')) {
                    const parts = category.split(' > ')
                    category = parts[0]
                    subcategory = parts[1] || null
                  }
                  
                  if (!acc[category]) {
                    acc[category] = {}
                  }
                  
                  const subKey = subcategory || '_main'
                  if (!acc[category][subKey]) {
                    acc[category][subKey] = {
                      subcategory,
                      services: []
                    }
                  }
                  acc[category][subKey].services.push(service)
                  return acc
                }, {} as Record<string, Record<string, { subcategory: string | null; services: Service[] }>>)

                const formatCurrency = (amount: number) => {
                  return new Intl.NumberFormat('uk-UA', {
                    style: 'currency',
                    currency: 'UAH',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  }).format(Math.round(amount))
                }

                const formatDuration = (minutes: number) => {
                  if (minutes < 60) {
                    return `${minutes} хв`
                  }
                  const hours = Math.floor(minutes / 60)
                  const mins = minutes % 60
                  if (mins === 0) {
                    return `${hours} год`
                  }
                  return `${hours} год ${mins} хв`
                }

                const toggleCategory = (category: string) => {
                  setExpandedCategories(prev => {
                    const newSet = new Set(prev)
                    if (newSet.has(category)) {
                      newSet.delete(category)
                    } else {
                      newSet.add(category)
                    }
                    return newSet
                  })
                }

                return (
                  <div className="space-y-3">
                    {Object.entries(categoryGroups).map(([category, subcategories], categoryIndex) => {
                      const categoryColor = getCategoryColor(categoryIndex)
                      const isExpanded = expandedCategories.has(category)
                      const totalServicesInCategory = Object.values(subcategories).reduce(
                        (sum, sub) => sum + sub.services.length, 0
                      )
                      
                      return (
                        <div key={category} className="rounded-xl overflow-hidden card-glass">
                          {/* Category Header - Clickable */}
                          <button
                            onClick={() => toggleCategory(category)}
                            className={cn(
                              'w-full p-4 border-b-2 flex items-center justify-between hover:bg-white/5 transition-colors',
                              categoryColor.border
                            )}
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <div className={cn('w-1 h-6 rounded-full', categoryColor.bg)} />
                              <h2 className="text-base md:text-lg font-bold text-white text-left" style={{ letterSpacing: '-0.02em' }}>
                                {category}
                              </h2>
                              <span className="text-xs text-gray-400 font-medium">
                                ({totalServicesInCategory})
                              </span>
                            </div>
                            {isExpanded ? (
                              <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                            ) : (
                              <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                            )}
                          </button>

                          {/* Services List - Collapsible */}
                          {isExpanded && (
                            <div className="divide-y divide-white/10">
                              {Object.entries(subcategories).map(([subKey, subGroup]) => (
                                <div key={subKey}>
                                  {subGroup.subcategory && (
                                    <div className="px-3 py-2 bg-white/5 border-b border-white/10">
                                      <h3 className="text-xs font-bold text-gray-400 uppercase">
                                        {subGroup.subcategory}
                                      </h3>
                                    </div>
                                  )}
                                  {subGroup.services.map((service) => (
                                    <div
                                      key={service.id}
                                      className="p-3 hover:bg-white/5 transition-colors"
                                    >
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                          <h3 className="text-sm md:text-base font-bold text-white mb-1">
                                            {service.name}
                                          </h3>
                                          {service.description && (
                                            <p className="text-xs text-gray-400 mb-2">
                                              {service.description}
                                            </p>
                                          )}
                                          <div className="flex items-center gap-3 text-xs text-gray-500">
                                            <div className="flex items-center gap-1">
                                              <ClockIcon className="w-3 h-3" />
                                              <span className="font-medium">{formatDuration(service.duration)}</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-right flex-shrink-0 mr-2">
                                          <div className={cn('text-lg md:text-xl font-bold mb-1', categoryColor.text)}>
                                            {formatCurrency(service.price)}
                                          </div>
                                        </div>
                                        <div className="flex gap-1.5 flex-shrink-0">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => startEditService(service)}
                                            className="touch-target text-xs min-h-[44px] px-3 py-2 border border-white/20 bg-white/10 text-white hover:bg-white/20 rounded-lg"
                                          >
                                            Редагувати
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleDeleteService(service.id)}
                                            className="touch-target text-xs min-h-[44px] px-3 py-2 border border-red-400/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg"
                                          >
                                            Видалити
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}

          {/* Візитівка */}
          {activeTab === 'businessCard' && business && (
            <div ref={businessCardRef} className="rounded-xl p-4 md:p-6 card-glass">
            <BusinessCardEditor
              business={business}
              onSave={async (data) => {
                try {
                  const response = await fetch(`/api/business/${business.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                  })
                  if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Failed to save' }))
                    throw new Error(errorData.error || errorData.details || 'Failed to save')
                  }
                  const updated = await response.json()
                  if (updated.business) {
                    setBusiness(updated.business)
                    setFormData(updated.business)
                    localStorage.setItem('business', JSON.stringify(updated.business))
                    triggerConfetti()
                    toast({ title: 'Збережено', type: 'success', duration: 1500 })
                  } else {
                    throw new Error('Invalid response format')
                  }
                } catch (error) {
                  console.error('Error saving business card:', error)
                  const errorMessage = error instanceof Error ? error.message : 'Помилка збереження візитівки'
                  toast({ title: 'Помилка', description: errorMessage, type: 'error' })
                }
              }}
            />
            </div>
          )}

          {/* Telegram Tab */}
          {activeTab === 'telegram' && business && (
            <div className="rounded-xl p-4 md:p-6 card-glass">
              <TelegramSettings
                business={business}
                onUpdate={(updated) => {
                  setBusiness(updated)
                  localStorage.setItem('business', JSON.stringify(updated))
                }}
              />
            </div>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && business && (
            <div className="rounded-xl p-4 md:p-6 card-glass">
            <IntegrationsSettings
              business={business}
              onUpdate={async (data) => {
                const response = await fetch(`/api/business/${business.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(data)
                })
                if (response.ok) {
                  const { business: updatedBusiness } = await response.json()
                  if (updatedBusiness) {
                    setBusiness(updatedBusiness)
                    localStorage.setItem('business', JSON.stringify(updatedBusiness))
                  }
                  toast({ title: 'Налаштування збережено', type: 'success' })
                } else {
                  const err = await response.json().catch(() => ({}))
                  toast({ title: 'Помилка збереження', description: err.error || undefined, type: 'error' })
                }
              }}
            />
            </div>
          )}

          {/* Секція видалення акаунта */}
          <div className="rounded-xl p-4 md:p-6 card-glass border border-red-500/30">
            <div className="flex items-center gap-2 mb-2">
              <TrashIcon className="w-5 h-5 text-red-400" />
              <h2 className="text-lg font-bold text-red-400" style={{ letterSpacing: '-0.02em' }}>
                Видалити акаунт
              </h2>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Видалення акаунта є незворотним. Будуть видалені всі повʼязані дані: записи, клієнти, спеціалісти, послуги, налаштування, фінансові транзакції, інтеграції.
            </p>
            {!showDeleteConfirm ? (
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                className="border-red-400/50 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-lg"
              >
                Видалити акаунт
              </Button>
            ) : (
              <div className="space-y-3 max-w-md">
                <p className="text-sm text-gray-300">
                  Введіть <span className="font-bold text-red-400">{CONFIRM_DELETE_PHRASE}</span> для підтвердження:
                </p>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={CONFIRM_DELETE_PHRASE}
                  className="border border-red-500/50 bg-red-500/10 text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500/50"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== CONFIRM_DELETE_PHRASE || isDeleting}
                    className="bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {isDeleting ? 'Видалення...' : 'Підтвердити видалення'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteConfirm(false)
                      setDeleteConfirmText('')
                    }}
                    className="border-white/20 text-gray-300 hover:bg-white/10 rounded-lg"
                  >
                    Скасувати
                  </Button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

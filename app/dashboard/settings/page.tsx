'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BusinessCardEditor } from '@/components/admin/BusinessCardEditor'
import { BookingSlotsSettings } from '@/components/admin/BookingSlotsSettings'
import { ClientChangeRequestsSettings } from '@/components/admin/ClientChangeRequestsSettings'
import { IntegrationsSettings } from '@/components/admin/IntegrationsSettings'
import { PasswordForLoginSection } from '@/components/admin/PasswordForLoginSection'
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
import { normalizeUaPhone, isValidUaPhone } from '@/lib/utils/phone'

interface Business {
  id: string
  name: string
  slug?: string
  email: string
  phone?: string
  address?: string
  description?: string
  logo?: string
  avatar?: string
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

const BUSINESS_NICHES = [
  { value: 'SALON', label: 'Салон краси' },
  { value: 'BARBERSHOP', label: 'Барбершоп' },
  { value: 'STO', label: 'СТО (Станція технічного обслуговування)' },
  { value: 'CAR_WASH', label: 'Автомийка' },
  { value: 'SPA', label: 'СПА' },
  { value: 'FITNESS', label: 'Фітнес тренер' },
  { value: 'BEAUTY', label: 'Бюті сфера' },
  { value: 'TIRE_SERVICE', label: 'Шиномонтаж' },
  { value: 'EDUCATION', label: 'Освіта' },
  { value: 'MEDICINE', label: 'Медицина' },
  { value: 'RESTAURANT', label: 'Ресторан' },
  { value: 'OTHER', label: 'Інше' },
]

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

type Tab = 'info' | 'schedule' | 'masters' | 'services' | 'businessCard' | 'integrations'

const TAB_LABELS: Record<Tab, string> = {
  info: 'Інформація',
  schedule: 'Бронювання',
  masters: 'Спеціалісти',
  services: 'Послуги',
  businessCard: 'Візитівка',
  integrations: 'Інтеграції',
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
  const [quickNavOpen, setQuickNavOpen] = useState(false)
  const [infoExtraOpen, setInfoExtraOpen] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [dangerZoneOpen, setDangerZoneOpen] = useState(false)

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

  // Синхронізація форми з даними акаунту при зміні (наприклад після завантаження з API)
  useEffect(() => {
    if (business) {
      setFormData(prev => ({
        ...prev,
        name: business.name ?? prev.name,
        email: business.email ?? prev.email,
        phone: business.phone ?? prev.phone ?? '',
        address: business.address ?? prev.address ?? '',
        description: business.description ?? prev.description ?? '',
        niche: business.niche ?? prev.niche ?? 'OTHER',
        customNiche: business.customNiche ?? prev.customNiche ?? '',
        businessIdentifier: business.businessIdentifier ?? prev.businessIdentifier,
      }))
    }
  }, [business?.id, business?.name, business?.email, business?.phone, business?.address, business?.description, business?.niche, business?.customNiche, business?.businessIdentifier])

  // Синхронізація вкладки з URL (?tab=...)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const tabParam = params.get('tab')
    const allowedTabs: Tab[] = ['info', 'schedule', 'masters', 'services', 'businessCard', 'integrations']
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
      toast({ title: 'Помилка', description: 'ID акаунту відсутній', type: 'error' })
      return
    }

    // Валідація обов'язкових полів
    if (!formData.name?.trim()) {
      toast({ title: 'Помилка', description: 'Назва обов\'язкова', type: 'error' })
      return
    }
    if (!formData.email?.trim()) {
      toast({ title: 'Помилка', description: 'Email обов\'язковий', type: 'error' })
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email.trim())) {
      toast({ title: 'Помилка', description: 'Невірний формат email', type: 'error' })
      return
    }
    if (!formData.phone?.trim()) {
      toast({ title: 'Помилка', description: 'Номер телефону обов\'язковий', type: 'error' })
      return
    }
    if (!isValidUaPhone(formData.phone.trim())) {
      toast({ title: 'Помилка', description: 'Невірний формат телефону. Введіть номер з 0, наприклад 0671234567', type: 'error' })
      return
    }
    if (formData.niche === 'OTHER' && !formData.customNiche?.trim()) {
      toast({ title: 'Помилка', description: 'Вкажіть категорію', type: 'error' })
      return
    }

    // Перевіряємо наявність валідного ID (CUID або UUID)
    const isCuid = /^c[0-9a-z]{24}$/i.test(business.id)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(business.id)
    if (!business.id || (!isCuid && !isUuid)) {
      console.error('Invalid business ID format:', business.id)
      toast({ 
        title: 'Помилка', 
        description: 'Невірний формат ID. Будь ласка, увійдіть знову.', 
        type: 'error' 
      })
      localStorage.removeItem('business')
      setTimeout(() => router.push('/login'), 2000)
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        ...formData,
        name: formData.name?.trim(),
        email: formData.email?.trim().toLowerCase(),
        phone: formData.phone?.trim() ? normalizeUaPhone(formData.phone.trim()) : null,
        address: formData.address?.trim() || null,
        description: formData.description?.trim() || null,
        customNiche: formData.niche === 'OTHER' ? (formData.customNiche?.trim() || null) : null,
        profileCompleted: true,
      }
      
      const response = await fetch(`/api/business/${business.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const updated = await response.json()
        const saved = { ...updated.business, profileCompleted: true }
        setBusiness(saved)
        setFormData({
          name: saved.name,
          email: saved.email,
          phone: saved.phone || '',
          address: saved.address || '',
          description: saved.description || '',
          niche: saved.niche || 'OTHER',
          customNiche: saved.customNiche || '',
          businessIdentifier: saved.businessIdentifier || '',
        })
        localStorage.setItem('business', JSON.stringify(saved))
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto min-w-0 max-w-full">
                <code className="px-3 py-2 rounded-lg bg-white/10 text-gray-300 text-xs truncate min-w-0 w-full sm:max-w-[200px] md:max-w-xs" title={bookingUrl}>
                  {bookingUrl}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyBookingLink}
                  className="shrink-0 w-full sm:w-auto border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs whitespace-nowrap"
                >
                  Копіювати посилання
                </Button>
              </div>
            )}
          </div>

          {/* Status cards - швидкий огляд */}
          {quickNavOpen && (
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
            {/* Telegram tab removed; keep Telegram connection inside "Інтеграції" */}
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
                  <p className="text-xs text-gray-400">Бронювання</p>
                  <p className="text-sm font-bold text-white">Слоти</p>
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
          )}

          {/* Tabs - card-glass dark theme */}
          <div className="rounded-xl p-3 card-glass-subtle">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-2 flex-wrap">
              {(['info', 'schedule', 'masters', 'businessCard', 'integrations'] as Tab[]).map((tab) => (
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
              <button
                type="button"
                onClick={() => setQuickNavOpen((v) => !v)}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-white/10 text-gray-300 border border-white/20 hover:bg-white/15 hover:text-white transition-colors whitespace-nowrap"
              >
                {quickNavOpen ? 'Сховати огляд' : 'Швидкий огляд'}
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Інформація — профіль для подальшого редагування */}
          {activeTab === 'info' && (
            <div className="rounded-xl p-4 md:p-6 card-glass">
              <h2 className="text-lg font-bold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>Основна інформація</h2>
              <p className="text-sm text-gray-400 mb-6">
                Редагуйте профіль. Усі зміни зберігаються тут і в модалці заповнення профілю.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Назва *</label>
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Наприклад: 045 Barbershop"
                    className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Email *</label>
                  <Input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                    className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Телефон *</label>
                  <Input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0XX XXX XX XX"
                    className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                  />
                  <p className="text-xs text-gray-500 mt-1">Введіть номер з 0, наприклад 0671234567</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Категорія *</label>
                  <select
                    value={formData.niche || 'OTHER'}
                    onChange={(e) => setFormData({ ...formData, niche: e.target.value, customNiche: e.target.value !== 'OTHER' ? '' : formData.customNiche })}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                  >
                    {BUSINESS_NICHES.map((n) => (
                      <option key={n.value} value={n.value}>{n.label}</option>
                    ))}
                  </select>
                </div>

                {formData.niche === 'OTHER' && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Вкажіть вашу категорію *</label>
                    <Input
                      value={formData.customNiche || ''}
                      onChange={(e) => setFormData({ ...formData, customNiche: e.target.value })}
                      placeholder="Наприклад: Автосервіс, Стоматологія..."
                      className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                    />
                  </div>
                )}

                <details
                  className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
                  open={infoExtraOpen}
                  onToggle={(e) => setInfoExtraOpen((e.currentTarget as HTMLDetailsElement).open)}
                >
                  <summary className="cursor-pointer list-none select-none px-4 py-3 flex items-center justify-between gap-2 bg-white/5">
                    <div>
                      <p className="text-sm font-semibold text-white">Додатково</p>
                      <p className="text-xs text-gray-500 mt-0.5">Адреса, опис, ідентифікатор</p>
                    </div>
                    <span className="text-xs text-gray-400">{infoExtraOpen ? 'Сховати' : 'Показати'}</span>
                  </summary>
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">Адреса</label>
                      <Input
                        value={formData.address || ''}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="Місто, вулиця, будинок"
                        className="border border-white/20 rounded-lg bg-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">Опис</label>
                      <textarea
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Коротко про послуги, формат роботи..."
                        rows={4}
                        className={cn(
                          'w-full px-4 py-3 rounded-lg bg-white/10 text-white placeholder-gray-400 resize-none',
                          'border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15'
                        )}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">Ідентифікатор</label>
                      <div className="px-4 py-2 rounded-lg bg-white/10 border border-white/20">
                        <p className="text-lg font-bold text-blue-400">
                          {formData.businessIdentifier || 'Не встановлено'}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Унікальний ідентифікатор посилання (не можна змінити)
                      </p>
                    </div>
                  </div>
                </details>

                <Button
                  onClick={handleSaveBusiness}
                  disabled={isSaving}
                  className="w-full px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-all active:scale-[0.98]"
                  style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
                >
                  {isSaving ? 'Збереження...' : 'Зберегти профіль'}
                </Button>
              </div>
            </div>
          )}

          {/* Пароль для входу по пошті (Telegram-користувачі можуть створити пароль і входити також по email) */}
          {activeTab === 'info' && business && (
            <details
              className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
              open={securityOpen}
              onToggle={(e) => setSecurityOpen((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer list-none select-none px-4 py-3 flex items-center justify-between gap-2 bg-white/5">
                <div>
                  <p className="text-sm font-semibold text-white">Вхід та безпека</p>
                  <p className="text-xs text-gray-500 mt-0.5">Пароль для входу по email</p>
                </div>
                <span className="text-xs text-gray-400">{securityOpen ? 'Сховати' : 'Показати'}</span>
              </summary>
              <div className="p-4">
                <PasswordForLoginSection businessId={business.id} email={business.email} />
              </div>
            </details>
          )}

          {/* Бронювання та налаштування слотів */}
          {activeTab === 'schedule' && business && (
            <div className="space-y-6">
              <BookingSlotsSettings
                businessId={business.id}
                currentSettings={business.settings || undefined}
                onSave={(config) => {
                  try {
                    const prev = business.settings ? JSON.parse(business.settings) : {}
                    const updated = { ...prev, bookingSlots: config }
                    setBusiness(prevB => prevB ? { ...prevB, settings: JSON.stringify(updated) } : null)
                  } catch {
                    // ignore
                  }
                }}
              />
              <ClientChangeRequestsSettings
                businessId={business.id}
                currentSettings={business.settings || undefined}
                onSave={(nextRaw) => setBusiness((prevB) => (prevB ? { ...prevB, settings: nextRaw } : prevB))}
              />
              <div className="flex justify-end">
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

          {/* Спеціалісти — керуються в Графік роботи */}
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
                    // Signal booking pages (other tab) to refetch визитівка info
                    try {
                      const now = String(Date.now())
                      if (updated.business.id) localStorage.setItem(`booking_business_updated:${updated.business.id}`, now)
                      if (updated.business.slug) localStorage.setItem(`booking_business_updated:${updated.business.slug}`, now)
                      if (updated.business.businessIdentifier) localStorage.setItem(`booking_business_updated:${updated.business.businessIdentifier}`, now)
                    } catch {
                      // ignore
                    }
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

          {/* Небезпечна зона (згорнута за замовчуванням) */}
          <details
            className="rounded-xl border border-red-500/25 bg-red-500/[0.04] overflow-hidden"
            open={dangerZoneOpen}
            onToggle={(e) => setDangerZoneOpen((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer list-none select-none px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <TrashIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-red-300">Небезпечна зона</p>
                  <p className="text-xs text-red-200/60 mt-0.5">Видалення акаунта та даних</p>
                </div>
              </div>
              <span className="text-xs text-red-200/70 flex-shrink-0">{dangerZoneOpen ? 'Сховати' : 'Відкрити'}</span>
            </summary>
            <div className="p-4 md:p-6 border-t border-red-500/20">
              <p className="text-sm text-gray-300 mb-4">
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
          </details>

        </div>
      </div>
    </div>
  )
}

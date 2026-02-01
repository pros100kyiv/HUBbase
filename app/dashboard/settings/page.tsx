'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WorkingHoursEditor } from '@/components/admin/WorkingHoursEditor'
import { BusinessCardEditor } from '@/components/admin/BusinessCardEditor'
import { ImageIcon, ClockIcon, ChevronDownIcon, ChevronUpIcon } from '@/components/icons'
import { toast } from '@/components/ui/toast'
import { Confetti, triggerConfetti } from '@/components/ui/confetti'
import { cn } from '@/lib/utils'

interface Business {
  id: string
  name: string
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

type Tab = 'info' | 'masters' | 'services' | 'businessCard' | 'telegram'

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
  const [showMasterForm, setShowMasterForm] = useState(false)
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [editingMaster, setEditingMaster] = useState<Master | null>(null)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [telegramBotToken, setTelegramBotToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [telegramNotificationsEnabled, setTelegramNotificationsEnabled] = useState(false)
  const [telegramUsers, setTelegramUsers] = useState<any[]>([])
  const masterFormRef = useRef<HTMLDivElement>(null)
  const serviceFormRef = useRef<HTMLDivElement>(null)
  const businessCardRef = useRef<HTMLDivElement>(null)

  // Master form
  const [masterForm, setMasterForm] = useState({
    name: '',
    bio: '',
    rating: '0',
    photo: '',
  })

  // Service form
  const [serviceForm, setServiceForm] = useState({
    name: '',
    price: '',
    duration: '',
    category: '',
    subcategory: '',
  })

  // Автоматична прокрутка до форми спеціаліста
  useEffect(() => {
    if (showMasterForm && masterFormRef.current) {
      setTimeout(() => {
        masterFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [showMasterForm])

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
          setTelegramBotToken(updatedBusiness.telegramBotToken || '')
          setTelegramChatId(updatedBusiness.telegramChatId || '')
          setTelegramNotificationsEnabled(updatedBusiness.telegramNotificationsEnabled || false)
          // Оновлюємо localStorage з актуальними даними
          localStorage.setItem('business', JSON.stringify(updatedBusiness))
          
          // Завантажуємо користувачів Telegram
          if (updatedBusiness.id) {
            fetch(`/api/telegram/users?businessId=${updatedBusiness.id}`)
              .then(res => res.json())
              .then(data => setTelegramUsers(Array.isArray(data) ? data : []))
              .catch(() => setTelegramUsers([]))
          }
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

  // Check URL params for tab
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tabParam = params.get('tab')
      if (tabParam && ['info', 'masters', 'services'].includes(tabParam)) {
        setActiveTab(tabParam as Tab)
      }
    }
  }, [])

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

  const handleSaveMaster = async () => {
    if (!business) return

    // Validation
    if (!masterForm.name.trim()) {
      toast({ title: 'Помилка', description: 'Будь ласка, введіть ім\'я спеціаліста', type: 'error' })
      return
    }

    try {
      setIsSaving(true)
      const url = editingMaster
        ? `/api/masters/${editingMaster.id}`
        : '/api/masters'
      const method = editingMaster ? 'PATCH' : 'POST'

      // Normalize rating: replace comma with dot for decimal numbers
      const normalizedRating = masterForm.rating.toString().replace(',', '.')
      const ratingValue = parseFloat(normalizedRating) || 0

      const requestBody = {
        ...(editingMaster ? {} : { businessId: business.id }),
        name: masterForm.name.trim(),
        bio: masterForm.bio?.trim() || null,
        photo: masterForm.photo?.trim() || null,
        rating: ratingValue,
      }

      console.log('Sending master data:', requestBody)

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Server error response:', errorData)
        const errorMessage = errorData.details?.message || errorData.error || `HTTP ${response.status}`
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('Master saved:', data)

      await loadData()
      setShowMasterForm(false)
      setEditingMaster(null)
      setMasterForm({ name: '', bio: '', rating: '0', photo: '' })
      toast({ 
        title: 'Успішно!', 
        description: editingMaster ? 'Спеціаліста оновлено' : 'Спеціаліста додано', 
        type: 'success' 
      })
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 2000)
    } catch (error) {
      console.error('Error saving master:', error)
      toast({ 
        title: 'Помилка', 
        description: error instanceof Error ? error.message : 'Невідома помилка', 
        type: 'error' 
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveService = async () => {
    if (!business) return

    try {
      const url = editingService
        ? `/api/services/${editingService.id}`
        : '/api/services'
      const method = editingService ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingService ? {} : { businessId: business.id }),
          name: serviceForm.name,
          price: serviceForm.price,
          duration: serviceForm.duration,
          category: serviceForm.category || null,
          subcategory: serviceForm.subcategory || null,
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

  const handleDeleteMaster = async (id: string) => {
    if (!window.confirm('Видалити цього спеціаліста?')) return

    try {
      const response = await fetch(`/api/masters/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadData()
        toast({ title: 'Успішно!', description: 'Спеціаліста видалено', type: 'success' })
      } else {
        toast({ title: 'Помилка', description: 'Не вдалося видалити спеціаліста', type: 'error' })
      }
    } catch (error) {
      toast({ title: 'Помилка', description: 'Помилка при видаленні', type: 'error' })
    }
  }

  const handleDeleteService = async (id: string) => {
    if (!window.confirm('Видалити цю послугу?')) return

    try {
      const response = await fetch(`/api/services/${id}`, {
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

  const startEditMaster = (master: Master) => {
    setEditingMaster(master)
    setMasterForm({
      name: master.name,
      bio: master.bio || '',
      rating: master.rating.toString(),
      photo: master.photo || '',
    })
    setShowMasterForm(true)
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
      price: (service.price / 100).toString(), // Конвертуємо з копійок в гривні для відображення
      duration: service.duration.toString(),
      category: category,
      subcategory: subcategory,
    })
    setShowServiceForm(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-gray-500">Завантаження...</p>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Бізнес не знайдено</p>
          <Button onClick={() => router.push('/login')}>Увійти</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Confetti trigger={showConfetti} />
      <div className="p-3">
        <div className="max-w-7xl mx-auto">
          <div className="spacing-item">
            <div>
              <h1 className="text-heading">Налаштування</h1>
              <p className="text-caption font-medium">Управління бізнесом</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1.5 mb-2 bg-gray-100 dark:bg-gray-800 rounded-candy-sm border border-gray-200 dark:border-gray-700 p-1.5 overflow-x-auto">
            {(['info', 'masters', 'services', 'businessCard', 'telegram'] as Tab[]).map((tab) => {
              const tabColors: Record<Tab, string> = {
                'info': 'hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-candy-blue',
                'masters': 'hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-candy-blue',
                'services': 'hover:bg-green-50 dark:hover:bg-gray-700 hover:text-candy-mint',
                'businessCard': 'hover:bg-pink-50 dark:hover:bg-gray-700 hover:text-candy-pink',
                'telegram': 'hover:bg-cyan-50 dark:hover:bg-gray-700 hover:text-cyan-500',
              }
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-candy-xs transition-all duration-200 active:scale-97 whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab
                      ? 'candy-purple text-white shadow-soft-lg'
                      : `text-gray-700 dark:text-gray-300 ${tabColors[tab]}`
                  }`}
                >
                  {tab === 'info' && 'Інформація'}
                  {tab === 'masters' && 'Спеціалісти'}
                  {tab === 'services' && 'Послуги'}
                  {tab === 'businessCard' && 'Візитівка'}
                  {tab === 'telegram' && 'Telegram'}
                </button>
              )
            })}
          </div>

        {/* Tab Content */}
        <div className="space-y-2">
          {/* Інформація */}
          {activeTab === 'info' && (
            <Card>
              <CardHeader>
                <CardTitle>Основна інформація</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">Назва бізнесу</label>
                  <Input
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">Email</label>
                  <Input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">Телефон</label>
                  <Input
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+380XXXXXXXXX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">Адреса</label>
                  <Input
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">Опис</label>
                  <Input
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Короткий опис вашого бізнесу"
                  />
                </div>


                <Button onClick={handleSaveBusiness} disabled={isSaving} className="w-full">
                  {isSaving ? 'Збереження...' : 'Зберегти'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Майстри */}
          {activeTab === 'masters' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg md:text-xl font-black text-foreground">Спеціалісти</h2>
                <Button
                  onClick={() => {
                    setShowMasterForm(true)
                    setEditingMaster(null)
                    setMasterForm({ name: '', bio: '', rating: '0', photo: '' })
                  }}
                >
                  + Додати спеціаліста
                </Button>
              </div>

              {showMasterForm && (
                <div ref={masterFormRef}>
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader className="p-2 pb-1">
                    <CardTitle className="text-sm font-black text-foreground dark:text-white">
                      {editingMaster ? 'Редагувати спеціаліста' : 'Новий спеціаліст'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 space-y-1.5">
                    <Input
                      placeholder="Ім'я спеціаліста"
                      value={masterForm.name}
                      onChange={(e) => setMasterForm({ ...masterForm, name: e.target.value })}
                      className="text-xs py-1.5 h-auto"
                    />
                    <div>
                      <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Фото (URL або завантажити)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          placeholder="https://example.com/photo.jpg"
                          value={masterForm.photo}
                          onChange={(e) => setMasterForm({ ...masterForm, photo: e.target.value })}
                          className="text-xs py-1.5 h-auto flex-1"
                        />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id="master-photo-upload"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              const reader = new FileReader()
                              reader.onloadend = () => {
                                setMasterForm({ ...masterForm, photo: reader.result as string })
                              }
                              reader.readAsDataURL(file)
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('master-photo-upload')?.click()}
                          className="text-xs py-1.5 h-auto"
                        >
                          <ImageIcon className="w-3 h-3" />
                        </Button>
                      </div>
                      {masterForm.photo && (
                        <div className="mt-2">
                          <img
                            src={masterForm.photo}
                            alt="Preview"
                            className="w-16 h-16 object-cover rounded-candy-xs border border-gray-200 dark:border-gray-700"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <Input
                      placeholder="Біографія"
                      value={masterForm.bio}
                      onChange={(e) => setMasterForm({ ...masterForm, bio: e.target.value })}
                      className="text-xs py-1.5 h-auto"
                    />
                    <Input
                      type="number"
                      placeholder="Рейтинг (0-5)"
                      value={masterForm.rating}
                      onChange={(e) => setMasterForm({ ...masterForm, rating: e.target.value })}
                      min="0"
                      max="5"
                      step="0.1"
                      className="text-xs py-1.5 h-auto"
                    />
                    <div className="flex gap-1.5 pt-1">
                      <Button onClick={handleSaveMaster} className="flex-1 text-xs py-1.5 h-auto" disabled={isSaving}>
                        {isSaving ? 'Збереження...' : 'Зберегти'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowMasterForm(false)
                          setEditingMaster(null)
                        }}
                        className="text-xs py-1.5 h-auto"
                      >
                        Скасувати
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                </div>
              )}

              <div className="space-y-1.5">
                {masters.map((master) => (
                  <div key={master.id} className="space-y-1.5">
                    <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      <CardContent className="p-2">
                        <div className="flex justify-between items-start mb-1.5">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-black text-foreground dark:text-white mb-0.5 truncate">
                              {master.name}
                            </h3>
                            {master.bio && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{master.bio}</p>
                            )}
                            <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">
                              Рейтинг: {master.rating}/5
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditMaster(master)}
                            className="flex-1 text-xs py-1 h-auto"
                          >
                            Редагувати
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteMaster(master.id)}
                            className="text-xs py-1 h-auto text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300"
                          >
                            Видалити
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    <WorkingHoursEditor
                      masterId={master.id}
                      businessId={business.id}
                      currentHours={master.workingHours || undefined}
                      onSave={(hours) => {
                        setMasters(prev =>
                          prev.map(m =>
                            m.id === master.id ? { ...m, workingHours: hours } : m
                          )
                        )
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Послуги */}
          {activeTab === 'services' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg md:text-xl font-black text-foreground">Послуги</h2>
                <Button
                  onClick={() => {
                    setShowServiceForm(true)
                    setEditingService(null)
                    setServiceForm({ name: '', price: '', duration: '', category: '', subcategory: '' })
                  }}
                >
                  + Додати послугу
                </Button>
              </div>

              {showServiceForm && (
                <div ref={serviceFormRef}>
                <Card className="bg-surface border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-primary">
                      {editingService ? 'Редагувати послугу' : 'Нова послуга'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input
                      placeholder="Назва послуги"
                      value={serviceForm.name}
                      onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        type="number"
                        placeholder="Ціна (₴)"
                        value={serviceForm.price}
                        onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                      />
                      <Input
                        type="number"
                        placeholder="Тривалість (хв)"
                        value={serviceForm.duration}
                        onChange={(e) => setServiceForm({ ...serviceForm, duration: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <div>
                        <label className="block text-sm font-medium mb-1.5 text-gray-900 dark:text-white">
                          Категорія (папка)
                        </label>
                        <Input
                          placeholder="Наприклад: Стрижка, Манікюр"
                          value={serviceForm.category}
                          onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                        />
                        {services.length > 0 && (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                setServiceForm({ ...serviceForm, category: e.target.value })
                              }
                            }}
                            className="mt-1.5 w-full px-3 py-2 rounded-candy border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
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
                          <label className="block text-sm font-medium mb-1.5 text-gray-900 dark:text-white">
                            Підкатегорія (підпапка) - опціонально
                          </label>
                          <Input
                            placeholder="Наприклад: Чоловіча, Жіноча, Дитяча"
                            value={serviceForm.subcategory}
                            onChange={(e) => setServiceForm({ ...serviceForm, subcategory: e.target.value })}
                          />
                          {services.length > 0 && serviceForm.category && (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  setServiceForm({ ...serviceForm, subcategory: e.target.value })
                                }
                              }}
                              className="mt-1.5 w-full px-3 py-2 rounded-candy border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
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
                    <div className="flex gap-2">
                      <Button onClick={handleSaveService} className="flex-1">
                        Зберегти
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowServiceForm(false)
                          setEditingService(null)
                        }}
                      >
                        Скасувати
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                </div>
              )}

              {/* Group services by category */}
              {(() => {
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
                  }).format(amount / 100)
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
                        <Card key={category} className="overflow-hidden">
                          {/* Category Header - Clickable */}
                          <button
                            onClick={() => toggleCategory(category)}
                            className={cn(
                              'w-full p-3 border-b-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
                              categoryColor.border
                            )}
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <div className={cn('w-1 h-6 rounded-full', categoryColor.bg)} />
                              <h2 className="text-base md:text-lg font-black text-foreground dark:text-white text-left">
                                {category}
                              </h2>
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
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
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                              {Object.entries(subcategories).map(([subKey, subGroup]) => (
                                <div key={subKey}>
                                  {subGroup.subcategory && (
                                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-700">
                                      <h3 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">
                                        {subGroup.subcategory}
                                      </h3>
                                    </div>
                                  )}
                                  {subGroup.services.map((service) => (
                                    <div
                                      key={service.id}
                                      className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                    >
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                          <h3 className="text-sm md:text-base font-black text-foreground dark:text-white mb-1">
                                            {service.name}
                                          </h3>
                                          {service.description && (
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                              {service.description}
                                            </p>
                                          )}
                                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                            <div className="flex items-center gap-1">
                                              <ClockIcon className="w-3 h-3" />
                                              <span className="font-medium">{formatDuration(service.duration)}</span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-right flex-shrink-0 mr-2">
                                          <div className={cn('text-lg md:text-xl font-black mb-1', categoryColor.text)}>
                                            {formatCurrency(service.price)}
                                          </div>
                                        </div>
                                        <div className="flex gap-1.5 flex-shrink-0">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => startEditService(service)}
                                            className="text-xs px-2 py-1 h-auto"
                                          >
                                            Редагувати
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleDeleteService(service.id)}
                                            className="text-xs px-2 py-1 h-auto text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
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
                        </Card>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}

          {/* Візитівка */}
          {activeTab === 'businessCard' && business && (
            <div ref={businessCardRef}>
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
            <div className="space-y-4">
              <div className="card-candy p-4">
                <h2 className="text-subheading mb-4">Налаштування Telegram бота</h2>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Токен бота</label>
                    <Input
                      type="password"
                      placeholder="Введіть токен Telegram бота"
                      value={telegramBotToken}
                      onChange={(e) => setTelegramBotToken(e.target.value)}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Отримайте токен від @BotFather в Telegram
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">ID чату (опціонально)</label>
                    <Input
                      placeholder="ID чату для сповіщень"
                      value={telegramChatId}
                      onChange={(e) => setTelegramChatId(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="telegramNotifications"
                      checked={telegramNotificationsEnabled}
                      onChange={(e) => setTelegramNotificationsEnabled(e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <label htmlFor="telegramNotifications" className="text-sm font-medium">
                      Увімкнути сповіщення
                    </label>
                  </div>

                  <Button
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/telegram/setup', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            businessId: business.id,
                            botToken: telegramBotToken,
                            chatId: telegramChatId || null,
                            notificationsEnabled: telegramNotificationsEnabled,
                          }),
                        })

                        if (response.ok) {
                          const { toast } = await import('@/components/ui/toast')
                          toast({ title: 'Успішно!', description: 'Telegram бота налаштовано', type: 'success', duration: 2000 })
                          
                          setBusiness((prev: any) => ({
                            ...prev,
                            telegramBotToken,
                            telegramChatId,
                            telegramNotificationsEnabled,
                          }))
                        } else {
                          const { toast } = await import('@/components/ui/toast')
                          toast({ title: 'Помилка', description: 'Не вдалося налаштувати бота', type: 'error', duration: 3000 })
                        }
                      } catch (error) {
                        console.error('Error setting up Telegram bot:', error)
                        const { toast } = await import('@/components/ui/toast')
                        toast({ title: 'Помилка', description: 'Помилка при збереженні', type: 'error', duration: 3000 })
                      }
                    }}
                    className="w-full"
                  >
                    Зберегти налаштування
                  </Button>
                </div>
              </div>

              {/* Користувачі Telegram */}
              <div className="card-candy p-4">
                <h2 className="text-subheading mb-4">Користувачі Telegram бота</h2>
                
                {telegramUsers.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Немає зареєстрованих користувачів
                  </p>
                ) : (
                  <div className="space-y-2">
                    {telegramUsers.map((user) => (
                      <div key={user.id} className="p-3 rounded-candy-sm bg-gray-100 dark:bg-gray-800">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-black text-foreground">
                              {user.firstName} {user.lastName}
                            </p>
                            <p className="text-xs text-gray-500">@{user.username || 'без username'}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              Роль: {user.role === 'OWNER' ? 'Власник' : user.role === 'ADMIN' ? 'Адміністратор' : user.role === 'MANAGER' ? 'Менеджер' : user.role === 'EMPLOYEE' ? 'Співробітник' : 'Переглядач'}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2 py-1 rounded ${user.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                              {user.isActive ? 'Активний' : 'Неактивний'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Інструкції */}
              <div className="card-candy p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <h3 className="text-sm font-black text-foreground mb-2">📋 Інструкції</h3>
                <ol className="text-xs text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
                  <li>Отримайте токен від @BotFather в Telegram</li>
                  <li>Введіть токен та збережіть налаштування</li>
                  <li>Налаштуйте webhook через команду: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">npm run telegram:webhook {business.id}</code></li>
                  <li>Відправте <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">/start</code> боту в Telegram</li>
                  <li>Зареєструйте користувача через API або веб-інтерфейс</li>
                </ol>
              </div>
            </div>
          )}

        </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WorkingHoursEditor } from '@/components/admin/WorkingHoursEditor'
import { Sidebar } from '@/components/admin/Sidebar'
import { toast } from '@/components/ui/toast'
import { Confetti, triggerConfetti } from '@/components/ui/confetti'

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
}

type Tab = 'info' | 'masters' | 'services'

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

  // Master form
  const [masterForm, setMasterForm] = useState({
    name: '',
    bio: '',
    rating: '0',
  })

  // Service form
  const [serviceForm, setServiceForm] = useState({
    name: '',
    price: '',
    duration: '',
    category: '',
  })

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
          // Оновлюємо localStorage з актуальними даними
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
        toast({ title: 'Успішно!', description: 'Дані збережено', type: 'success' })
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
      toast({ title: 'Помилка', description: 'Будь ласка, введіть ім\'я майстра', type: 'error' })
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
        photo: editingMaster?.photo || null,
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
      setMasterForm({ name: '', bio: '', rating: '0' })
      toast({ 
        title: 'Успішно!', 
        description: editingMaster ? 'Майстра оновлено' : 'Майстра додано', 
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
        }),
      })

      if (response.ok) {
        await loadData()
        setShowServiceForm(false)
        setEditingService(null)
        setServiceForm({ name: '', price: '', duration: '', category: '' })
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
    if (!window.confirm('Видалити цього майстра?')) return

    try {
      const response = await fetch(`/api/masters/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await loadData()
        toast({ title: 'Успішно!', description: 'Майстра видалено', type: 'success' })
      } else {
        toast({ title: 'Помилка', description: 'Не вдалося видалити майстра', type: 'error' })
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
    })
    setShowMasterForm(true)
  }

  const startEditService = (service: Service) => {
    setEditingService(service)
    setServiceForm({
      name: service.name,
      price: service.price.toString(),
      duration: service.duration.toString(),
      category: service.category || '',
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
      <Sidebar />
      <div className="ml-16 md:ml-40 p-3">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-heading spacing-item">Налаштування</h1>

          {/* Tabs */}
          <div className="flex gap-1.5 mb-2 bg-gray-100 rounded-candy-sm border border-gray-200 p-1.5 overflow-hidden">
            {(['info', 'masters', 'services'] as Tab[]).map((tab) => {
              const tabColors: Record<Tab, string> = {
                'info': 'hover:bg-blue-50 hover:text-candy-blue',
                'masters': 'hover:bg-blue-50 hover:text-candy-blue',
                'services': 'hover:bg-green-50 hover:text-candy-mint',
              }
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-candy-xs transition-all duration-200 active:scale-97 whitespace-nowrap ${
                    activeTab === tab
                      ? 'candy-purple text-white shadow-soft-lg'
                      : `text-gray-600 ${tabColors[tab]}`
                  }`}
                >
                  {tab === 'info' && 'Інформація'}
                  {tab === 'masters' && 'Майстри'}
                  {tab === 'services' && 'Послуги'}
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
                <h2 className="text-lg md:text-xl font-black text-foreground">Майстри</h2>
                <Button
                  onClick={() => {
                    setShowMasterForm(true)
                    setEditingMaster(null)
                    setMasterForm({ name: '', bio: '', rating: '0' })
                  }}
                >
                  + Додати майстра
                </Button>
              </div>

              {showMasterForm && (
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader className="p-2 pb-1">
                    <CardTitle className="text-sm font-black text-foreground dark:text-white">
                      {editingMaster ? 'Редагувати майстра' : 'Новий майстер'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 space-y-1.5">
                    <Input
                      placeholder="Ім'я майстра"
                      value={masterForm.name}
                      onChange={(e) => setMasterForm({ ...masterForm, name: e.target.value })}
                      className="text-xs py-1.5 h-auto"
                    />
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
                    setServiceForm({ name: '', price: '', duration: '', category: '' })
                  }}
                >
                  + Додати послугу
                </Button>
              </div>

              {showServiceForm && (
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
                    <Input
                      placeholder="Категорія (опціонально)"
                      value={serviceForm.category}
                      onChange={(e) => setServiceForm({ ...serviceForm, category: e.target.value })}
                    />
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
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((service) => (
                  <Card key={service.id}>
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-base md:text-lg font-black text-foreground mb-1">
                          {service.name}
                          </h3>
                          {service.category && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">{service.category}</p>
                          )}
                          <div className="flex gap-4 mt-2">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {service.price} ₴
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {service.duration} хв
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditService(service)}
                          className="flex-1"
                        >
                          Редагувати
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteService(service.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          Видалити
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

        </div>
        </div>
      </div>
    </div>
  )
}

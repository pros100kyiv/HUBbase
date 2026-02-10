'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { SearchIcon, FilterIcon, CheckSquareIcon, SquareIcon, ChevronDownIcon, EditIcon, TrashIcon, XIcon, CalendarIcon } from '@/components/icons'
import { ModalPortal } from '@/components/ui/modal-portal'
import { toast } from '@/components/ui/toast'

interface Service {
  id: string
  name: string
  price: number
  duration: number
  category?: string | null
  subcategory?: string | null
  description?: string | null
}

export default function PricePage() {
  const router = useRouter()
  const [business, setBusiness] = useState<any>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'duration' | 'category'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedServices, setSelectedServices] = useState<Service[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [createForm, setCreateForm] = useState({ name: '', price: '', duration: '', category: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadServices = () => {
    if (!business?.id) return
    fetch(`/api/services?businessId=${business.id}`)
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setServices(data) })
      .catch(err => console.error('Failed to load services', err))
  }

  useEffect(() => {
    const businessData = localStorage.getItem('business')
    if (!businessData) {
      router.push('/login')
      return
    }
    try {
      const parsed = JSON.parse(businessData)
      setBusiness(parsed)
    } catch (e) {
      console.error('Failed to parse business data', e)
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    if (business?.id) {
      setLoading(true)
      fetch(`/api/services?businessId=${business.id}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setServices(data)
          }
        })
        .catch(err => console.error('Failed to load services', err))
        .finally(() => setLoading(false))
    }
  }, [business])

  // Get unique categories
  const categories = Array.from(new Set(services.map(s => s.category).filter(Boolean))) as string[]

  // Filter services
  const filteredServices = services
    .filter(service => {
      const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (service.category && service.category.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesCategory = selectedCategory ? service.category === selectedCategory : true
      return matchesSearch && matchesCategory
    })
    .sort((a, b) => {
      let cmp = 0
      if (sortBy === 'name') cmp = (a.name || '').localeCompare(b.name || '', 'uk')
      else if (sortBy === 'price') cmp = a.price - b.price
      else if (sortBy === 'duration') cmp = a.duration - b.duration
      else if (sortBy === 'category') cmp = (a.category || '').localeCompare(b.category || '', 'uk')
      return sortOrder === 'asc' ? cmp : -cmp
    })

  const isSelected = (id: string) => selectedServices.some(s => s.id === id)

  const toggleService = (service: Service) => {
    if (isSelected(service.id)) {
      setSelectedServices(prev => prev.filter(s => s.id !== service.id))
    } else {
      setSelectedServices(prev => [...prev, service])
    }
  }

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0)
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0)

  if (!business) {
    return (
      <div className="p-4 md:p-8 min-h-screen flex items-center justify-center text-white">
        <p className="text-gray-400">Завантаження...</p>
      </div>
    )
  }

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = createForm.name.trim()
    const priceNum = parseInt(createForm.price, 10)
    const durationNum = parseInt(createForm.duration, 10)
    if (!name || isNaN(priceNum) || priceNum < 0 || isNaN(durationNum) || durationNum < 1) {
      toast({ title: 'Помилка', description: 'Заповніть назву, ціну (≥ 0) та тривалість (≥ 1 хв)', type: 'error' })
      return
    }
    if (!business?.id) {
      toast({ title: 'Помилка', description: 'Бізнес не визначено', type: 'error' })
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          name,
          price: priceNum,
          duration: durationNum,
          category: createForm.category.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Помилка', description: data?.error || 'Не вдалося додати послугу', type: 'error' })
        return
      }
      toast({ title: 'Готово', description: 'Послугу додано до прайсу', type: 'success' })
      setShowCreateModal(false)
      setCreateForm({ name: '', price: '', duration: '', category: '' })
      loadServices()
    } catch (err) {
      toast({ title: 'Помилка', description: 'Помилка мережі', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditService = (service: Service) => {
    setEditingService(service)
    setCreateForm({
      name: service.name,
      price: String(service.price),
      duration: String(service.duration),
      category: service.category || '',
    })
  }

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingService || !business?.id) return
    const name = createForm.name.trim()
    const priceNum = parseInt(createForm.price, 10)
    const durationNum = parseInt(createForm.duration, 10)
    if (!name || isNaN(priceNum) || priceNum < 0 || isNaN(durationNum) || durationNum < 1) {
      toast({ title: 'Помилка', description: 'Заповніть назву, ціну (≥ 0) та тривалість (≥ 1 хв)', type: 'error' })
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/services/${editingService.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          name,
          price: priceNum,
          duration: durationNum,
          category: createForm.category.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Помилка', description: data?.error || 'Не вдалося оновити послугу', type: 'error' })
        return
      }
      toast({ title: 'Готово', description: 'Послугу оновлено', type: 'success' })
      setEditingService(null)
      setCreateForm({ name: '', price: '', duration: '', category: '' })
      loadServices()
    } catch (err) {
      toast({ title: 'Помилка', description: 'Помилка мережі', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteService = async (service: Service) => {
    if (!confirm(`Видалити послугу «${service.name}»?`)) return
    if (!business?.id) return
    try {
      const res = await fetch(`/api/services/${service.id}?businessId=${encodeURIComponent(business.id)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: 'Помилка', description: data?.error || 'Не вдалося видалити послугу', type: 'error' })
        return
      }
      toast({ title: 'Готово', description: 'Послугу видалено', type: 'success' })
      setSelectedServices(prev => prev.filter(s => s.id !== service.id))
      loadServices()
    } catch (err) {
      toast({ title: 'Помилка', description: 'Помилка мережі', type: 'error' })
    }
  }


  const stats = {
    total: services.length,
    categories: categories.length,
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 min-h-screen text-white pb-[max(6rem,calc(5rem+env(safe-area-inset-bottom)))] md:pb-24">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-6">
        {/* Main content */}
        <div className="lg:col-span-3 space-y-3 md:space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
                Прайс-лист
              </h1>
              <p className="text-gray-400 mt-0.5 text-sm">Оберіть послуги для розрахунку вартості</p>
            </div>
            <button
              type="button"
              onClick={() => { setCreateForm({ name: '', price: '', duration: '', category: '' }); setShowCreateModal(true) }}
              className="touch-target px-4 py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors active:scale-[0.98] flex-shrink-0"
              style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
            >
              Додати до прайсу
            </button>
          </div>

          <div className="rounded-xl p-3 sm:p-4 md:p-6 card-glass">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <div className="relative flex-1 min-w-0">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  className="block w-full pl-9 pr-3 py-2.5 sm:py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 min-h-[44px] sm:min-h-0"
                  placeholder="Пошук послуг..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="relative min-w-0 sm:w-44">
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={e => {
                    const [s, o] = (e.target.value || 'name-asc').split('-') as [typeof sortBy, typeof sortOrder]
                    setSortBy(s)
                    setSortOrder(o)
                  }}
                  className="appearance-none pl-3 pr-8 py-2.5 sm:py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/30 cursor-pointer w-full min-h-[44px] sm:min-h-0"
                >
                  <option value="name-asc">Назва А→Я</option>
                  <option value="name-desc">Назва Я→А</option>
                  <option value="price-asc">Ціна ↑</option>
                  <option value="price-desc">Ціна ↓</option>
                  <option value="duration-asc">Тривалість ↑</option>
                  <option value="duration-desc">Тривалість ↓</option>
                  <option value="category-asc">Категорія А→Я</option>
                  <option value="category-desc">Категорія Я→А</option>
                </select>
                <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

      {/* Modal: додати позицію до прайсу */}
      {showCreateModal && !editingService && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => !isSubmitting && setShowCreateModal(false)}>
            <div
              className="relative w-[95%] sm:w-full sm:max-w-md sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0"
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => !isSubmitting && setShowCreateModal(false)}
                className="modal-close text-gray-400 hover:text-white"
                aria-label="Закрити"
              >
                <XIcon className="w-5 h-5" />
              </button>
              <div className="pr-10 mb-2 flex-shrink-0">
                <h2 className="modal-title">Додати до прайсу</h2>
                <p className="modal-subtitle">Заповніть основну інформацію про послугу</p>
              </div>
              <form onSubmit={handleCreateService} className="space-y-2.5 flex-1 min-h-0 overflow-y-auto pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Назва послуги *</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Наприклад: Стрижка чоловіча"
                    required
                    className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Ціна (₴) *</label>
                    <input
                      type="number"
                      min="0"
                      value={createForm.price}
                      onChange={e => setCreateForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="100"
                      required
                      className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Тривалість (хв) *</label>
                    <input
                      type="number"
                      min="1"
                      value={createForm.duration}
                      onChange={e => setCreateForm(f => ({ ...f, duration: e.target.value }))}
                      placeholder="30"
                      required
                      className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Категорія (опціонально)</label>
                  <input
                    type="text"
                    value={createForm.category}
                    onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="Наприклад: Стрижка, Манікюр"
                    className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                  />
                  {categories.length > 0 && (
                    <select
                      value={createForm.category}
                      onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
                      className="mt-1.5 w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                    >
                      <option value="">Або виберіть існуючу категорію</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => !isSubmitting && setShowCreateModal(false)}
                    className="flex-1 px-4 py-3 border border-white/20 bg-white/10 text-white font-medium rounded-lg hover:bg-white/20 transition-all"
                  >
                    Скасувати
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
                  >
                    {isSubmitting ? 'Збереження...' : 'Додати'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal: редагувати послугу */}
      {editingService && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => !isSubmitting && setEditingService(null)}>
            <div
              className="relative w-[95%] sm:w-full sm:max-w-md sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0"
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => !isSubmitting && setEditingService(null)}
                className="modal-close text-gray-400 hover:text-white"
                aria-label="Закрити"
              >
                <XIcon className="w-5 h-5" />
              </button>
              <div className="pr-10 mb-2 flex-shrink-0">
                <h2 className="modal-title">Редагувати послугу</h2>
                <p className="modal-subtitle">Оновіть інформацію про послугу</p>
              </div>
              <form onSubmit={handleUpdateService} className="space-y-2.5 flex-1 min-h-0 overflow-y-auto pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Назва послуги *</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Наприклад: Стрижка чоловіча"
                    required
                    className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Ціна (₴) *</label>
                    <input
                      type="number"
                      min="0"
                      value={createForm.price}
                      onChange={e => setCreateForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="100"
                      required
                      className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Тривалість (хв) *</label>
                    <input
                      type="number"
                      min="1"
                      value={createForm.duration}
                      onChange={e => setCreateForm(f => ({ ...f, duration: e.target.value }))}
                      placeholder="30"
                      required
                      className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-300">Категорія (опціонально)</label>
                  <input
                    type="text"
                    value={createForm.category}
                    onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="Наприклад: Стрижка, Манікюр"
                    className="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                  />
                  {categories.length > 0 && (
                    <select
                      value={createForm.category}
                      onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
                      className="mt-1.5 w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15"
                    >
                      <option value="">Або виберіть існуючу категорію</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => !isSubmitting && setEditingService(null)}
                    className="flex-1 px-4 py-3 border border-white/20 bg-white/10 text-white font-medium rounded-lg hover:bg-white/20 transition-all"
                  >
                    Скасувати
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
                  >
                    {isSubmitting ? 'Збереження...' : 'Зберегти'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

          {/* Categories */}
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "touch-target min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                  !selectedCategory
                    ? "bg-white text-black"
                    : "bg-white/10 text-gray-300 hover:bg-white/15 border border-white/20"
                )}
              >
                Всі
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "touch-target min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                    selectedCategory === cat
                      ? "bg-white text-black"
                      : "bg-white/10 text-gray-300 hover:bg-white/15 border border-white/20"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Services List */}
          {loading ? (
            <div className="rounded-xl p-8 card-glass text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-white/30 border-t-white"></div>
              <p className="text-gray-400 mt-3 text-sm">Завантаження...</p>
            </div>
          ) : services.length === 0 ? (
            <div className="rounded-xl p-8 md:p-12 card-glass text-center">
              <FilterIcon className="w-12 h-12 mx-auto text-gray-500/60 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-1">Прайс порожній</h3>
              <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
                Додайте першу послугу — вона зʼявиться тут і буде доступна при створенні записів.
              </p>
              <button
                type="button"
                onClick={() => { setCreateForm({ name: '', price: '', duration: '', category: '' }); setShowCreateModal(true) }}
                className="touch-target min-h-[44px] px-5 py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors active:scale-[0.98]"
                style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
              >
                Додати до прайсу
              </button>
            </div>
          ) : filteredServices.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  onClick={() => toggleService(service)}
                  className={cn(
                    "group relative rounded-xl p-3 cursor-pointer transition-all duration-150 hover:bg-white/[0.08] active:scale-[0.98] touch-manipulation min-h-[88px] flex flex-col justify-center card-glass",
                    isSelected(service.id)
                      ? "bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-500/50"
                      : "hover:bg-white/10"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate text-white group-hover:text-blue-200 transition-colors">
                        {service.name}
                      </h3>
                      {service.category && (
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-gray-400 truncate max-w-full">
                          {service.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleEditService(service) }}
                        className="touch-target min-h-[44px] min-w-[44px] p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
                        aria-label="Редагувати"
                      >
                        <EditIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleDeleteService(service) }}
                        className="touch-target min-h-[44px] min-w-[44px] p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center"
                        aria-label="Видалити"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                      <div className={cn(
                        "w-5 h-5 rounded flex items-center justify-center transition-colors ml-0.5",
                        isSelected(service.id) ? "bg-blue-500 text-white" : "bg-white/10 text-gray-500"
                      )}>
                        {isSelected(service.id) ? <CheckSquareIcon className="w-3 h-3" /> : <SquareIcon className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-gray-400">{service.duration} хв</span>
                    <span className="font-bold text-white">{Math.round(service.price)} ₴</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl p-8 card-glass text-center">
              <FilterIcon className="w-12 h-12 mx-auto text-gray-500/60 mb-3" />
              <p className="text-gray-400 text-sm">За пошуком нічого не знайдено. Змініть фільтри або додайте нову послугу.</p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSelectedCategory(null) }}
                className="mt-3 px-4 py-2 rounded-lg border border-white/20 bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-colors"
              >
                Скинути фільтри
              </button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-3 md:space-y-4">
          {/* Калькулятор послуг */}
          <div className="rounded-xl p-4 card-glass">
            <h3 className="text-sm font-semibold text-white mb-3">Калькулятор послуг</h3>
            {selectedServices.length === 0 ? (
              <p className="text-gray-400 text-sm">
                Оберіть послуги зліва — тут зʼявиться сума та тривалість.
              </p>
            ) : (
              <>
                <ul className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-hide mb-3">
                  {selectedServices.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-white truncate flex-1 min-w-0" title={s.name}>{s.name}</span>
                      <span className="text-gray-400 flex-shrink-0">{s.duration} хв</span>
                      <span className="font-medium text-white flex-shrink-0 w-14 text-right">{Math.round(s.price)} ₴</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-3 border-t border-white/10 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-400">
                    <span>Тривалість</span>
                    <span className="text-white font-medium">
                      {Math.floor(totalDuration / 60) > 0 ? `${Math.floor(totalDuration / 60)} год ` : ''}{totalDuration % 60} хв
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-gray-400">Разом</span>
                    <span className="text-xl font-bold text-white">{Math.round(totalPrice)} ₴</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedServices([])}
                  className="mt-3 w-full px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm font-medium transition-colors"
                >
                  Скинути вибір
                </button>
              </>
            )}
          </div>

          <div className="rounded-xl p-4 card-glass">
            <h3 className="text-sm font-semibold text-white mb-3">Статистика</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Позицій у прайсі</span>
                <span className="font-semibold text-white">{stats.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Категорій</span>
                <span className="font-semibold text-white">{stats.categories}</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl p-4 card-glass">
            <h3 className="text-sm font-semibold text-white mb-3">Швидкі дії</h3>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => { setCreateForm({ name: '', price: '', duration: '', category: '' }); setShowCreateModal(true) }}
                className="touch-target w-full min-h-[44px] px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/15 transition-colors text-left"
              >
                Додати послугу
              </button>
              <Link
                href="/dashboard/appointments"
                className="touch-target min-h-[44px] px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/15 transition-colors flex items-center gap-2"
              >
                <CalendarIcon className="w-4 h-4 flex-shrink-0" />
                Записи
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

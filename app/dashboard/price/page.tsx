'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { SearchIcon, FilterIcon, CheckSquareIcon, SquareIcon, ChevronDownIcon } from '@/components/icons'
import { ModalPortal } from '@/components/ui/modal-portal'
import { toast } from '@/components/ui/toast'

interface Service {
  id: string
  name: string
  price: number
  duration: number
  category?: string
  description?: string
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


  return (
    <div className="p-4 md:p-8 min-h-screen text-white pb-[max(6rem,calc(5rem+env(safe-area-inset-bottom)))] md:pb-24">
      {/* Header — мобільний: компактний, кнопка на першому плані */}
      <div className="flex flex-col gap-4 mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              Прайс-лист
            </h1>
            <p className="text-gray-400 mt-0.5 text-sm">Оберіть послуги для розрахунку вартості</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-gray-100 transition-colors shadow-lg touch-manipulation min-h-[48px] w-full sm:w-auto"
          >
            <span className="text-lg leading-none">+</span>
            Додати до прайсу
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-9 pr-3 py-2.5 sm:py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all min-h-[44px] sm:min-h-0"
              placeholder="Пошук послуг..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {/* Sort */}
          <div className="relative min-w-0 sm:w-44">
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={e => {
                const [s, o] = (e.target.value || 'name-asc').split('-') as [typeof sortBy, typeof sortOrder]
                setSortBy(s)
                setSortOrder(o)
              }}
              className="appearance-none pl-3 pr-8 py-2.5 sm:py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent cursor-pointer w-full min-h-[44px] sm:min-h-0"
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
      {showCreateModal && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => !isSubmitting && setShowCreateModal(false)}>
            <div
              className="relative w-[95%] sm:w-full sm:max-w-md sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0"
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => !isSubmitting && setShowCreateModal(false)}
                className="modal-close text-gray-400 hover:text-white rounded-xl"
                aria-label="Закрити"
              >
                <span className="text-xl leading-none">×</span>
              </button>
              <div className="pr-10 flex-1 min-h-0 overflow-y-auto">
                <h2 className="modal-title text-white mb-2">Додати до прайсу</h2>
                <form onSubmit={handleCreateService} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Назва послуги *</label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Наприклад: Стрижка чоловіча"
                      required
                      className="w-full px-4 py-2.5 rounded-lg border border-white/20 bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Ціна (₴) *</label>
                      <input
                        type="number"
                        min="0"
                        value={createForm.price}
                        onChange={e => setCreateForm(f => ({ ...f, price: e.target.value }))}
                        placeholder="100"
                        required
                        className="w-full px-4 py-2.5 rounded-lg border border-white/20 bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">Тривалість (хв) *</label>
                      <input
                        type="number"
                        min="1"
                        value={createForm.duration}
                        onChange={e => setCreateForm(f => ({ ...f, duration: e.target.value }))}
                        placeholder="30"
                        required
                        className="w-full px-4 py-2.5 rounded-lg border border-white/20 bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Категорія (опціонально)</label>
                    <input
                      type="text"
                      value={createForm.category}
                      onChange={e => setCreateForm(f => ({ ...f, category: e.target.value }))}
                      placeholder="Наприклад: Стрижка, Манікюр"
                      className="w-full px-4 py-2.5 rounded-lg border border-white/20 bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                    {categories.length > 0 && (
                      <select
                        onChange={e => e.target.value && setCreateForm(f => ({ ...f, category: e.target.value }))}
                        className="mt-1.5 w-full px-3 py-2 rounded-lg border border-white/20 bg-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      >
                        <option value="">Або виберіть існуючу категорію</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => !isSubmitting && setShowCreateModal(false)}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-white/20 bg-white/10 text-white font-medium hover:bg-white/15 transition-colors"
                    >
                      Скасувати
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-white text-black font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      {isSubmitting ? 'Збереження...' : 'Додати'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              !selectedCategory
                ? "bg-white text-black"
                : "bg-white/5 text-gray-300 hover:bg-white/10"
            )}
          >
            Всі
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                selectedCategory === cat
                  ? "bg-white text-black"
                  : "bg-white/5 text-gray-300 hover:bg-white/10"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Services List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      ) : filteredServices.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              onClick={() => toggleService(service)}
              className={cn(
                "group relative rounded-xl p-3 cursor-pointer transition-all duration-150 hover:bg-white/[0.08] active:scale-[0.98] touch-manipulation min-h-[72px] flex flex-col justify-center",
                isSelected(service.id)
                  ? "bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-500/50"
                  : "card-glass hover:bg-white/10"
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
                <div className={cn(
                  "w-5 h-5 rounded flex-shrink-0 flex items-center justify-center transition-colors",
                  isSelected(service.id) ? "bg-blue-500 text-white" : "bg-white/10 text-gray-500"
                )}>
                  {isSelected(service.id) ? <CheckSquareIcon className="w-3 h-3" /> : <SquareIcon className="w-3 h-3" />}
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
        <div className="text-center py-12 text-gray-500">
          <FilterIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Послуг не знайдено</p>
        </div>
      )}

      {/* Floating Bottom Bar — safe-area для мобільних */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 md:left-64 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] md:pl-4 transition-transform duration-300 z-30",
        selectedServices.length > 0 ? "translate-y-0" : "translate-y-full"
      )}>
        <div
          className="max-w-4xl mx-auto rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xl shadow-black/50"
          style={{
            backgroundColor: 'rgba(20, 20, 20, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div className="flex flex-col">
            <span className="text-sm text-gray-400">
              Обрано: {selectedServices.length} {selectedServices.length === 1 ? 'послуга' : selectedServices.length < 5 ? 'послуги' : 'послуг'}
            </span>
            <span className="text-xs text-gray-500">
              ~ {Math.floor(totalDuration / 60) > 0 ? `${Math.floor(totalDuration / 60)} год ` : ''}{totalDuration % 60} хв
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-400">Загальна вартість</div>
              <div className="text-2xl font-bold text-white leading-none">{Math.round(totalPrice)} ₴</div>
            </div>
            <button
              onClick={() => setSelectedServices([])}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
            >
              Скинути
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

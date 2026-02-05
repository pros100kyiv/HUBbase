'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchIcon, MoneyIcon, FilterIcon, CheckSquareIcon, SquareIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

interface Service {
  id: string
  name: string
  price: number
  duration: number
  category?: string
  description?: string
}

export default function PricePage() {
  const [business, setBusiness] = useState<any>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedServices, setSelectedServices] = useState<Service[]>([])

  useEffect(() => {
    const businessData = localStorage.getItem('business')
    if (businessData) {
      try {
        const parsed = JSON.parse(businessData)
        setBusiness(parsed)
      } catch (e) {
        console.error('Failed to parse business data', e)
      }
    }
  }, [])

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
  const filteredServices = services.filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (service.category && service.category.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesCategory = selectedCategory ? service.category === selectedCategory : true
    return matchesSearch && matchesCategory
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

  // Style constants
  const cardStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  }

  return (
    <div className="p-4 md:p-8 pb-24 min-h-screen text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Прайс-лист
          </h1>
          <p className="text-gray-400 mt-1">Оберіть послуги для розрахунку вартості</p>
        </div>
        
        {/* Search & Filter */}
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <SearchIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
              placeholder="Пошук послуг..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              onClick={() => toggleService(service)}
              className={cn(
                "group relative rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-1",
                isSelected(service.id) 
                  ? "bg-gradient-to-br from-blue-500/20 to-purple-600/20 border-blue-500/50" 
                  : "hover:bg-white/10"
              )}
              style={isSelected(service.id) ? { border: '1px solid rgba(59, 130, 246, 0.5)' } : cardStyle}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg truncate text-white group-hover:text-blue-200 transition-colors">
                      {service.name}
                    </h3>
                  </div>
                  {service.category && (
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-gray-400 mb-2">
                      {service.category}
                    </span>
                  )}
                  {service.description && (
                    <p className="text-sm text-gray-400 line-clamp-2">{service.description}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className={cn(
                    "w-6 h-6 rounded-md flex items-center justify-center transition-colors",
                    isSelected(service.id) ? "bg-blue-500 text-white" : "bg-white/10 text-gray-500"
                  )}>
                    {isSelected(service.id) ? <CheckSquareIcon className="w-4 h-4" /> : <SquareIcon className="w-4 h-4" />}
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/5">
                <div className="text-sm text-gray-400">
                  {service.duration} хв
                </div>
                <div className="text-lg font-bold text-white">
                  {service.price} ₴
                </div>
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

      {/* Floating Bottom Bar */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 md:left-64 p-4 transition-transform duration-300 z-30",
        selectedServices.length > 0 ? "translate-y-0" : "translate-y-full"
      )}>
        <div 
          className="max-w-4xl mx-auto rounded-2xl p-4 flex items-center justify-between shadow-2xl shadow-black/50"
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
              <div className="text-2xl font-bold text-white leading-none">{totalPrice} ₴</div>
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

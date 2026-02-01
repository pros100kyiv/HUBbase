'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClockIcon, SearchIcon, SortIcon, FolderIcon, PlusIcon, XIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Service {
  id: string
  name: string
  price: number
  duration: number
  category?: string
  subcategory?: string
  description?: string
  createdAt?: string
}

type SortOption = 'name' | 'price' | 'duration' | 'date' | 'category'
type SortDirection = 'asc' | 'desc'

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

export default function ServicesPage() {
  const router = useRouter()
  const [business, setBusiness] = useState<any>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newSubcategoryName, setNewSubcategoryName] = useState('')
  const [parentCategoryForSub, setParentCategoryForSub] = useState<string>('')

  useEffect(() => {
    const businessData = localStorage.getItem('business')
    if (!businessData) {
      router.push('/login')
      return
    }
    try {
      const parsed = JSON.parse(businessData)
      setBusiness(parsed)
    } catch {
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    if (!business) return

    fetch(`/api/services?businessId=${business.id}`)
      .then((res) => res.json())
      .then((data) => {
        setServices(data)
        setLoading(false)
      })
  }, [business])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (!business || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-gray-500">Завантаження...</p>
      </div>
    )
  }

  // Filter services
  const filteredServices = services.filter(service => {
    const matchesSearch = searchQuery === '' || 
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.category?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = !selectedCategory || 
      service.category === selectedCategory ||
      (service.category === null && selectedCategory === 'Інші')
    
    return matchesSearch && matchesCategory
  })

  // Sort services
  const sortedServices = [...filteredServices].sort((a, b) => {
    let comparison = 0
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name, 'uk')
        break
      case 'price':
        comparison = a.price - b.price
        break
      case 'duration':
        comparison = a.duration - b.duration
        break
      case 'date':
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        comparison = dateA - dateB
        break
      case 'category':
        const catA = a.category || 'Інші'
        const catB = b.category || 'Інші'
        comparison = catA.localeCompare(catB, 'uk')
        if (comparison === 0) {
          const subA = a.subcategory || ''
          const subB = b.subcategory || ''
          comparison = subA.localeCompare(subB, 'uk')
        }
        break
    }
    
    return sortDirection === 'asc' ? comparison : -comparison
  })

  // Group services by category and subcategory
  const groupedServices = sortedServices.reduce((acc, service) => {
    const category = service.category || 'Інші'
    const subcategory = service.subcategory || null
    const key = subcategory ? `${category} > ${subcategory}` : category
    
    if (!acc[key]) {
      acc[key] = {
        category,
        subcategory,
        services: []
      }
    }
    acc[key].services.push(service)
    return acc
  }, {} as Record<string, { category: string; subcategory: string | null; services: Service[] }>)

  // Get unique categories
  const categories = Array.from(new Set(services.map(s => s.category || 'Інші').filter(Boolean)))

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !business) return
    
    // Category is stored in service.category field
    // For now, we'll just show a message that user needs to create a service with this category
    setShowCategoryForm(false)
    setNewCategoryName('')
    alert(`Категорія "${newCategoryName}" буде створена при додаванні першої послуги з цією категорією. Перейдіть до налаштувань, щоб додати послугу.`)
    router.push(`/dashboard/settings?tab=services&category=${encodeURIComponent(newCategoryName)}`)
  }

  const toggleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(option)
      setSortDirection('asc')
    }
  }


  return (
    <div className="min-h-screen bg-background">
      <div className="p-3">
        <div className="max-w-7xl mx-auto">
          <div className="spacing-item">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
              <div>
                <h1 className="text-heading">Послуги</h1>
                <p className="text-caption font-medium">Управління послугами</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCategoryForm(true)}
                  className="btn-secondary whitespace-nowrap text-xs px-2 py-1.5 h-auto"
                  title="Створити категорію"
                >
                  <FolderIcon className="w-3 h-3 mr-1" />
                  Категорія
                </button>
                <button
                  onClick={() => router.push('/dashboard/settings?tab=services')}
                  className="btn-primary whitespace-nowrap"
                >
                  + Додати послугу
                </button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="flex-1 relative">
                <SearchIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Пошук послуг..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>
              
              {/* Category Filter */}
              <select
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
                className="px-3 py-2 rounded-candy border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              >
                <option value="">Всі категорії</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Sort Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {}}
                  className="px-3 py-2 rounded-candy border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white flex items-center gap-1.5 whitespace-nowrap"
                >
                  <SortIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {sortBy === 'name' && 'Назва'}
                    {sortBy === 'price' && 'Ціна'}
                    {sortBy === 'duration' && 'Тривалість'}
                    {sortBy === 'date' && 'Дата'}
                    {sortBy === 'category' && 'Категорія'}
                    {sortDirection === 'asc' ? ' ↑' : ' ↓'}
                  </span>
                </button>
                <div className="absolute right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-candy shadow-lg z-10 min-w-[150px]">
                  {(['name', 'price', 'duration', 'date', 'category'] as SortOption[]).map(option => (
                    <button
                      key={option}
                      onClick={() => toggleSort(option)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700",
                        sortBy === option && "bg-blue-50 dark:bg-blue-900/20"
                      )}
                    >
                      {option === 'name' && 'Назва'}
                      {option === 'price' && 'Ціна'}
                      {option === 'duration' && 'Тривалість'}
                      {option === 'date' && 'Дата'}
                      {option === 'category' && 'Категорія'}
                      {sortBy === option && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Category Creation Modal */}
          {showCategoryForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-candy-lg shadow-soft-xl w-full max-w-md p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-foreground dark:text-white">Створити категорію</h3>
                  <button
                    onClick={() => {
                      setShowCategoryForm(false)
                      setNewCategoryName('')
                      setNewSubcategoryName('')
                      setParentCategoryForSub('')
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <XIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">
                      Назва категорії
                    </label>
                    <Input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Наприклад: Стрижка"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCreateCategory}
                      disabled={!newCategoryName.trim()}
                      className="flex-1"
                    >
                      Створити
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCategoryForm(false)
                        setNewCategoryName('')
                      }}
                      className="flex-1"
                    >
                      Скасувати
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {Object.entries(groupedServices).map(([key, group], categoryIndex) => {
              const categoryColor = getCategoryColor(categoryIndex)
              const displayName = group.subcategory 
                ? `${group.category} > ${group.subcategory}`
                : group.category
              
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn('w-1 h-6 rounded-full', categoryColor.bg)} />
                    <FolderIcon className={cn('w-4 h-4', categoryColor.text)} />
                    <h2 className="text-sm md:text-base font-black text-foreground">{displayName}</h2>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      ({group.services.length})
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {group.services.map((service, serviceIndex) => {
                      const serviceColorIndex = (categoryIndex + serviceIndex) % 5
                      const serviceColor = getCategoryColor(serviceColorIndex)
                      
                      return (
                        <div
                          key={service.id}
                          className={cn(
                            'group relative card-candy card-candy-hover',
                            'overflow-hidden cursor-pointer'
                          )}
                          onClick={() => router.push(`/dashboard/settings?tab=services&service=${service.id}`)}
                        >
                          {/* Colored accent bar */}
                          <div className={cn('h-1 w-full', serviceColor.bg)} />
                          
                          <div className="p-3">
                            {/* Header with icon */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-black text-foreground mb-1 truncate group-hover:text-candy-purple transition-colors">
                                  {service.name}
                                </h3>
                                {service.description && (
                                  <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                    {service.description}
                                  </p>
                                )}
                              </div>
                              <div className={cn(
                                'w-8 h-8 rounded-candy-xs flex items-center justify-center flex-shrink-0 text-white shadow-soft-lg',
                                serviceColor.bg
                              )}>
                                <span className="text-xs font-black">
                                  {service.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            </div>

                            {/* Price and duration */}
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                              <div className="flex-1 min-w-0">
                                <div className={cn('text-base font-black mb-0.5', serviceColor.text)}>
                                  {formatCurrency(service.price)}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                                  <ClockIcon className="w-3 h-3" />
                                  <span className="font-medium">{service.duration} хв</span>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  router.push(`/dashboard/settings?tab=services&service=${service.id}`)
                                }}
                                className={cn(
                                  'px-2 py-1 rounded-candy-xs text-[10px] font-bold',
                                  'border-2 transition-all active:scale-95',
                                  serviceColor.border,
                                  serviceColor.text,
                                  'hover:text-white'
                                )}
                                style={{
                                  backgroundColor: 'transparent',
                                }}
                                onMouseEnter={(e) => {
                                  const bgColor = serviceColor.bg.includes('purple') ? '#3B82F6' :
                                    serviceColor.bg.includes('blue') ? '#3B82F6' :
                                    serviceColor.bg.includes('mint') ? '#10B981' :
                                    serviceColor.bg.includes('pink') ? '#EC4899' :
                                    serviceColor.bg.includes('orange') ? '#F59E0B' : '#3B82F6'
                                  e.currentTarget.style.backgroundColor = bgColor
                                  e.currentTarget.style.color = 'white'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                  e.currentTarget.style.color = ''
                                }}
                              >
                                Редагувати
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {services.length === 0 && (
              <div className="card-candy rounded-candy-sm shadow-soft-lg p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full candy-purple/10 dark:candy-purple/20 flex items-center justify-center">
                  <span className="text-2xl">✨</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 font-medium">Немає послуг</p>
                <button
                  onClick={() => router.push('/dashboard/settings?tab=services')}
                  className="px-4 py-2 text-sm font-bold candy-purple text-white rounded-candy-sm shadow-soft-lg hover:shadow-soft-xl transition-all active:scale-97"
                >
                  Додати першу послугу
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}




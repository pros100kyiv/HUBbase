'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClockIcon, ChevronDownIcon, ChevronUpIcon, CalculatorIcon, XIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

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

export default function PricelistPage() {
  const router = useRouter()
  const [business, setBusiness] = useState<any>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set())
  const [showCalculator, setShowCalculator] = useState(false)

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
        setServices(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => {
        setServices([])
        setLoading(false)
      })
  }, [business])

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

  // Group services by category first, then by subcategory
  const categoryGroups = services.reduce((acc, service) => {
    let category = service.category || 'Інші'
    let subcategory = service.subcategory || null
    
    // Check if category contains ">" (subcategory format)
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

  // Categories are collapsed by default - no auto-expand

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

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => {
      const newSet = new Set(prev)
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId)
      } else {
        newSet.add(serviceId)
      }
      return newSet
    })
  }

  // Calculate total for selected services
  const selectedServicesData = Array.from(selectedServices)
    .map(id => services.find(s => s.id === id))
    .filter(Boolean) as Service[]

  const totalPrice = selectedServicesData.reduce((sum, s) => sum + s.price, 0)
  const totalDuration = selectedServicesData.reduce((sum, s) => sum + s.duration, 0)

  if (!business || loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-3">
          <div className="max-w-7xl mx-auto">
            <Skeleton className="h-8 w-48 mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-3">
        <div className="max-w-7xl mx-auto">
          <div className="spacing-item mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h1 className="text-heading">Прайс-лист</h1>
                <p className="text-caption font-medium">Список послуг та їх вартість</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => setShowCalculator(true)}
                  className={cn(
                    "btn-primary text-xs sm:text-sm whitespace-nowrap",
                    selectedServices.size > 0 && "relative"
                  )}
                >
                  <CalculatorIcon className="w-4 h-4 mr-1 sm:mr-2" />
                  Калькулятор
                  {selectedServices.size > 0 && (
                    <span className="ml-1 sm:ml-2 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold">
                      {selectedServices.size}
                    </span>
                  )}
                </Button>
                {selectedServices.size > 0 && (
                  <Button
                    onClick={() => {
                      setSelectedServices(new Set())
                      setShowCalculator(false)
                    }}
                    variant="outline"
                    className="text-xs whitespace-nowrap"
                  >
                    Очистити
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Calculator Modal */}
          {showCalculator && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4">
              <div className="bg-white dark:bg-gray-800 rounded-candy-lg shadow-soft-xl w-full max-w-md p-3 sm:p-4 max-h-[90vh] overflow-y-auto mx-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-black text-foreground dark:text-white flex items-center gap-2">
                    <CalculatorIcon className="w-5 h-5" />
                    Калькулятор послуг
                  </h3>
                  <button
                    onClick={() => setShowCalculator(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <XIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  {selectedServices.size > 0 ? (
                    <>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {selectedServicesData.map(service => (
                          <div
                            key={service.id}
                            className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-candy-sm"
                          >
                            <div className="flex-1">
                              <p className="text-sm font-bold text-foreground dark:text-white">
                                {service.name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatDuration(service.duration)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-blue-500">
                                {formatCurrency(service.price)}
                              </p>
                            </div>
                            <button
                              onClick={() => toggleService(service.id)}
                              className="ml-2 text-red-500 hover:text-red-600"
                            >
                              <XIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Загальна тривалість:
                          </span>
                          <span className="text-sm font-black text-foreground dark:text-white">
                            {formatDuration(totalDuration)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-base font-bold text-foreground dark:text-white">
                            Загальна сума:
                          </span>
                          <span className="text-xl font-black text-blue-500">
                            {formatCurrency(totalPrice)}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <CalculatorIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Виберіть послуги з прайс-листу
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        Натисніть на послугу, щоб додати її до калькулятора
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {Object.entries(categoryGroups).map(([category, subcategories], categoryIndex) => {
              const categoryColor = getCategoryColor(categoryIndex)
              const isExpanded = expandedCategories.has(category)
              const totalServicesInCategory = Object.values(subcategories).reduce(
                (sum, sub) => sum + sub.services.length, 0
              )
              
              return (
                <div key={category} className="card-candy overflow-hidden">
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
                          {subGroup.services.map((service, serviceIndex) => {
                            const isSelected = selectedServices.has(service.id)
                            return (
                              <div
                                key={service.id}
                                className={cn(
                                  'p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer',
                                  isSelected && 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                                )}
                                onClick={() => toggleService(service.id)}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h3 className="text-sm md:text-base font-black text-foreground dark:text-white">
                                        {service.name}
                                      </h3>
                                      {isSelected && (
                                        <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                                          ✓
                                        </span>
                                      )}
                                    </div>
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
                                  <div className="text-right flex-shrink-0">
                                    <div className={cn('text-lg md:text-xl font-black mb-1', categoryColor.text)}>
                                      {formatCurrency(service.price)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {services.length === 0 && (
              <div className="card-candy rounded-candy-sm shadow-soft-lg p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <span className="text-2xl">📋</span>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 font-medium">
                  Немає послуг у прайс-листі
                </p>
                <button
                  onClick={() => router.push('/dashboard/settings?tab=services')}
                  className="px-4 py-2 text-sm font-bold bg-blue-500 text-white rounded-candy-sm shadow-soft-lg hover:shadow-soft-xl transition-all active:scale-97"
                >
                  Додати послугу
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


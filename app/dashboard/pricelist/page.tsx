'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClockIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

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
    }).format(amount)
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

  // Group services by category and subcategory
  const groupedServices = services.reduce((acc, service) => {
    let category = service.category || 'Інші'
    let subcategory = service.subcategory || null
    
    // Check if category contains ">" (subcategory format)
    if (category.includes(' > ')) {
      const parts = category.split(' > ')
      category = parts[0]
      subcategory = parts[1] || null
    }
    
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
            <h1 className="text-heading">Прайс-лист</h1>
            <p className="text-caption font-medium">Список послуг та їх вартість</p>
          </div>

          <div className="space-y-4">
            {Object.entries(groupedServices).map(([key, group], categoryIndex) => {
              const categoryColor = getCategoryColor(categoryIndex)
              const displayName = group.subcategory 
                ? `${group.category} > ${group.subcategory}`
                : group.category
              
              return (
                <div key={key} className="card-candy overflow-hidden">
                  {/* Category Header */}
                  <div className={cn('p-3 border-b-2', categoryColor.border)}>
                    <div className="flex items-center gap-2">
                      <div className={cn('w-1 h-6 rounded-full', categoryColor.bg)} />
                      <h2 className="text-base md:text-lg font-black text-foreground dark:text-white">
                        {displayName}
                      </h2>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        ({group.services.length})
                      </span>
                    </div>
                  </div>

                  {/* Services List */}
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {group.services.map((service, serviceIndex) => (
                      <div
                        key={service.id}
                        className={cn(
                          'p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
                          serviceIndex === 0 && 'border-t-0'
                        )}
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
                          <div className="text-right flex-shrink-0">
                            <div className={cn('text-lg md:text-xl font-black mb-1', categoryColor.text)}>
                              {formatCurrency(service.price)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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


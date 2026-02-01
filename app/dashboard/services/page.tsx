'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClockIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

interface Service {
  id: string
  name: string
  price: number
  duration: number
  category?: string
  description?: string
}

const getCategoryColor = (index: number) => {
  const colors = [
    { bg: 'bg-candy-purple', text: 'text-candy-purple', border: 'border-candy-purple' },
    { bg: 'bg-candy-blue', text: 'text-candy-blue', border: 'border-candy-blue' },
    { bg: 'bg-candy-mint', text: 'text-candy-mint', border: 'border-candy-mint' },
    { bg: 'bg-candy-pink', text: 'text-candy-pink', border: 'border-candy-pink' },
    { bg: 'bg-candy-orange', text: 'text-candy-orange', border: 'border-candy-orange' },
  ]
  return colors[index % colors.length]
}

export default function ServicesPage() {
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

  const groupedServices = services.reduce((acc, service) => {
    const category = service.category || 'Інші'
    if (!acc[category]) acc[category] = []
    acc[category].push(service)
    return acc
  }, {} as Record<string, Service[]>)


  return (
    <div className="min-h-screen bg-background">
      <div className="p-3">
        <div className="max-w-7xl mx-auto">
                 <div className="flex items-center justify-between spacing-item">
                   <h1 className="text-heading">Послуги</h1>
                   <button
                     onClick={() => router.push('/dashboard/settings?tab=services')}
                     className="btn-primary whitespace-nowrap"
                   >
                     + Додати послугу
                   </button>
                 </div>

          <div className="space-y-3">
            {Object.entries(groupedServices).map(([category, categoryServices], categoryIndex) => {
              const categoryColor = getCategoryColor(categoryIndex)
              
              return (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn('w-1 h-6 rounded-full', categoryColor.bg)} />
                    <h2 className="text-sm md:text-base font-black text-foreground">{category}</h2>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      ({categoryServices.length})
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {categoryServices.map((service, serviceIndex) => {
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
                                  const bgColor = serviceColor.bg.includes('purple') ? '#8B5CF6' :
                                    serviceColor.bg.includes('blue') ? '#3B82F6' :
                                    serviceColor.bg.includes('mint') ? '#10B981' :
                                    serviceColor.bg.includes('pink') ? '#EC4899' :
                                    serviceColor.bg.includes('orange') ? '#F59E0B' : '#8B5CF6'
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




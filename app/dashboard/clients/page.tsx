'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, isAfter } from 'date-fns'
import { cn } from '@/lib/utils'
import { ChevronDownIcon, ChevronUpIcon, UsersIcon, SearchIcon } from '@/components/icons'

interface Client {
  phone: string
  name: string
  appointmentsCount: number
  lastVisit: string
  totalSpent: number
  appointments: any[]
  servicesUsed: string[]
  nextAppointment?: string
}

interface ClientDetails {
  totalSpent: number
  lastVisit: string
  nextAppointment?: string
  servicesUsed: Array<{ id: string; name: string; count: number }>
}

export default function ClientsPage() {
  const router = useRouter()
  const [business, setBusiness] = useState<any>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [services, setServices] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [clientDetails, setClientDetails] = useState<Record<string, ClientDetails>>({})

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

    Promise.all([
      fetch(`/api/services?businessId=${business.id}`)
        .then((res) => res.json())
        .then((data) => setServices(data || [])),
      fetch(`/api/appointments?businessId=${business.id}`)
        .then((res) => res.json())
        .then((appointments) => {
          const clientsMap = new Map<string, Client>()

          appointments.forEach((apt: any) => {
            const existing = clientsMap.get(apt.clientPhone) || {
              phone: apt.clientPhone,
              name: apt.clientName,
              appointmentsCount: 0,
              lastVisit: apt.startTime,
              totalSpent: 0,
              appointments: [] as any[],
              servicesUsed: [] as string[],
            }

            existing.appointmentsCount++
            existing.appointments.push(apt)
            
            if (new Date(apt.startTime) > new Date(existing.lastVisit)) {
              existing.lastVisit = apt.startTime
            }

            try {
              if (apt.services) {
                const aptServices = JSON.parse(apt.services)
                existing.servicesUsed.push(...aptServices)
              }
            } catch (e) {
              // Ignore
            }

            clientsMap.set(apt.clientPhone, existing)
          })

          const clientsArray = Array.from(clientsMap.values()).map((client) => {
            const now = new Date()
            const futureAppointments = client.appointments
              .filter((apt: any) => isAfter(new Date(apt.startTime), now) && apt.status !== 'Cancelled')
              .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
            
            return {
              ...client,
              nextAppointment: futureAppointments.length > 0 ? futureAppointments[0].startTime : undefined,
            }
          })

          setClients(clientsArray)
          setLoading(false)
        })
    ]).catch((error) => {
      console.error('Error loading data:', error)
      setLoading(false)
    })
  }, [business])

  const calculateClientDetails = (client: Client): ClientDetails => {
    const serviceMap = new Map<string, { id: string; name: string; count: number }>()
    let totalSpent = 0

    client.appointments.forEach((apt: any) => {
      try {
        if (apt.services) {
          const aptServices = JSON.parse(apt.services)
          aptServices.forEach((serviceId: string) => {
            const service = services.find((s) => s.id === serviceId)
            if (service) {
              totalSpent += service.price
              const existing = serviceMap.get(serviceId) || { id: serviceId, name: service.name, count: 0 }
              existing.count++
              serviceMap.set(serviceId, existing)
            }
          })
        }
      } catch (e) {
        // Ignore
      }
    })

    return {
      totalSpent,
      lastVisit: client.lastVisit,
      nextAppointment: client.nextAppointment,
      servicesUsed: Array.from(serviceMap.values()),
    }
  }

  const handleClientClick = (client: Client) => {
    if (expandedClient === client.phone) {
      setExpandedClient(null)
    } else {
      setExpandedClient(client.phone)
      if (!clientDetails[client.phone]) {
        const details = calculateClientDetails(client)
        setClientDetails((prev) => ({ ...prev, [client.phone]: details }))
      }
    }
  }

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.phone.includes(searchQuery)
  )

  if (!business || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-gray-500">Завантаження...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-2">
              Клієнти
            </h1>
            <p className="text-base text-gray-600 dark:text-gray-400">
              Управління базою клієнтів та їх історією
            </p>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Всього: <span className="font-black text-candy-purple text-lg">{clients.length}</span>
          </div>
        </div>

        {/* Search */}
        <div className="card-candy p-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Пошук за ім'ям або телефоном..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-candy-sm border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-candy-purple focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Clients List */}
      {filteredClients.length === 0 ? (
        <div className="card-candy p-12 text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-32 h-32 bg-gradient-to-br from-candy-purple/20 to-candy-blue/20 rounded-full flex items-center justify-center">
              <UsersIcon className="w-16 h-16 text-candy-purple" />
            </div>
          </div>
          <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">
            {searchQuery ? "Клієнтів не знайдено" : "Немає клієнтів"}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchQuery ? "Спробуйте інший пошуковий запит" : `Клієнти з'являться після перших записів`}
          </p>
          {!searchQuery && (
            <button
              onClick={() => router.push('/dashboard/appointments')}
              className="px-6 py-3 bg-gradient-to-r from-candy-purple to-candy-blue text-white font-bold rounded-candy-sm shadow-soft-xl hover:shadow-soft-2xl transition-all active:scale-95"
            >
              Створити перший запис
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredClients.map((client) => {
            const isExpanded = expandedClient === client.phone
            const details = clientDetails[client.phone]

            return (
              <div
                key={client.phone}
                className={cn(
                  "card-candy overflow-hidden transition-all",
                  isExpanded && "shadow-soft-2xl"
                )}
              >
                <button
                  onClick={() => handleClientClick(client)}
                  className="w-full p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-candy-purple to-candy-blue flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-black text-gray-900 dark:text-white truncate mb-1">
                          {client.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {client.phone}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-center">
                        <div className="text-xl font-black text-candy-purple">
                          {client.appointmentsCount}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Візитів</div>
                      </div>
                      {isExpanded ? (
                        <ChevronUpIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-gray-200 dark:border-gray-700">
                    {details ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div className="p-4 bg-gradient-to-br from-candy-purple/10 to-candy-purple/5 rounded-candy-sm border border-candy-purple/20">
                          <div className="text-sm text-gray-600 dark:text-gray-400 font-bold mb-2">Зароблено</div>
                          <div className="text-2xl font-black text-candy-purple">
                            {new Intl.NumberFormat('uk-UA', {
                              style: 'currency',
                              currency: 'UAH',
                              minimumFractionDigits: 0,
                            }).format(details.totalSpent)}
                          </div>
                        </div>

                        <div className="p-4 bg-gradient-to-br from-candy-blue/10 to-candy-blue/5 rounded-candy-sm border border-candy-blue/20">
                          <div className="text-sm text-gray-600 dark:text-gray-400 font-bold mb-2">Останній візит</div>
                          <div className="text-lg font-black text-candy-blue">
                            {format(new Date(details.lastVisit), 'dd.MM.yyyy HH:mm')}
                          </div>
                        </div>

                        {details.nextAppointment ? (
                          <div className="p-4 bg-gradient-to-br from-candy-mint/10 to-candy-mint/5 rounded-candy-sm border border-candy-mint/20">
                            <div className="text-sm text-gray-600 dark:text-gray-400 font-bold mb-2">Наступний візит</div>
                            <div className="text-lg font-black text-candy-mint">
                              {format(new Date(details.nextAppointment), 'dd.MM.yyyy HH:mm')}
                            </div>
                            <div className="text-xs text-candy-mint/70 mt-1">Заплановано</div>
                          </div>
                        ) : (
                          <div className="p-4 bg-gradient-to-br from-candy-orange/10 to-candy-orange/5 rounded-candy-sm border border-candy-orange/20">
                            <div className="text-sm text-gray-600 dark:text-gray-400 font-bold mb-2">Наступний візит</div>
                            <div className="text-lg font-black text-candy-orange">Ще не записався</div>
                            <div className="text-xs text-candy-orange/70 mt-1">Для розсилки</div>
                          </div>
                        )}

                        <div className="p-4 bg-gradient-to-br from-candy-pink/10 to-candy-pink/5 rounded-candy-sm border border-candy-pink/20 md:col-span-2">
                          <div className="text-sm text-gray-600 dark:text-gray-400 font-bold mb-3">Послуги</div>
                          {details.servicesUsed.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {details.servicesUsed.map((service, idx) => (
                                <span
                                  key={idx}
                                  className="px-3 py-1.5 text-sm font-bold rounded-full bg-white dark:bg-gray-800 text-candy-pink border border-candy-pink/30"
                                >
                                  {service.name} ({service.count})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-gray-500 dark:text-gray-400">Немає інформації</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Завантаження деталей...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}




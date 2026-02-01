'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, isAfter } from 'date-fns'
import { cn } from '@/lib/utils'
import { ChevronDownIcon, ChevronUpIcon } from '@/components/icons'

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

    // Load services and appointments in parallel
    Promise.all([
      fetch(`/api/services?businessId=${business.id}`)
        .then((res) => res.json())
        .then((data) => setServices(data || [])),
      fetch(`/api/appointments?businessId=${business.id}`)
        .then((res) => res.json())
        .then((appointments) => {
          // Group by client phone
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

            // Collect services
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

          // Calculate next appointments and process clients
          const clientsArray = Array.from(clientsMap.values()).map((client) => {
            // Find next appointment (future appointments)
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
    // Calculate total spent from services
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
      // Calculate details if not already calculated
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
    <div className="min-h-screen bg-background">
      <div className="p-3">
        <div className="max-w-7xl mx-auto">
          <div className="spacing-item">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h1 className="text-heading">Клієнти</h1>
                <p className="text-caption font-medium">Управління клієнтською базою</p>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Всього: <span className="font-bold text-foreground dark:text-white">{clients.length}</span>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="mb-2 spacing-item">
            <input
              type="text"
              placeholder="Пошук за ім'ям або телефоном..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-candy-sm border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-candy-blue focus:border-candy-blue transition-all"
            />
          </div>

          {/* Clients List */}
          <div className="space-y-1">
            {filteredClients.map((client) => {
              const isExpanded = expandedClient === client.phone
              const details = clientDetails[client.phone]

              return (
                <div
                  key={client.phone}
                    className={cn(
                      "card-candy card-candy-hover overflow-hidden",
                      isExpanded && "shadow-soft-lg"
                    )}
                >
                  {/* Client Header - Always Visible */}
                  <button
                    onClick={() => handleClientClick(client)}
                    className="w-full p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-candy-xs candy-purple/10 dark:candy-purple/20 flex items-center justify-center text-xs font-black text-candy-purple flex-shrink-0 overflow-hidden">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden text-left">
                          <h3 className="text-sm md:text-base font-black text-gray-900 dark:text-white truncate">{client.name}</h3>
                          <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{client.phone}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-center">
                          <div className="text-sm font-black text-gray-900 dark:text-white">
                            {client.appointmentsCount}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Візитів</div>
                        </div>
                        {isExpanded ? (
                          <ChevronUpIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Client Details - Shown when expanded */}
                  {isExpanded && (
                    <div className="px-2 pb-2 pt-0 border-t border-gray-200 dark:border-gray-700">
                      {details ? (
                    <div className="px-2 pb-2 pt-0 border-t border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                        {/* Total Spent */}
                        <div className="p-2 bg-candy-purple/10 dark:bg-candy-purple/20 rounded-candy-xs">
                          <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold mb-1">Зароблено</div>
                          <div className="text-sm font-black text-candy-purple">
                            {new Intl.NumberFormat('uk-UA', {
                              style: 'currency',
                              currency: 'UAH',
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            }).format(details.totalSpent / 100)}
                          </div>
                        </div>

                        {/* Last Visit */}
                        <div className="p-2 bg-candy-blue/10 dark:bg-candy-blue/20 rounded-candy-xs">
                          <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold mb-1">Останній візит</div>
                          <div className="text-sm font-black text-candy-blue">
                            {format(new Date(details.lastVisit), 'dd.MM.yyyy HH:mm')}
                          </div>
                        </div>

                        {/* Next Appointment */}
                        {details.nextAppointment ? (
                          <div className="p-2 bg-candy-mint/10 dark:bg-candy-mint/20 rounded-candy-xs border border-candy-mint/30">
                            <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold mb-1">Наступний візит</div>
                            <div className="text-sm font-black text-candy-mint">
                              {format(new Date(details.nextAppointment), 'dd.MM.yyyy HH:mm')}
                            </div>
                            <div className="text-[9px] text-candy-mint/70 mt-1">Заплановано</div>
                          </div>
                        ) : (
                          <div className="p-2 bg-candy-orange/10 dark:bg-candy-orange/20 rounded-candy-xs border border-candy-orange/30">
                            <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold mb-1">Наступний візит</div>
                            <div className="text-sm font-black text-candy-orange">Ще не записався</div>
                            <div className="text-[9px] text-candy-orange/70 mt-1">Для розсилки</div>
                          </div>
                        )}

                        {/* Services Used */}
                        <div className="p-2 bg-candy-pink/10 dark:bg-candy-pink/20 rounded-candy-xs md:col-span-2">
                          <div className="text-[10px] text-gray-600 dark:text-gray-400 font-bold mb-1">Послуги</div>
                          {details.servicesUsed.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {details.servicesUsed.map((service, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-white dark:bg-gray-800 text-candy-pink border border-candy-pink/30"
                                >
                                  {service.name} ({service.count})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 dark:text-gray-400">Немає інформації</div>
                          )}
                        </div>
                      </div>
                    </div>
                      ) : (
                        <div className="py-4 text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Завантаження деталей...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {filteredClients.length === 0 && (
              <div className="card-candy rounded-candy-sm shadow-soft p-8 text-center">
                <p className="text-gray-600 dark:text-gray-400 text-base font-medium">
                  {searchQuery ? 'Клієнтів не знайдено' : 'Немає клієнтів'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, addDays, subDays, isToday, isSameDay } from 'date-fns'
import { uk } from 'date-fns/locale'
import { MobileWidget } from '@/components/admin/MobileWidget'
import { MobileAppointmentCard } from '@/components/admin/MobileAppointmentCard'
import { CalendarIcon, UsersIcon, CheckIcon, MoneyIcon, StarIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { Skeleton, SkeletonWidget, SkeletonCard } from '@/components/ui/skeleton'
import { Search } from '@/components/ui/search'
import { Badge } from '@/components/ui/badge'

interface Appointment {
  id: string
  masterId: string
  masterName?: string
  clientName: string
  clientPhone: string
  startTime: string
  endTime: string
  status: string
  services?: string
}

export default function MainPage() {
  const router = useRouter()
  const [business, setBusiness] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [hideRevenue, setHideRevenue] = useState(false)
  const [servicesCache, setServicesCache] = useState<any[]>([])
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const businessData = localStorage.getItem('business')
    if (!businessData) {
      router.push('/login')
      return
    }
    try {
      const parsed = JSON.parse(businessData)
      setBusiness(parsed)
      setHideRevenue(parsed.hideRevenue === true)
    } catch {
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    if (!business) return

    // Load statistics
    fetch(`/api/statistics?businessId=${business.id}&period=day`)
      .then((res) => res.json())
      .then((data) => setStats(data))
  }, [business])

  useEffect(() => {
    if (!business) return

    // Load appointments for selected date
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    
    // Load masters, services and appointments in parallel
    Promise.all([
      fetch(`/api/masters?businessId=${business.id}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch masters')
          return res.json()
        }),
      fetch(`/api/services?businessId=${business.id}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch services')
          return res.json()
        }),
      fetch(`/api/appointments?date=${dateStr}&businessId=${business.id}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch appointments')
          return res.json()
        })
    ])
      .then(([masters, services, data]) => {
        // Ensure arrays
        const mastersArray = Array.isArray(masters) ? masters : []
        const servicesArray = Array.isArray(services) ? services : []
        const appointmentsArray = Array.isArray(data) ? data : []
        
        setServicesCache(servicesArray)
        
        const withMasters = appointmentsArray.map((apt: Appointment) => {
          const master = mastersArray.find((m: any) => m.id === apt.masterId)
          return { ...apt, masterName: master?.name || 'Невідомий майстер' }
        })
        setTodayAppointments(withMasters)
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error loading data:', error)
        setTodayAppointments([])
        setLoading(false)
      })
  }, [business, selectedDate])

  if (!business || loading) {
    return (
      <div className="bg-background dark:bg-gray-900">
        <div className="p-3">
          <div className="max-w-7xl mx-auto">
            <div className="spacing-item">
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
              <SkeletonWidget />
              <SkeletonWidget />
              <SkeletonWidget />
              <SkeletonWidget />
            </div>
            <div className="space-y-2">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount / 100)
  }

  return (
    <div className="bg-background dark:bg-gray-900">
      <div className="p-3">
        <div className="max-w-7xl mx-auto">
          <div className="spacing-item">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h1 className="text-heading">Головна панель</h1>
                <p className="text-caption font-medium">Огляд вашого бізнесу</p>
              </div>
              <div className="w-full md:w-64">
                <Search 
                  placeholder="Пошук записів..." 
                  onSearch={setSearchQuery}
                />
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className={cn(
            "grid gap-2 mb-2",
            hideRevenue ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4"
          )}>
            <MobileWidget
              icon={<CalendarIcon />}
              title="Сьогодні"
              value={stats?.totalAppointments || 0}
              iconColor="orange"
              onClick={() => router.push('/dashboard/appointments')}
            />
            <MobileWidget
              icon={<StarIcon />}
              title="Прайс-лист"
              value={servicesCache.length || 0}
              iconColor="green"
              onClick={() => router.push('/dashboard/pricelist')}
            />
            {!hideRevenue && (
              <MobileWidget
                icon={<MoneyIcon />}
                title="Дохід"
                value={formatCurrency(stats?.totalRevenue || 0)}
                iconColor="blue"
                onClick={() => router.push('/dashboard/analytics')}
              />
            )}
            <MobileWidget
              icon={<UsersIcon />}
              title="Клієнти"
              value={stats?.uniqueClients || 0}
              iconColor="blue"
              onClick={() => router.push('/dashboard/clients')}
            />
          </div>

          {/* Revenue Toggle */}
          <div className="mb-2 flex items-center justify-end">
            <button
              onClick={async () => {
                const newHideRevenue = !hideRevenue
                setHideRevenue(newHideRevenue)
                
                // Update in database
                if (business?.id) {
                  try {
                    const response = await fetch(`/api/business/${business.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ hideRevenue: newHideRevenue }),
                    })
                    if (response.ok) {
                      const updated = await response.json()
                      const updatedBusiness = { ...business, hideRevenue: newHideRevenue }
                      localStorage.setItem('business', JSON.stringify(updatedBusiness))
                      setBusiness(updatedBusiness)
                    }
                  } catch (error) {
                    console.error('Error updating hideRevenue:', error)
                  }
                }
              }}
              className="btn-secondary"
            >
              <span>{hideRevenue ? '👁️ Показати дохід' : '🙈 Приховати дохід'}</span>
            </button>
          </div>

          {/* Today's Appointments */}
          <div className="card-candy p-3 mb-3 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-subheading truncate">
                {isToday(selectedDate) 
                  ? `Записи на сьогодні (${format(selectedDate, 'd MMMM yyyy', { locale: uk })})`
                  : `Записи на ${format(selectedDate, 'd MMMM yyyy', { locale: uk })}`
                }
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                  className="px-2 py-1 rounded-candy-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-xs font-bold"
                  title="Попередній день"
                >
                  ←
                </button>
                <button
                  onClick={() => setSelectedDate(new Date())}
                  className={cn(
                    "px-2 py-1 rounded-candy-xs border text-xs font-bold transition-all",
                    isToday(selectedDate)
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  )}
                  title="Сьогодні"
                >
                  Сьогодні
                </button>
                <button
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                  className="px-2 py-1 rounded-candy-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-xs font-bold"
                  title="Наступний день"
                >
                  →
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {(() => {
                const filtered = todayAppointments.filter((apt) => {
                  if (!searchQuery) return true
                  const query = searchQuery.toLowerCase()
                  return (
                    apt.clientName.toLowerCase().includes(query) ||
                    apt.clientPhone.includes(query) ||
                    apt.masterName?.toLowerCase().includes(query)
                  )
                })
                const sorted = filtered.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                const displayed = sorted.slice(0, 5)
                
                return (
                  <>
                    {displayed.map((appointment) => (
                      <MobileAppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        servicesCache={servicesCache}
                        onStatusChange={async (id, newStatus) => {
                          try {
                            const response = await fetch(`/api/appointments/${id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: newStatus }),
                            })
                            if (response.ok) {
                              setTodayAppointments(prev =>
                                prev.map(apt => apt.id === id ? { ...apt, status: newStatus } : apt)
                              )
                              // Оновити статистику
                              if (business?.id) {
                                const statsResponse = await fetch(`/api/statistics?businessId=${business.id}&period=day`)
                                if (statsResponse.ok) {
                                  const statsData = await statsResponse.json()
                                  setStats(statsData)
                                }
                              }
                            }
                          } catch (error) {
                            console.error('Error updating appointment status:', error)
                          }
                        }}
                      />
                    ))}
                    {filtered.length === 0 && (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-8 font-medium text-sm">
                        {searchQuery 
                          ? 'Записів не знайдено'
                          : isToday(selectedDate) 
                            ? 'Немає записів на сьогодні'
                            : `Немає записів на ${format(selectedDate, 'd MMMM yyyy', { locale: uk })}`
                        }
                      </p>
                    )}
                    {filtered.length > 5 && (
                      <button
                        onClick={() => router.push('/dashboard/appointments')}
                        className="btn-secondary w-full"
                      >
                        Показати всі записи ({filtered.length})
                      </button>
                    )}
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}




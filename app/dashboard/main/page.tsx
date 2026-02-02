'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Sidebar } from '@/components/admin/Sidebar'
import { MobileWidget } from '@/components/admin/MobileWidget'
import { MobileAppointmentCard } from '@/components/admin/MobileAppointmentCard'
import { CalendarIcon, UsersIcon, CheckIcon, MoneyIcon } from '@/components/icons'
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

    // Load today's appointments
    const today = format(new Date(), 'yyyy-MM-dd')
    
    // Load masters and appointments in parallel
    Promise.all([
      fetch(`/api/masters?businessId=${business.id}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch masters')
          return res.json()
        }),
      fetch(`/api/appointments?date=${today}&businessId=${business.id}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch appointments')
          return res.json()
        })
    ])
      .then(([masters, data]) => {
        // Ensure masters is an array
        const mastersArray = Array.isArray(masters) ? masters : []
        const appointmentsArray = Array.isArray(data) ? data : []
        
        const withMasters = appointmentsArray.map((apt: Appointment) => {
          const master = mastersArray.find((m: any) => m.id === apt.masterId)
          return { ...apt, masterName: master?.name || apt.master?.name || 'Невідомий майстер' }
        })
        setTodayAppointments(withMasters)
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error loading data:', error)
        setTodayAppointments([])
        setLoading(false)
      })
  }, [business])

  if (!business || loading) {
    return (
      <div className="bg-background dark:bg-gray-900">
        <Sidebar />
        <div className="ml-16 md:ml-40 p-3">
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
    }).format(amount)
  }

  return (
    <div className="bg-background dark:bg-gray-900">
      <Sidebar />
      <div className="ml-16 md:ml-40 p-3">
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
                  onSearch={(query) => {
                    // Фільтрація записів по запиту
                    console.log('Search:', query)
                  }}
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
            />
            <MobileWidget
              icon={<CheckIcon />}
              title="Підтверджено"
              value={stats?.confirmedAppointments || 0}
              trend="up"
              iconColor="green"
            />
            {!hideRevenue && (
              <MobileWidget
                icon={<MoneyIcon />}
                title="Дохід"
                value={formatCurrency(stats?.totalRevenue || 0)}
                iconColor="blue"
              />
            )}
            <MobileWidget
              icon={<UsersIcon />}
              title="Клієнти"
              value={stats?.uniqueClients || 0}
              iconColor="purple"
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
            <h2 className="text-subheading mb-3 truncate">
              Записи на сьогодні ({format(new Date(), 'd MMMM yyyy')})
            </h2>
            <div className="space-y-2">
              {todayAppointments
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                .slice(0, 5)
                .map((appointment) => {
                  const startTime = new Date(appointment.startTime)
                  const endTime = new Date(appointment.endTime)
                  let servicesList: string[] = []
                  try {
                    if (appointment.services) {
                      servicesList = JSON.parse(appointment.services)
                    }
                  } catch (e) {
                    // Ignore
                  }

                  const getStatusColor = (status: string) => {
                    switch (status) {
                      case 'Pending':
                      case 'Очікує':
                        return 'bg-candy-orange/10 text-candy-orange border-candy-orange'
                      case 'Confirmed':
                      case 'Підтверджено':
                        return 'bg-candy-mint/10 text-candy-mint border-candy-mint'
                      case 'Done':
                      case 'Виконано':
                        return 'bg-candy-blue/10 text-candy-blue border-candy-blue'
                      case 'Cancelled':
                      case 'Скасовано':
                        return 'bg-red-50 text-red-500 border-red-500'
                      default:
                        return 'bg-gray-50 text-gray-500 border-gray-400'
                    }
                  }

                  const getStatusLabel = (status: string) => {
                    switch (status) {
                      case 'Pending':
                        return 'Очікує'
                      case 'Confirmed':
                        return 'Підтверджено'
                      case 'Done':
                        return 'Виконано'
                      case 'Cancelled':
                        return 'Скасовано'
                      default:
                        return status
                    }
                  }

                  return (
                    <div
                      key={appointment.id}
                      className="card-candy card-candy-hover p-2.5 flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="flex flex-col items-center justify-center w-14 h-14 rounded-candy-sm bg-candy-blue/10 dark:bg-candy-blue/20 text-candy-blue flex-shrink-0 border border-candy-blue/20">
                          <span className="text-sm font-black leading-tight">
                            {format(startTime, 'HH:mm')}
                          </span>
                          <span className="text-[10px] font-bold leading-tight text-gray-500 dark:text-gray-400">
                            {format(endTime, 'HH:mm')}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-black text-foreground dark:text-white truncate">{appointment.clientName}</p>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 whitespace-nowrap ${getStatusColor(appointment.status)}`}>
                              {getStatusLabel(appointment.status)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {appointment.masterName && (
                              <span className="text-xs text-gray-600 dark:text-gray-400 font-medium truncate">
                                Майстер: {appointment.masterName}
                              </span>
                            )}
                            {servicesList.length > 0 && (
                              <span className="text-xs text-gray-500 dark:text-gray-500">
                                • {servicesList.length} {servicesList.length === 1 ? 'послуга' : 'послуг'}
                              </span>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-500">
                              • {Math.round((endTime.getTime() - startTime.getTime()) / 60000)} хв
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              {todayAppointments.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8 font-medium text-sm">Немає записів на сьогодні</p>
              )}
              {todayAppointments.length > 5 && (
                <button
                  onClick={() => router.push('/dashboard/appointments')}
                  className="btn-secondary w-full"
                >
                  Показати всі записи ({todayAppointments.length})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}




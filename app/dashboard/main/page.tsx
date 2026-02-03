'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameDay } from 'date-fns'
import { uk } from 'date-fns/locale'
import { MobileWidget } from '@/components/admin/MobileWidget'
import { MobileAppointmentCard } from '@/components/admin/MobileAppointmentCard'
import { SMSMessagesCard } from '@/components/admin/SMSMessagesCard'
import { CalendarIcon, UsersIcon, CheckIcon, MoneyIcon, LightBulbIcon, ChevronUpIcon, ChevronDownIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

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
  const [activeTab, setActiveTab] = useState<'working' | 'overdue'>('working')
  const [insightsTab, setInsightsTab] = useState<'insights' | 'dates'>('insights')

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

    // Load statistics
    fetch(`/api/statistics?businessId=${business.id}&period=day`)
      .then((res) => res.json())
      .then((data) => setStats(data))

    // Load today's appointments
    const today = format(new Date(), 'yyyy-MM-dd')
    
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
        const mastersArray = Array.isArray(masters) ? masters : []
        const appointmentsArray = Array.isArray(data) ? data : []
        
        const withMasters = appointmentsArray.map((apt: Appointment) => {
          const master = mastersArray.find((m: any) => m.id === apt.masterId)
          return { ...apt, masterName: master?.name || 'Невідомий спеціаліст' }
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

  // Get calendar dates for sidebar
  const getCalendarDates = () => {
    const today = new Date()
    const weekStart = startOfWeek(today, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
    return days.slice(0, 3) // Show next 3 days
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (!business || loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  const calendarDates = getCalendarDates()
  const hasAppointments = todayAppointments.length > 0

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              Dashboard
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {hasAppointments ? `Сьогодні у вас ${todayAppointments.length} ${todayAppointments.length === 1 ? 'запис' : 'записів'}` : 'Сьогодні в тебе нічого немає'}
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard/appointments')}
            className="btn-primary whitespace-nowrap flex items-center gap-2"
          >
            <UsersIcon className="w-4 h-4" />
            Створити запис
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-3">
          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('working')}
              className={cn(
                'px-4 py-2 rounded-lg font-medium text-sm transition-all',
                activeTab === 'working'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              )}
            >
              Робочий день
            </button>
            <button
              onClick={() => setActiveTab('overdue')}
              className={cn(
                'px-4 py-2 rounded-lg font-medium text-sm transition-all',
                activeTab === 'overdue'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              )}
            >
              Протерміновані
            </button>
          </div>

          {/* Content based on tab */}
          {activeTab === 'working' && (
            <>
              {hasAppointments ? (
                <div className="card-modern p-6">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-4">
                    Записи на сьогодні
                  </h2>
                  <div className="space-y-2">
                    {todayAppointments
                      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
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
                              return 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                            case 'Confirmed':
                            case 'Підтверджено':
                              return 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                            case 'Done':
                            case 'Виконано':
                              return 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            case 'Cancelled':
                            case 'Скасовано':
                              return 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                            default:
                              return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
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
                            className="p-4 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col items-center justify-center w-16 h-16 rounded-lg gradient-indigo text-white flex-shrink-0 shadow-sm">
                                <span className="text-base font-bold">
                                  {format(startTime, 'HH:mm')}
                                </span>
                                <span className="text-xs font-medium">
                                  {format(endTime, 'HH:mm')}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                                    {appointment.clientName}
                                  </p>
                                  <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getStatusColor(appointment.status))}>
                                    {getStatusLabel(appointment.status)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                  {appointment.masterName && (
                                    <span>Спеціаліст: {appointment.masterName}</span>
                                  )}
                                  {servicesList.length > 0 && (
                                    <span>• {servicesList.length} послуг</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              ) : (
                <div className="card-modern p-8 text-center">
                  {/* Empty State Illustration */}
                  <div className="mb-4 flex justify-center">
                    <div className="relative w-48 h-48">
                      {/* Computer */}
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-18 bg-gradient-to-br from-candy-purple/20 to-candy-blue/20 rounded-candy-xs border-2 border-candy-purple/30">
                        <div className="p-1.5 space-y-0.5">
                          <div className="flex gap-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-candy-purple/40"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-candy-blue/40"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-candy-mint/40"></div>
                          </div>
                        </div>
                      </div>
                      {/* Plant */}
                      <div className="absolute top-1/2 left-1/4 transform -translate-x-1/2 -translate-y-1/2 w-6 h-9 bg-gradient-to-b from-candy-mint/30 to-candy-green/30 rounded-full"></div>
                      {/* Coffee */}
                      <div className="absolute top-1/2 right-1/4 transform translate-x-1/2 -translate-y-1/2 w-4.5 h-6 bg-gradient-to-b from-amber-400/30 to-amber-600/30 rounded-full"></div>
                      {/* Dots */}
                      <div className="absolute top-1/4 left-1/4 w-1.5 h-1.5 rounded-full bg-candy-purple/30"></div>
                      <div className="absolute bottom-1/4 right-1/4 w-1.5 h-1.5 rounded-full bg-candy-blue/30"></div>
                    </div>
                  </div>
                  
                  <h3 className="text-base font-black text-gray-900 dark:text-white mb-1.5">
                    Сьогодні без завдань 🌙
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 max-w-md mx-auto">
                    Можеш використати момент і додати справи на день
                  </p>
                  <button
                    onClick={() => router.push('/dashboard/appointments')}
                    className="px-3 py-1.5 bg-gradient-to-r from-candy-purple to-candy-blue text-white font-bold rounded-candy-xs text-xs shadow-soft-lg hover:shadow-soft-xl transition-all active:scale-95"
                  >
                    Згенерувати план на день
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'overdue' && (
            <div className="card-candy p-4 md:p-6 text-center">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Немає протермінованих записів
              </p>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-3">
          {/* Calendar Section */}
          <div className="card-candy p-3 bg-gradient-to-br from-candy-purple/10 to-candy-blue/10 border-candy-purple/20">
            <div className="flex items-center justify-between mb-2">
              <ChevronUpIcon className="w-4 h-4 text-candy-purple" />
              <CalendarIcon className="w-5 h-5 text-candy-purple" />
            </div>
            
            <div className="space-y-2 mb-2">
              {calendarDates.map((date) => {
                const isTodayDate = isToday(date)
                return (
                  <div
                    key={date.toISOString()}
                    className={cn(
                      'p-2 rounded-candy-xs transition-all',
                      isTodayDate
                        ? 'bg-gradient-to-r from-candy-purple to-candy-blue text-white shadow-soft-lg'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                    )}
                  >
                    <p className="font-bold text-xs">
                      {format(date, 'EEEE d MMMM', { locale: uk })}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between mb-2">
              <ChevronDownIcon className="w-4 h-4 text-candy-purple" />
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              У календарі поки тихо
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              Саме час запланувати щось цікаве
            </p>
            <button
              onClick={() => router.push('/dashboard/appointments')}
              className="w-full px-2.5 py-1.5 bg-gradient-to-r from-candy-blue to-candy-purple text-white font-bold rounded-candy-xs text-xs shadow-soft-lg hover:shadow-soft-xl transition-all active:scale-95"
            >
              Створити справи
            </button>
          </div>

          {/* Insights Section */}
          <div className="card-candy p-3">
            <div className="flex gap-1.5 mb-2">
              <button
                onClick={() => setInsightsTab('insights')}
                className={cn(
                  'flex-1 px-2 py-1 rounded-candy-xs text-xs font-bold transition-all',
                  insightsTab === 'insights'
                    ? 'bg-gradient-to-r from-candy-purple to-candy-blue text-white shadow-soft-lg'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                )}
              >
                <LightBulbIcon className="w-3 h-3 inline mr-0.5" />
                Інсайти
              </button>
              <button
                onClick={() => setInsightsTab('dates')}
                className={cn(
                  'flex-1 px-2 py-1 rounded-candy-xs text-xs font-bold transition-all',
                  insightsTab === 'dates'
                    ? 'bg-gradient-to-r from-candy-purple to-candy-blue text-white shadow-soft-lg'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                )}
              >
                <CalendarIcon className="w-3 h-3 inline mr-0.5" />
                Дати
              </button>
            </div>

            {insightsTab === 'insights' && (
              <div className="text-center py-4">
                <div className="mb-2 flex justify-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-candy-purple/20 to-candy-blue/20 rounded-full flex items-center justify-center">
                    <LightBulbIcon className="w-8 h-8 text-candy-purple" />
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Ще нічого не проаналізовано
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-500">
                  Як тільки буде більше активності — система підкаже цікаві інсайти
                </p>
              </div>
            )}

            {insightsTab === 'dates' && (
              <div className="text-center py-4">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Немає важливих дат
                </p>
              </div>
            )}
          </div>

          {/* SMS Messages Section */}
          {business?.id && <SMSMessagesCard businessId={business.id} />}
        </div>
      </div>
    </div>
  )
}

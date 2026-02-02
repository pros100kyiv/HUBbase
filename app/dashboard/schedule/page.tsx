'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, getDay, isToday, addMonths, subMonths } from 'date-fns'
import { uk } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, UserIcon } from '@/components/icons'

interface Master {
  id: string
  name: string
  isActive?: boolean
  workingHours?: string
}

interface DaySchedule {
  enabled: boolean
  start: string
  end: string
}

interface WorkingHours {
  [key: string]: DaySchedule
}

const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const dayNamesFull = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота', 'Неділя']

export default function SchedulePage() {
  const router = useRouter()
  const [business, setBusiness] = useState<any>(null)
  const [masters, setMasters] = useState<Master[]>([])
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })
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

    fetch(`/api/masters?businessId=${business.id}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch masters')
        }
        return res.json()
      })
      .then((data) => {
        const mastersArray = Array.isArray(data) ? data : []
        setMasters(mastersArray.filter((m: Master) => m.isActive !== false))
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error loading masters:', error)
        setMasters([])
        setLoading(false)
      })
  }, [business])

  const parseWorkingHours = (workingHours?: string): WorkingHours | null => {
    if (!workingHours) return null
    try {
      return JSON.parse(workingHours)
    } catch {
      return null
    }
  }

  const getDayName = (date: Date): string => {
    const dayIndex = getDay(date) === 0 ? 6 : getDay(date) - 1
    return dayNamesFull[dayIndex]
  }

  const isMasterWorking = (master: Master, date: Date): boolean => {
    if (!master.isActive) return false
    
    const workingHours = parseWorkingHours(master.workingHours)
    if (!workingHours) return false

    const dayName = getDayName(date)
    const daySchedule = workingHours[dayName]
    
    return daySchedule?.enabled === true
  }

  const getWorkingMastersForDay = (date: Date): Master[] => {
    return masters.filter((master) => isMasterWorking(master, date))
  }

  const getMasterColor = (masterId: string, index: number): string => {
    const colors = [
      'bg-gradient-to-r from-candy-purple to-candy-blue',
      'bg-gradient-to-r from-candy-blue to-candy-mint',
      'bg-gradient-to-r from-candy-mint to-candy-pink',
      'bg-gradient-to-r from-candy-pink to-candy-orange',
      'bg-gradient-to-r from-candy-orange to-candy-purple',
    ]
    return colors[index % colors.length]
  }

  const daysInMonth = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
  })

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
              Графік роботи
            </h1>
            <p className="text-base text-gray-600 dark:text-gray-400">
              Розклад роботи спеціалістів
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-candy-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-4 py-2 bg-gradient-to-r from-candy-blue to-candy-purple text-white font-bold rounded-candy-sm shadow-soft-xl hover:shadow-soft-2xl transition-all active:scale-95"
            >
              Сьогодні
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-candy-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <div className="card-candy p-6">
            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-6 text-center">
              {format(currentMonth, 'LLLL yyyy', { locale: uk })}
            </h2>

            {/* Day Names */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-sm font-bold text-gray-500 dark:text-gray-400 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {daysInMonth.map((day) => {
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
                const isTodayDate = isToday(day)
                const workingMasters = getWorkingMastersForDay(day)

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'relative p-3 rounded-candy-sm border min-h-[100px] flex flex-col backdrop-blur-sm',
                      isCurrentMonth
                        ? 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
                        : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 opacity-50',
                      isTodayDate && 'ring-2 ring-candy-purple/50',
                      workingMasters.length > 0 && 'bg-gradient-to-br from-candy-purple/5 to-candy-blue/5'
                    )}
                  >
                    <div className={cn(
                      'text-base font-black mb-2',
                      isCurrentMonth
                        ? isTodayDate
                          ? 'text-candy-purple'
                          : 'text-gray-900 dark:text-white'
                        : 'text-gray-400 dark:text-gray-600'
                    )}>
                      {format(day, 'd')}
                    </div>

                    <div className="flex-1 flex flex-col gap-1 mt-auto">
                      {workingMasters.slice(0, 3).map((master, idx) => {
                        const masterIndex = masters.findIndex((m) => m.id === master.id)
                        return (
                          <div
                            key={master.id}
                            className={cn(
                              'px-2 py-1 rounded-candy-xs text-xs font-bold text-white truncate',
                              getMasterColor(master.id, masterIndex)
                            )}
                            title={master.name}
                          >
                            {master.name}
                          </div>
                        )
                      })}
                      {workingMasters.length > 3 && (
                        <div className="px-2 py-1 rounded-candy-xs bg-gray-300 dark:bg-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 text-center">
                          +{workingMasters.length - 3}
                        </div>
                      )}
                      {workingMasters.length === 0 && isCurrentMonth && (
                        <div className="text-xs text-gray-400 dark:text-gray-600 text-center mt-auto">
                          Вихідний
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Masters List */}
          <div className="card-candy p-6">
            <h2 className="text-xl font-black text-gray-900 dark:text-white mb-4">
              Спеціалісти та їх графік
            </h2>
            {masters.length === 0 ? (
              <div className="text-center py-8">
                <div className="mb-4 flex justify-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-candy-purple/20 to-candy-blue/20 rounded-full flex items-center justify-center">
                    <UserIcon className="w-12 h-12 text-candy-purple" />
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Немає спеціалістів
                </p>
                <button
                  onClick={() => router.push('/dashboard/settings?tab=masters')}
                  className="px-4 py-2 bg-gradient-to-r from-candy-purple to-candy-blue text-white font-bold rounded-candy-sm shadow-soft-xl hover:shadow-soft-2xl transition-all active:scale-95"
                >
                  Додати спеціаліста
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {masters.map((master, idx) => {
                  const workingHours = parseWorkingHours(master.workingHours)
                  const workingDays = workingHours
                    ? Object.entries(workingHours)
                        .filter(([, schedule]) => schedule.enabled)
                        .map(([dayName]) => dayName.substring(0, 2))
                    : []

                  return (
                    <div
                      key={master.id}
                      className="flex items-center gap-3 p-3 rounded-candy-sm bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border border-gray-200 dark:border-gray-700"
                    >
                      <div className={cn(
                        'w-10 h-10 rounded-full flex-shrink-0',
                        getMasterColor(master.id, idx)
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-black text-gray-900 dark:text-white truncate mb-1">
                          {master.name}
                        </p>
                        {workingDays.length > 0 ? (
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {workingDays.join(', ')}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400 dark:text-gray-500">
                            Графік не налаштовано
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="card-candy p-6 bg-gradient-to-br from-candy-purple/10 to-candy-blue/10">
            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-4">
              Швидкі дії
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/dashboard/settings?tab=masters')}
                className="w-full px-4 py-3 bg-gradient-to-r from-candy-purple to-candy-blue text-white font-bold rounded-candy-sm shadow-soft-xl hover:shadow-soft-2xl transition-all active:scale-95 text-left"
              >
                Налаштувати графік
              </button>
              <button
                onClick={() => router.push('/dashboard/masters')}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all active:scale-95 rounded-candy-sm font-bold text-left"
              >
                Переглянути спеціалістів
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

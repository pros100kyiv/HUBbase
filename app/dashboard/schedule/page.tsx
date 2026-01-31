'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, eachDayOfInterval, getDay, isToday, addMonths, subMonths } from 'date-fns'
import { uk } from 'date-fns/locale'
import { Sidebar } from '@/components/admin/Sidebar'
import { cn } from '@/lib/utils'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'

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
    const dayNamesMap: Record<string, string> = {
      'понеділок': 'monday',
      'вівторок': 'tuesday',
      'середа': 'wednesday',
      'четвер': 'thursday',
      'п\'ятниця': 'friday',
      'субота': 'saturday',
      'неділя': 'sunday',
    }
    const ukDayName = dayNamesFull[dayIndex].toLowerCase()
    return dayNamesMap[ukDayName] || ukDayName
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
      'bg-candy-purple',
      'bg-candy-blue',
      'bg-candy-mint',
      'bg-candy-pink',
      'bg-candy-orange',
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
    <div className="bg-background">
      <Sidebar />
      <div className="ml-16 md:ml-40 p-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between spacing-item">
            <h1 className="text-heading">Графік роботи</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="btn-secondary"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="btn-primary"
              >
                Сьогодні
              </button>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="btn-secondary"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calendar */}
          <div className="card-candy p-3 spacing-section overflow-hidden">
            <h2 className="text-subheading mb-3 text-center">
              {format(currentMonth, 'LLLL yyyy', { locale: uk })}
            </h2>

            {/* Day Names */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-xs font-bold text-gray-600 dark:text-gray-400 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {daysInMonth.map((day) => {
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
                const isTodayDate = isToday(day)
                const workingMasters = getWorkingMastersForDay(day)

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'relative p-2 rounded-candy-sm border min-h-[80px] flex flex-col',
                      isCurrentMonth
                        ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800 opacity-50',
                      isTodayDate && 'ring-2 ring-candy-purple/50',
                      workingMasters.length > 0 && 'bg-candy-purple/5 dark:bg-candy-purple/10'
                    )}
                  >
                    {/* Date Number */}
                    <div className={cn(
                      'text-sm font-black mb-1',
                      isCurrentMonth
                        ? isTodayDate
                          ? 'text-candy-purple'
                          : 'text-foreground dark:text-white'
                        : 'text-gray-400 dark:text-gray-600'
                    )}>
                      {format(day, 'd')}
                    </div>

                    {/* Working Masters */}
                    <div className="flex-1 flex flex-col gap-1 mt-auto">
                      {workingMasters.slice(0, 3).map((master, idx) => {
                        const masterIndex = masters.findIndex((m) => m.id === master.id)
                        return (
                          <div
                            key={master.id}
                            className={cn(
                              'px-1.5 py-0.5 rounded-candy-xs text-[9px] font-bold text-white truncate',
                              getMasterColor(master.id, masterIndex)
                            )}
                            title={master.name}
                          >
                            {master.name}
                          </div>
                        )
                      })}
                      {workingMasters.length > 3 && (
                        <div className="px-1.5 py-0.5 rounded-candy-xs bg-gray-300 dark:bg-gray-700 text-[9px] font-bold text-gray-700 dark:text-gray-300 text-center">
                          +{workingMasters.length - 3}
                        </div>
                      )}
                      {workingMasters.length === 0 && isCurrentMonth && (
                        <div className="text-[9px] text-gray-400 dark:text-gray-600 text-center mt-auto">
                          Вихідний
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="card-candy p-3">
            <h3 className="text-subheading mb-2">Майстри</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {masters.map((master, idx) => {
                const workingHours = parseWorkingHours(master.workingHours)
                const dayNamesMap: Record<string, string> = {
                  'monday': 'Пн',
                  'tuesday': 'Вт',
                  'wednesday': 'Ср',
                  'thursday': 'Чт',
                  'friday': 'Пт',
                  'saturday': 'Сб',
                  'sunday': 'Нд',
                }
                const workingDays = workingHours
                  ? Object.entries(workingHours)
                      .filter(([_, schedule]) => schedule.enabled)
                      .map(([day]) => dayNamesMap[day.toLowerCase()])
                      .filter((day) => day !== undefined)
                  : []

                return (
                  <div
                    key={master.id}
                    className="flex items-center gap-2 p-2 rounded-candy-sm bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className={cn(
                      'w-4 h-4 rounded-full flex-shrink-0',
                      getMasterColor(master.id, idx)
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-foreground dark:text-white truncate">
                        {master.name}
                      </p>
                      {workingDays.length > 0 ? (
                        <p className="text-[10px] text-gray-600 dark:text-gray-400">
                          {workingDays.join(', ')}
                        </p>
                      ) : (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          Графік не налаштовано
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


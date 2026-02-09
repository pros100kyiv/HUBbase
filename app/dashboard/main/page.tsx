'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfDay } from 'date-fns'
import { MyDayCard } from '@/components/admin/MyDayCard'
import { FreeSlotsModal } from '@/components/admin/FreeSlotsModal'
import { WeeklyProcessCard } from '@/components/admin/WeeklyProcessCard'
import { NotesCard } from '@/components/admin/NotesCard'
import { SocialMessagesCard } from '@/components/admin/SocialMessagesCard'

interface Appointment {
  id: string
  masterId: string
  masterName?: string
  master?: {
    id: string
    name: string
  }
  clientName: string
  clientPhone: string
  startTime: string
  endTime: string
  status: string
  services?: string
  isFromBooking?: boolean
}

export default function MainPage() {
  const router = useRouter()
  const [business, setBusiness] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  useEffect(() => {
    setSelectedDate(startOfDay(new Date()))
  }, [])
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showFreeSlotsModal, setShowFreeSlotsModal] = useState(false)
  const [freeSlotsDate, setFreeSlotsDate] = useState<Date | null>(null)

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
    const date = selectedDate
    if (!business || !date) return

    // Load appointments for selected date
    setLoading(true)
    const dateStr = format(date, 'yyyy-MM-dd')
    
    fetch(`/api/appointments?date=${dateStr}&businessId=${business.id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch appointments')
        return res.json()
      })
      .then((data) => {
        const appointmentsArray = Array.isArray(data) ? data : []

        const withMasters = appointmentsArray.map((apt: Appointment) => {
          const masterName = apt.master?.name || apt.masterName || 'Невідомий спеціаліст'
          return { ...apt, masterName }
        })

        setTodayAppointments(withMasters)
        setLoading(false)
      })
      .catch((error) => {
        console.error('Error loading appointments:', error)
        setTodayAppointments([])
        setLoading(false)
      })
  }, [business, selectedDate, refreshKey])

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  if (!business) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="h-8 w-48 bg-white/10 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-6">
          <div className="lg:col-span-3 space-y-3 md:space-y-6">
            <div className="h-64 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          </div>
          <div className="lg:col-span-1 space-y-3 md:space-y-6">
            <div className="h-40 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
            <div className="h-40 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  // Calculate today's statistics
  const todayTotal = todayAppointments.length
  const todayCompleted = todayAppointments.filter(apt => apt.status === 'Done' || apt.status === 'Виконано').length
  const todayPending = todayAppointments.filter(apt => apt.status === 'Pending' || apt.status === 'Очікує').length
  const todayConfirmed = todayAppointments.filter(apt => apt.status === 'Confirmed' || apt.status === 'Підтверджено').length

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-6">
        {/* Left Column - Main Content (3 columns) */}
        <div className="lg:col-span-3 space-y-3 md:space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
              Dashboard
            </h1>
            {/* Mobile: Записати button next to Dashboard title */}
            <button 
              onClick={() => router.push('/dashboard/appointments?create=true')}
              className="touch-target md:hidden px-4 py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98] flex-shrink-0" 
              style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
            >
              Записати
            </button>
          </div>

          {/* My Day Card — плейсхолдер тільки при першому завантаженні дати, щоб модалка «Вільні години» не зникала при оновленні */}
          {!selectedDate ? (
            <div className="h-64 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          ) : loading && todayAppointments.length === 0 ? (
            <div className="h-64 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          ) : (
            <MyDayCard
              businessId={business?.id}
              appointments={todayAppointments}
              totalAppointments={todayTotal}
              completedAppointments={todayCompleted}
              pendingAppointments={todayPending}
              confirmedAppointments={todayConfirmed}
              onBookAppointment={() => router.push('/dashboard/appointments?create=true')}
              onBookSlot={(date, time) => router.push(`/dashboard/appointments?create=true&date=${format(date, 'yyyy-MM-dd')}&time=${encodeURIComponent(time)}`)}
              onOpenFreeSlots={(date) => {
                setFreeSlotsDate(date)
                setShowFreeSlotsModal(true)
              }}
              selectedDate={selectedDate}
              onDateChange={(date) => setSelectedDate(startOfDay(date))}
              onRefresh={handleRefresh}
            />
          )}

          <FreeSlotsModal
            isOpen={showFreeSlotsModal}
            onClose={() => {
              setShowFreeSlotsModal(false)
              setFreeSlotsDate(null)
            }}
            businessId={business?.id}
            date={freeSlotsDate ?? selectedDate ?? new Date()}
            onBookSlot={(date, time) => {
              setShowFreeSlotsModal(false)
              setFreeSlotsDate(null)
              router.push(`/dashboard/appointments?create=true&date=${format(date, 'yyyy-MM-dd')}&time=${encodeURIComponent(time)}`)
            }}
          />
        </div>

        {/* Right Column - Sidebar (1 column). Мобільний порядок: Соцмережі → Нотатки → Календар */}
        <div className="lg:col-span-1 space-y-3 md:space-y-6 flex flex-col">
          {/* Social Messages — першими на мобільному (швидка відповідь) */}
          {business?.id && (
            <div className="order-1">
              <SocialMessagesCard businessId={business.id} />
            </div>
          )}

          {/* Notes Card — другі (щоденні задачі) */}
          {business?.id && (
            <div className="order-2 md:order-3">
              <NotesCard businessId={business.id} />
            </div>
          )}

          {/* Calendar Card — третьі (огляд тижня) */}
          <div className="order-3 md:order-2">
            <WeeklyProcessCard businessId={business?.id} />
          </div>
        </div>
      </div>
    </div>
  )
}

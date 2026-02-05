'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfDay } from 'date-fns'
import { MyDayCard } from '@/components/admin/MyDayCard'
import { WeeklyProcessCard } from '@/components/admin/WeeklyProcessCard'
import { MonthProgressCard } from '@/components/admin/MonthProgressCard'
import { NotesCard } from '@/components/admin/NotesCard'
import { TasksInProcessCard } from '@/components/admin/TasksInProcessCard'
import { AddTaskCard } from '@/components/admin/AddTaskCard'
import { LastProjectsCard } from '@/components/admin/LastProjectsCard'
import { SocialMessagesCard } from '@/components/admin/SocialMessagesCard'
import { toast } from '@/components/ui/toast'

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
}

export default function MainPage() {
  const router = useRouter()
  const [business, setBusiness] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [deferSidebar, setDeferSidebar] = useState(false)

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
    fetch(`/api/statistics?businessId=${business.id}&period=month`)
      .then((res) => res.json())
      .then((data) => {
        setStats(data)
      })
      .catch((error) => {
        console.error('Error loading statistics:', error)
      })
  }, [business])

  useEffect(() => {
    if (!business) return

    // Load appointments for selected date
    setLoading(true)
    const dateStr = format(selectedDate, 'yyyy-MM-dd')

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
  }, [business, selectedDate])

  // Defer heavy sidebar widgets to improve perceived load time
  useEffect(() => {
    const t = setTimeout(() => setDeferSidebar(true), 250)
    return () => clearTimeout(t)
  }, [])

  const handleAddTask = () => {
    router.push('/dashboard/appointments')
  }

  const handleStatusChange = async (id: string, status: string) => {
    if (!business) return
    
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, businessId: business.id }),
      })

      if (response.ok) {
        setTodayAppointments((prev) =>
          prev.map((apt) => (apt.id === id ? { ...apt, status } : apt))
        )
        toast({ title: 'Статус оновлено', type: 'success' })
      } else {
        const error = await response.json()
        toast({
          title: 'Помилка',
          description: error.error || 'Не вдалося оновити статус',
          type: 'error',
        })
      }
    } catch (error) {
      console.error('Error updating status:', error)
      toast({
        title: 'Помилка',
        description: 'Не вдалося оновити статус',
        type: 'error',
      })
    }
  }

  if (!business) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-64 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="h-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  // Найближчі записи для картки (до 4 записів, сортовані по часу)
  const tasks = [...todayAppointments]
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 4)
    .map((apt) => {
      const startTime = new Date(apt.startTime)
      const timeStr = format(startTime, 'HH:mm')
      const isToday = format(startTime, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
      const timeLabel = isToday ? timeStr : `${format(startTime, 'd MMM')}, ${timeStr}`
      return {
        id: apt.id,
        clientName: apt.clientName,
        masterName: apt.masterName,
        time: timeLabel,
        status: apt.status,
      }
    })

  // Calculate today's statistics
  const todayTotal = todayAppointments.length
  const todayCompleted = todayAppointments.filter(apt => apt.status === 'Done' || apt.status === 'Виконано').length
  const todayPending = todayAppointments.filter(apt => apt.status === 'Pending' || apt.status === 'Очікує').length
  const todayConfirmed = todayAppointments.filter(apt => apt.status === 'Confirmed' || apt.status === 'Підтверджено').length

  // Convert appointments to projects format
  const projects = todayAppointments.slice(0, 3).map((apt, index) => ({
    id: apt.id,
    title: apt.masterName || `Запис ${index + 1}`,
    progress: apt.status === 'Done' ? 100 : apt.status === 'Confirmed' ? 50 : 25,
    status: apt.status === 'Done' ? 'Completed' as const : 'In Progress' as const,
    description: apt.services ? `Послуги: ${apt.services}` : undefined,
  }))

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
              className="md:hidden px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98] flex-shrink-0" 
              style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
            >
              Записати
            </button>
          </div>

          {/* My Day Card */}
          {loading ? (
            <div className="h-64 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          ) : (
            <MyDayCard
              appointments={todayAppointments}
              totalAppointments={todayTotal}
              completedAppointments={todayCompleted}
              pendingAppointments={todayPending}
              confirmedAppointments={todayConfirmed}
              onBookAppointment={() => router.push('/dashboard/appointments?create=true')}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onStatusChange={handleStatusChange}
            />
          )}

          {/* Tasks Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
            <TasksInProcessCard 
              tasks={tasks}
              onAddNote={(id) => console.log('Add note:', id)}
              onEdit={(id) => router.push(`/dashboard/appointments?edit=${id}`)}
              onDelete={(id) => console.log('Delete:', id)}
            />
            <AddTaskCard onClick={handleAddTask} />
          </div>

          {/* Last Projects */}
          <LastProjectsCard projects={projects} />
        </div>

        {/* Right Column - Sidebar (1 column) */}
        <div className="lg:col-span-1 space-y-3 md:space-y-6">
          {/* Social Messages */}
          {deferSidebar && business?.id ? (
            <SocialMessagesCard businessId={business.id} />
          ) : (
            <div className="h-48 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          )}

          {/* Calendar Card */}
          {deferSidebar ? (
            <WeeklyProcessCard businessId={business?.id} />
          ) : (
            <div className="h-64 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          )}

          {/* Notes Card */}
          {deferSidebar && business?.id ? (
            <NotesCard businessId={business.id} />
          ) : (
            <div className="h-48 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
          )}

          {/* Month Progress Card */}
          <MonthProgressCard progress={30} />
        </div>
      </div>
    </div>
  )
}

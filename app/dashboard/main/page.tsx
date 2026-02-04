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
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()))
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([])
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
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    
    Promise.all([
      fetch(`/api/masters?businessId=${business.id}`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch masters')
          return res.json()
        }),
      fetch(`/api/appointments?date=${dateStr}&businessId=${business.id}`)
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
  }, [business, selectedDate])

  const handleAddTask = () => {
    router.push('/dashboard/appointments')
  }

  if (!business || loading) {
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

  // Convert appointments to tasks format
  const tasks = todayAppointments.slice(0, 2).map((apt, index) => {
    const startTime = new Date(apt.startTime)
    const isToday = format(startTime, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
    const isTomorrow = format(startTime, 'yyyy-MM-dd') === format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')
    
    let timeLabel = format(startTime, 'HH:mm')
    if (isToday) {
      timeLabel = 'Tonight'
    } else if (isTomorrow) {
      timeLabel = 'Next Morning'
    }
    
    return {
      id: apt.id,
      title: apt.clientName,
      time: timeLabel,
      icon: index === 0 ? 'users' as const : 'user' as const,
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
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column - Main Content (3 columns) */}
        <div className="lg:col-span-3 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
              Dashboard
            </h1>
          </div>

          {/* My Day Card */}
          <MyDayCard
            appointments={todayAppointments}
            totalAppointments={todayTotal}
            completedAppointments={todayCompleted}
            pendingAppointments={todayPending}
            confirmedAppointments={todayConfirmed}
            onBookAppointment={() => router.push('/dashboard/appointments?create=true')}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />

          {/* Tasks Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <div className="lg:col-span-1 space-y-6">
          {/* Social Messages */}
          {business?.id && (
            <SocialMessagesCard businessId={business.id} />
          )}

          {/* Calendar Card */}
          <WeeklyProcessCard businessId={business?.id} />

          {/* Notes Card */}
          {business?.id && (
            <NotesCard businessId={business.id} />
          )}

          {/* Month Progress Card */}
          <MonthProgressCard progress={30} />
        </div>
      </div>
    </div>
  )
}

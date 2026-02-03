'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { OverallInfoCard } from '@/components/admin/OverallInfoCard'
import { WeeklyProcessCard } from '@/components/admin/WeeklyProcessCard'
import { MonthProgressCard } from '@/components/admin/MonthProgressCard'
import { MonthGoalsCard } from '@/components/admin/MonthGoalsCard'
import { TasksInProcessCard } from '@/components/admin/TasksInProcessCard'
import { AddTaskCard } from '@/components/admin/AddTaskCard'
import { LastProjectsCard } from '@/components/admin/LastProjectsCard'

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
  const [goals, setGoals] = useState([
    { id: '1', text: '1h Meditation', completed: true },
    { id: '2', text: '10m Running', completed: true },
    { id: '3', text: '30m Workout', completed: true },
    { id: '4', text: "30m Pooja & read book", completed: false },
  ])

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

  const handleToggleGoal = (id: string) => {
    setGoals(goals.map(goal => 
      goal.id === id ? { ...goal, completed: !goal.completed } : goal
    ))
  }

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

  // Calculate overall info
  const totalTasks = stats?.totalAppointments || 0
  const stoppedProjects = 0 // Can be calculated from cancelled appointments
  const totalProjects = stats?.totalAppointments || 0
  const inProgress = stats?.confirmedAppointments || 0
  const completed = stats?.completedAppointments || 0

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
      {/* Top Row - Three Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Overall Information Card */}
        <div className="lg:col-span-1">
          <OverallInfoCard
            totalTasks={totalTasks}
            stoppedProjects={stoppedProjects}
            totalProjects={totalProjects}
            inProgress={inProgress}
            completed={completed}
          />
        </div>

        {/* Weekly Process Card */}
        <div className="lg:col-span-1">
          <WeeklyProcessCard />
        </div>

        {/* Month Progress Card */}
        <div className="lg:col-span-1">
          <MonthProgressCard progress={30} />
        </div>
      </div>

      {/* Middle Row - Goals and Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Month Goals Card */}
        <div className="lg:col-span-1">
          <MonthGoalsCard 
            goals={goals}
            onToggleGoal={handleToggleGoal}
          />
        </div>

        {/* Tasks In Process Card */}
        <div className="lg:col-span-1">
          <TasksInProcessCard 
            tasks={tasks}
            onAddNote={(id) => console.log('Add note:', id)}
            onEdit={(id) => router.push(`/dashboard/appointments?edit=${id}`)}
            onDelete={(id) => console.log('Delete:', id)}
          />
        </div>

        {/* Add Task Card */}
        <div className="lg:col-span-1">
          <AddTaskCard onClick={handleAddTask} />
        </div>
      </div>

      {/* Bottom Row - Last Projects */}
      <div className="mb-6">
        <LastProjectsCard projects={projects} />
      </div>
    </div>
  )
}

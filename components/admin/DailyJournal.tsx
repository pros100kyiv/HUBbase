'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfDay, addMinutes, isSameDay } from 'date-fns'
import { MobileAppointmentCard } from './MobileAppointmentCard'
import { toast } from '@/components/ui/toast'

interface Master {
  id: string
  name: string
}

interface Appointment {
  id: string
  masterId: string
  clientName: string
  clientPhone: string
  startTime: string
  endTime: string
  status: string
  services?: string
  customServiceName?: string | null
  customPrice?: number | null
  isFromBooking?: boolean
}

interface DailyJournalProps {
  businessId: string
}

export function DailyJournal({ businessId }: DailyJournalProps) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [masters, setMasters] = useState<Master[]>([])
  const [services, setServices] = useState<Array<{ id: string; name: string; price?: number }>>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])

  useEffect(() => {
    fetch(`/api/masters?businessId=${businessId}`)
      .then(res => res.json())
      .then(data => setMasters(data))
  }, [businessId])

  useEffect(() => {
    fetch(`/api/services?businessId=${businessId}`)
      .then(res => res.json())
      .then(data => setServices(Array.isArray(data) ? data : []))
      .catch(() => setServices([]))
  }, [businessId])

  useEffect(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    fetch(`/api/appointments?date=${dateStr}&businessId=${businessId}`)
      .then(res => res.json())
      .then(data => setAppointments(data))
  }, [selectedDate, businessId])

  // Generate time slots (9:00 - 21:00, 15-minute intervals)
  const timeSlots: Date[] = []
  const start = startOfDay(selectedDate)
  start.setHours(9, 0, 0, 0)
  for (let i = 0; i < 48; i++) {
    timeSlots.push(addMinutes(start, i * 15))
  }

  const getAppointmentsForSlot = (masterId: string, slotTime: Date) => {
    return appointments.filter((apt) => {
      const aptStart = new Date(apt.startTime)
      const aptEnd = new Date(apt.endTime)
      return (
        apt.masterId === masterId &&
        aptStart <= slotTime &&
        aptEnd > slotTime
      )
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
      case 'Очікує':
        return 'border-yellow-500 bg-yellow-500/10'
      case 'Confirmed':
      case 'Підтверджено':
        return 'border-green-500 bg-green-500/10'
      case 'Done':
      case 'Виконано':
        return 'border-blue-500 bg-blue-500/10'
      case 'Cancelled':
      case 'Скасовано':
        return 'border-red-500 bg-red-500/10'
      default:
        return 'border-secondary/30 bg-surface'
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

  // Group appointments by time and sort
  const sortedAppointments = [...appointments].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )

  const getDisplayPrice = (apt: Appointment): number => {
    if (apt.customPrice != null && apt.customPrice > 0) return Math.round(apt.customPrice / 100)
    try {
      const ids = apt.services ? JSON.parse(apt.services) : []
      if (!Array.isArray(ids)) return 0
      return ids.reduce((acc: number, id: string) => {
        const s = services.find((x) => x.id === id)
        return acc + (s?.price ?? 0)
      }, 0)
    } catch {
      return 0
    }
  }
  const dayTotalRevenue = sortedAppointments.reduce((sum, apt) => sum + getDisplayPrice(apt), 0)

  const handleStatusChange = async (id: string, status: string) => {
    const prev = appointments
    setAppointments((p) => p.map((apt) => (apt.id === id ? { ...apt, status } : apt)))
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, status }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        toast({ title: 'Статус оновлено', type: 'success' })
        const dateStr = format(selectedDate, 'yyyy-MM-dd')
        const res = await fetch(`/api/appointments?date=${dateStr}&businessId=${businessId}`)
        if (res.ok) {
          const list = await res.json()
          setAppointments(Array.isArray(list) ? list : [])
        }
      } else {
        setAppointments(prev)
        toast({ title: 'Помилка', description: data?.error || 'Не вдалося оновити статус', type: 'error' })
      }
    } catch (error) {
      setAppointments(prev)
      console.error('Error updating appointment:', error)
      toast({ title: 'Помилка', description: 'Не вдалося оновити статус', type: 'error' })
    }
  }

  return (
    <div>
      {/* Mobile Header */}
      <div className="mb-5 bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Записи</h2>
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => {
              const prev = new Date(selectedDate)
              prev.setDate(prev.getDate() - 1)
              setSelectedDate(prev)
            }}
            className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300 text-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-95"
          >
            ←
          </button>
          <input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white font-semibold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            onClick={() => {
              const next = new Date(selectedDate)
              next.setDate(next.getDate() + 1)
              setSelectedDate(next)
            }}
            className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300 text-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-95"
          >
            →
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 font-semibold text-center py-2 px-4 rounded-xl bg-gray-50 dark:bg-gray-800">
          {format(selectedDate, 'd MMMM yyyy')}
        </p>
      </div>

      {/* Appointments List */}
      {sortedAppointments.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-3xl shadow-lg">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-5xl">
            📅
          </div>
          <p className="text-gray-700 dark:text-gray-300 font-semibold text-lg">Немає записів</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">на цей день</p>
        </div>
      ) : (
        <div>
          {sortedAppointments.map((appointment) => {
            const master = masters.find((m) => m.id === appointment.masterId)
            return (
              <MobileAppointmentCard
                key={appointment.id}
                appointment={{
                  ...appointment,
                  masterName: master?.name,
                }}
                services={services}
                onStatusChange={handleStatusChange}
                onOpenClientHistory={(phone) => router.push(`/dashboard/clients?phone=${encodeURIComponent(phone)}`)}
              />
            )
          })}
          {dayTotalRevenue > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Дохід за день</span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{dayTotalRevenue} грн</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


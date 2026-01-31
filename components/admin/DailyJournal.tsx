'use client'

import { useEffect, useState } from 'react'
import { format, startOfDay, addMinutes, isSameDay } from 'date-fns'
import { MobileAppointmentCard } from './MobileAppointmentCard'

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
}

interface DailyJournalProps {
  businessId: string
}

export function DailyJournal({ businessId }: DailyJournalProps) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [masters, setMasters] = useState<Master[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])

  useEffect(() => {
    fetch(`/api/masters?businessId=${businessId}`)
      .then(res => res.json())
      .then(data => setMasters(data))
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

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (response.ok) {
        setAppointments((prev) =>
          prev.map((apt) => (apt.id === id ? { ...apt, status } : apt))
        )
      }
    } catch (error) {
      console.error('Error updating appointment:', error)
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
                onStatusChange={handleStatusChange}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}


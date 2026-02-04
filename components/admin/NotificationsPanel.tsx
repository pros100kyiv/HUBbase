'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { XIcon, CheckIcon, ClockIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface Appointment {
  id: string
  masterId: string
  masterName?: string
  clientName: string
  clientPhone: string
  clientEmail?: string
  startTime: string
  endTime: string
  status: string
  services?: string
  notes?: string
}

interface AppointmentCardProps {
  appointment: Appointment
  onConfirm: (id: string) => void
  onReschedule: (id: string, newStartTime: string, newEndTime: string) => void
  processing: string | null
}

function AppointmentCard({ appointment, onConfirm, onReschedule, processing }: AppointmentCardProps) {
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

  const [newDate, setNewDate] = useState(format(startTime, 'yyyy-MM-dd'))
  const [newStartTime, setNewStartTime] = useState(format(startTime, 'HH:mm'))
  const [newEndTime, setNewEndTime] = useState(format(endTime, 'HH:mm'))
  const [showReschedule, setShowReschedule] = useState(false)

  return (
    <div className="p-3 rounded-candy-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black text-foreground dark:text-white mb-1">
            {appointment.clientName}
          </h3>
          <div className="space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
            <p>📞 {appointment.clientPhone}</p>
            {appointment.clientEmail && <p>✉️ {appointment.clientEmail}</p>}
            <p>👤 Майстер: {appointment.masterName}</p>
            <p className="flex items-center gap-1">
              <ClockIcon className="w-3 h-3" />
              {format(startTime, 'd MMMM yyyy, HH:mm', { locale: uk })} - {format(endTime, 'HH:mm')}
            </p>
            {servicesList.length > 0 && (
              <p>📋 Послуги: {servicesList.length}</p>
            )}
            {appointment.notes && (
              <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">
                Примітка: {appointment.notes}
              </p>
            )}
          </div>
        </div>
      </div>

      {showReschedule ? (
        <div className="space-y-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-candy-xs">
          <div className="grid grid-cols-3 gap-2">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="px-2 py-1 text-xs rounded-candy-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
            <input
              type="time"
              value={newStartTime}
              onChange={(e) => setNewStartTime(e.target.value)}
              className="px-2 py-1 text-xs rounded-candy-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
            <input
              type="time"
              value={newEndTime}
              onChange={(e) => setNewEndTime(e.target.value)}
              className="px-2 py-1 text-xs rounded-candy-xs border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              onClick={() => {
                const newStart = new Date(`${newDate}T${newStartTime}`)
                const newEnd = new Date(`${newDate}T${newEndTime}`)
                onReschedule(appointment.id, newStart.toISOString(), newEnd.toISOString())
                setShowReschedule(false)
              }}
              disabled={processing === appointment.id}
              className="flex-1 text-xs py-1 h-auto"
            >
              {processing === appointment.id ? 'Збереження...' : 'Перенести'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowReschedule(false)}
              className="text-xs py-1 h-auto"
            >
              Скасувати
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Button
            size="sm"
            onClick={() => onConfirm(appointment.id)}
            disabled={processing === appointment.id}
            className="flex-1 text-xs py-1.5 h-auto candy-mint"
          >
            <CheckIcon className="w-3 h-3 mr-1" />
            {processing === appointment.id ? 'Підтвердження...' : 'Підтвердити'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowReschedule(true)}
            disabled={processing === appointment.id}
            className="text-xs py-1.5 h-auto"
          >
            <ClockIcon className="w-3 h-3 mr-1" />
            Перенести
          </Button>
        </div>
      )}
    </div>
  )
}

interface NotificationsPanelProps {
  businessId: string
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export function NotificationsPanel({ businessId, isOpen, onClose, onUpdate }: NotificationsPanelProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && businessId) {
      loadPendingAppointments()
    }
  }, [isOpen, businessId])

  const loadPendingAppointments = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/appointments?businessId=${businessId}&status=Pending`)
      if (!response.ok) throw new Error('Failed to fetch appointments')
      const data = await response.json()
      
      // Get masters for names
      const mastersRes = await fetch(`/api/masters?businessId=${businessId}`)
      const masters = mastersRes.ok ? await mastersRes.json() : []
      
      const withMasters = (data || []).map((apt: Appointment) => {
        const master = masters.find((m: any) => m.id === apt.masterId)
        return { ...apt, masterName: master?.name || 'Невідомий майстер' }
      })
      
      setAppointments(withMasters)
    } catch (error) {
      console.error('Error loading appointments:', error)
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (appointmentId: string) => {
    setProcessing(appointmentId)
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Confirmed' }),
      })
      if (response.ok) {
        await loadPendingAppointments()
        onUpdate()
      }
    } catch (error) {
      console.error('Error confirming appointment:', error)
    } finally {
      setProcessing(null)
    }
  }

  const handleReschedule = async (appointmentId: string, newStartTime: string, newEndTime: string) => {
    setProcessing(appointmentId)
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          startTime: newStartTime,
          endTime: newEndTime,
        }),
      })
      if (response.ok) {
        await loadPendingAppointments()
        onUpdate()
      }
    } catch (error) {
      console.error('Error rescheduling appointment:', error)
    } finally {
      setProcessing(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div className="bg-white dark:bg-gray-800 rounded-candy-lg shadow-soft-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-black text-foreground dark:text-white">
            Нові бронювання ({appointments.length})
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-candy-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <XIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">Завантаження...</p>
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">Немає нових бронювань</p>
            </div>
          ) : (
            <div className="space-y-2">
              {appointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  onConfirm={handleConfirm}
                  onReschedule={handleReschedule}
                  processing={processing}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


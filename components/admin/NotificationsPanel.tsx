'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { XIcon, CheckIcon, ClockIcon } from '@/components/icons'
import { ModalPortal } from '@/components/ui/modal-portal'
import { toast } from '@/components/ui/toast'

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
    <div className="rounded-xl p-3 card-glass-subtle">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white mb-1">
            {appointment.clientName}
          </h3>
          <div className="space-y-0.5 text-xs text-gray-300">
            <p>{appointment.clientPhone}</p>
            {appointment.clientEmail && <p>{appointment.clientEmail}</p>}
            <p>Майстер: {appointment.masterName}</p>
            <p className="flex items-center gap-1 text-gray-400">
              <ClockIcon className="w-3 h-3 flex-shrink-0" />
              {format(startTime, 'd MMMM yyyy, HH:mm', { locale: uk })} - {format(endTime, 'HH:mm')}
            </p>
            {servicesList.length > 0 && <p>Послуги: {servicesList.length}</p>}
            {appointment.notes && (
              <p className="text-[10px] text-gray-500 mt-1">Примітка: {appointment.notes}</p>
            )}
          </div>
        </div>
      </div>

      {showReschedule ? (
        <div className="space-y-2 p-2 rounded-lg bg-white/5 border border-white/10">
          <div className="grid grid-cols-3 gap-2">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="px-2 py-1.5 text-xs rounded-lg border border-white/20 bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
            <input
              type="time"
              value={newStartTime}
              onChange={(e) => setNewStartTime(e.target.value)}
              className="px-2 py-1.5 text-xs rounded-lg border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            />
            <input
              type="time"
              value={newEndTime}
              onChange={(e) => setNewEndTime(e.target.value)}
              className="px-2 py-1.5 text-xs rounded-lg border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const newStart = new Date(`${newDate}T${newStartTime}`)
                const newEnd = new Date(`${newDate}T${newEndTime}`)
                onReschedule(appointment.id, newStart.toISOString(), newEnd.toISOString())
                setShowReschedule(false)
              }}
              disabled={processing === appointment.id}
              className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50"
              style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
            >
              {processing === appointment.id ? 'Збереження...' : 'Перенести'}
            </button>
            <button
              type="button"
              onClick={() => setShowReschedule(false)}
              className="px-2 py-1.5 rounded-lg text-xs font-medium border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              Скасувати
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onConfirm(appointment.id)}
            disabled={processing === appointment.id}
            className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
            style={{ boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
          >
            <CheckIcon className="w-3 h-3" />
            {processing === appointment.id ? 'Підтвердження...' : 'Підтвердити'}
          </button>
          <button
            type="button"
            onClick={() => setShowReschedule(true)}
            disabled={processing === appointment.id}
            className="px-2 py-1.5 rounded-lg text-xs font-medium border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center justify-center gap-1"
          >
            <ClockIcon className="w-3 h-3" />
            Перенести
          </button>
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
        body: JSON.stringify({ businessId, status: 'Confirmed' }),
      })
      if (response.ok) {
        toast({ title: 'Запис підтверджено', type: 'success' })
        await loadPendingAppointments()
        onUpdate()
      } else {
        const err = await response.json().catch(() => ({}))
        toast({ title: 'Помилка', description: err.error || 'Не вдалося підтвердити', type: 'error' })
      }
    } catch (error) {
      console.error('Error confirming appointment:', error)
      toast({ title: 'Помилка', description: 'Не вдалося підтвердити запис', type: 'error' })
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
          businessId,
          startTime: newStartTime,
          endTime: newEndTime,
        }),
      })
      if (response.ok) {
        toast({ title: 'Запис перенесено', type: 'success' })
        await loadPendingAppointments()
        onUpdate()
      } else {
        const err = await response.json().catch(() => ({}))
        toast({ title: 'Помилка', description: err.error || 'Не вдалося перенести (можливо час зайнятий)', type: 'error' })
      }
    } catch (error) {
      console.error('Error rescheduling appointment:', error)
      toast({ title: 'Помилка', description: 'Не вдалося перенести запис', type: 'error' })
    } finally {
      setProcessing(null)
    }
  }

  if (!isOpen) return null

  return (
    <ModalPortal>
      <div className="modal-overlay sm:!p-4">
        <div className="relative w-[95%] sm:w-full sm:max-w-2xl sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0">
        <button
          type="button"
          onClick={onClose}
          className="modal-close text-gray-400 hover:text-white rounded-xl"
          aria-label="Закрити"
        >
          <XIcon className="w-5 h-5" />
        </button>
        <h2 className="modal-title pr-10 mb-4">Нові бронювання ({appointments.length})</h2>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 pt-0">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Завантаження...</p>
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Немає нових бронювань</p>
            </div>
          ) : (
            <div className="space-y-3">
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
    </ModalPortal>
  )
}


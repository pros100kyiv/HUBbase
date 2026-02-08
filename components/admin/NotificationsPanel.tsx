'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { XIcon, CheckIcon, ClockIcon, PhoneIcon } from '@/components/icons'
import { StatusSwitcher, type StatusValue } from './StatusSwitcher'
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
  customServiceName?: string | null
  customPrice?: number | null
  notes?: string
}

type ServicesMap = Record<string, { name: string; price?: number }>

interface AppointmentCardProps {
  appointment: Appointment
  servicesMap: ServicesMap
  onConfirm: (id: string) => void
  onReschedule: (id: string, newStartTime: string, newEndTime: string) => void
  onStatusChange: (id: string, status: StatusValue) => void
  processing: string | null
}

function AppointmentCard({ appointment, servicesMap, onConfirm, onReschedule, onStatusChange, processing }: AppointmentCardProps) {
  const startTime = new Date(appointment.startTime)
  const endTime = new Date(appointment.endTime)
  let serviceIds: string[] = []
  try {
    if (appointment.services) {
      serviceIds = JSON.parse(appointment.services)
    }
  } catch (e) {
    // Ignore
  }
  const serviceNames = serviceIds
    .map((id) => servicesMap[id]?.name)
    .filter(Boolean) as string[]

  const totalFromServices = serviceIds.reduce((sum, id) => sum + (servicesMap[id]?.price ?? 0), 0)
  const displayPriceGrn =
    appointment.customPrice != null && appointment.customPrice > 0
      ? Math.round(appointment.customPrice / 100)
      : totalFromServices > 0
        ? totalFromServices
        : null

  const [newDate, setNewDate] = useState(format(startTime, 'yyyy-MM-dd'))
  const [newStartTime, setNewStartTime] = useState(format(startTime, 'HH:mm'))
  const [newEndTime, setNewEndTime] = useState(format(endTime, 'HH:mm'))
  const [showReschedule, setShowReschedule] = useState(false)

  return (
    <div className="rounded-xl p-4 card-glass-subtle border border-white/10">
      <div className="space-y-3 mb-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-0.5">Клієнт</div>
          <p className="text-base font-semibold text-white leading-tight">{appointment.clientName}</p>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-0.5">Телефон</div>
          <p className="text-sm text-white font-medium flex items-center gap-1.5">
            <PhoneIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            {appointment.clientPhone}
          </p>
        </div>
        {appointment.clientEmail && (
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-0.5">Email</div>
            <p className="text-sm text-white">{appointment.clientEmail}</p>
          </div>
        )}
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-0.5">Дата і час</div>
          <p className="text-sm text-white font-medium flex items-center gap-1.5">
            <ClockIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            {format(startTime, 'd MMMM yyyy', { locale: uk })}, {format(startTime, 'HH:mm', { locale: uk })} – {format(endTime, 'HH:mm', { locale: uk })}
          </p>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-0.5">Майстер</div>
          <p className="text-sm text-white font-medium">{appointment.masterName ?? '—'}</p>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-0.5">Послуги</div>
          {serviceNames.length > 0 ? (
            <ul className="mt-1 space-y-0.5">
              {serviceNames.map((name, i) => (
                <li key={i} className="text-sm text-white font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
                  {name}
                </li>
              ))}
            </ul>
          ) : appointment.customServiceName ? (
            <p className="text-sm text-white font-medium italic">{appointment.customServiceName}</p>
          ) : (
            <p className="text-sm text-gray-500">Не вказано</p>
          )}
        </div>
        {displayPriceGrn != null && displayPriceGrn > 0 && (
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-0.5">Вартість</div>
            <p className="text-base font-semibold text-white">{displayPriceGrn} ₴</p>
          </div>
        )}
        {appointment.notes && (
          <div>
            <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500 mb-0.5">Примітка</div>
            <p className="text-sm text-gray-300">{appointment.notes}</p>
          </div>
        )}
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
        <div className="flex flex-wrap items-center gap-2">
          <StatusSwitcher
            status={appointment.status}
            isFromBooking={true}
            appointmentId={appointment.id}
            onStatusChange={onStatusChange}
          />
          <button
            type="button"
            onClick={() => onConfirm(appointment.id)}
            disabled={processing === appointment.id}
            className="flex-1 min-w-[100px] px-2 py-1.5 rounded-lg text-xs font-semibold bg-white text-black hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
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
  const [servicesMap, setServicesMap] = useState<Record<string, { name: string; price?: number }>>({})
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
      const [appointmentsRes, mastersRes, servicesRes] = await Promise.all([
        fetch(`/api/appointments?businessId=${businessId}&status=Pending`),
        fetch(`/api/masters?businessId=${businessId}`),
        fetch(`/api/services?businessId=${businessId}`),
      ])
      if (!appointmentsRes.ok) throw new Error('Failed to fetch appointments')
      const data = await appointmentsRes.json()
      const masters = mastersRes.ok ? await mastersRes.json() : []
      const servicesList = servicesRes.ok ? await servicesRes.json() : []

      const map: Record<string, { name: string; price?: number }> = {}
      if (Array.isArray(servicesList)) {
        servicesList.forEach((s: { id: string; name: string; price?: number }) => {
          if (s?.id) map[s.id] = { name: s.name || 'Послуга', price: s.price }
        })
      }
      setServicesMap(map)

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

  const handleStatusChange = async (id: string, status: StatusValue) => {
    setProcessing(id)
    try {
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, status }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        toast({ title: 'Статус оновлено', type: 'success' })
        await loadPendingAppointments()
        onUpdate()
      } else {
        toast({ title: 'Помилка', description: data?.error || 'Не вдалося оновити статус', type: 'error' })
      }
    } catch (error) {
      console.error('Error updating status:', error)
      toast({ title: 'Помилка', description: 'Не вдалося оновити статус', type: 'error' })
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
        <h2 className="modal-title pr-10 mb-2">Нові бронювання ({appointments.length})</h2>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 pt-0">
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
                  servicesMap={servicesMap}
                  onConfirm={handleConfirm}
                  onReschedule={handleReschedule}
                  onStatusChange={handleStatusChange}
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


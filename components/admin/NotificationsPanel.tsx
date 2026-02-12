'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { XIcon, CheckIcon, ClockIcon, PhoneIcon } from '@/components/icons'
import { StatusSwitcher, type StatusValue } from './StatusSwitcher'
import { ModalPortal } from '@/components/ui/modal-portal'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

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
  onDoneWithoutPrice?: (id: string) => void
  processing: string | null
}

function AppointmentCard({ appointment, servicesMap, onConfirm, onReschedule, onStatusChange, onDoneWithoutPrice, processing }: AppointmentCardProps) {
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
    <article className="rounded-2xl p-4 sm:p-5 card-glass border border-white/10 shadow-lg shadow-black/10">
      {/* Заголовок картки: клієнт + дата/час */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-white leading-tight">{appointment.clientName}</h3>
          <p className="text-sm text-gray-400 flex items-center gap-1.5 mt-0.5">
            <PhoneIcon className="w-3.5 h-3.5 flex-shrink-0" />
            <a href={`tel:${appointment.clientPhone}`} className="hover:text-white transition-colors">{appointment.clientPhone}</a>
          </p>
        </div>
        <div className="text-right text-sm text-gray-300 flex items-center gap-1.5">
          <ClockIcon className="w-4 h-4 flex-shrink-0" />
          {format(startTime, 'd MMM', { locale: uk })}, {format(startTime, 'HH:mm', { locale: uk })} – {format(endTime, 'HH:mm', { locale: uk })}
        </div>
      </div>

      {/* Деталі: майстер, послуги, вартість */}
      <div className="space-y-2 text-sm mb-4">
        <p className="text-gray-400">
          <span className="text-gray-500">Майстер:</span> {appointment.masterName ?? '—'}
        </p>
        {serviceNames.length > 0 && (
          <p className="text-white">
            <span className="text-gray-500">Послуги:</span> {serviceNames.join(', ')}
          </p>
        )}
        {displayPriceGrn != null && displayPriceGrn > 0 && (
          <p className="font-semibold text-white">{displayPriceGrn} ₴</p>
        )}
        {appointment.notes && (
          <p className="text-gray-400 italic text-xs">{appointment.notes}</p>
        )}
      </div>

      {showReschedule ? (
        <div className="space-y-3 p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="touch-target px-3 py-2.5 text-sm rounded-xl border border-white/20 bg-white/10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/30 min-h-[44px]"
            />
            <input
              type="time"
              value={newStartTime}
              onChange={(e) => setNewStartTime(e.target.value)}
              className="touch-target px-3 py-2.5 text-sm rounded-xl border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30 min-h-[44px]"
            />
            <input
              type="time"
              value={newEndTime}
              onChange={(e) => setNewEndTime(e.target.value)}
              className="touch-target px-3 py-2.5 text-sm rounded-xl border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30 min-h-[44px]"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => {
                const newStart = new Date(`${newDate}T${newStartTime}`)
                const newEnd = new Date(`${newDate}T${newEndTime}`)
                onReschedule(appointment.id, newStart.toISOString(), newEnd.toISOString())
                setShowReschedule(false)
              }}
              disabled={processing === appointment.id}
              className="touch-target flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50"
              style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}
            >
              {processing === appointment.id ? 'Збереження...' : 'Перенести'}
            </button>
            <button
              type="button"
              onClick={() => setShowReschedule(false)}
              className="touch-target min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              Скасувати
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 min-w-0">
          <div className="w-full sm:w-auto min-w-0 shrink-0">
            <StatusSwitcher
              status={appointment.status}
              isFromBooking={true}
              appointmentId={appointment.id}
              onStatusChange={onStatusChange}
              size="sm"
              customPrice={appointment.customPrice}
              onDoneWithoutPrice={onDoneWithoutPrice}
            />
          </div>
          <div className="flex gap-2 min-w-0">
            <button
              type="button"
              onClick={() => onConfirm(appointment.id)}
              disabled={processing === appointment.id}
              className="touch-target flex-1 min-w-0 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap"
              style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}
            >
              <CheckIcon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{processing === appointment.id ? 'Підтвердження...' : 'Підтвердити'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowReschedule(true)}
              disabled={processing === appointment.id}
              className="touch-target flex-shrink-0 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <ClockIcon className="w-4 h-4 flex-shrink-0" />
              Перенести
            </button>
          </div>
        </div>
      )}
    </article>
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
  const [showDonePriceModalForId, setShowDonePriceModalForId] = useState<string | null>(null)
  const [donePriceInputGrn, setDonePriceInputGrn] = useState<number | ''>('')
  const [donePriceServiceName, setDonePriceServiceName] = useState('')
  const [donePriceSaving, setDonePriceSaving] = useState(false)

  useEffect(() => {
    if (isOpen && businessId) {
      loadPendingAppointments()
    }
  }, [isOpen, businessId])

  useEffect(() => {
    if (showDonePriceModalForId) {
      setDonePriceInputGrn('')
      const apt = appointments.find((a) => a.id === showDonePriceModalForId)
      setDonePriceServiceName(apt?.customServiceName?.trim() ?? '')
    }
  }, [showDonePriceModalForId, appointments])

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
        const master = masters.find((m: { id: string }) => m.id === apt.masterId)
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
        toast({ title: 'Помилка', description: err?.error || 'Не вдалося підтвердити', type: 'error' })
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
        toast({ title: 'Помилка', description: err?.error || 'Не вдалося перенести', type: 'error' })
      }
    } catch (error) {
      console.error('Error rescheduling appointment:', error)
      toast({ title: 'Помилка', description: 'Не вдалося перенести запис', type: 'error' })
    } finally {
      setProcessing(null)
    }
  }

  const handleDoneWithPriceSubmit = async () => {
    const id = showDonePriceModalForId
    if (!id || donePriceInputGrn === '' || Number(donePriceInputGrn) < 0) return
    setDonePriceSaving(true)
    try {
      const priceCents = Math.round(Number(donePriceInputGrn) * 100)
      const response = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          status: 'Done',
          customPrice: priceCents,
          ...(donePriceServiceName.trim() && { customServiceName: donePriceServiceName.trim() }),
        }),
      })
      if (response.ok) {
        toast({ title: 'Запис позначено як Виконано', type: 'success' })
        setShowDonePriceModalForId(null)
        setDonePriceInputGrn('')
        await loadPendingAppointments()
        onUpdate()
      } else {
        const err = await response.json().catch(() => ({}))
        toast({ title: 'Помилка', description: err?.error || 'Не вдалося оновити', type: 'error' })
      }
    } catch (error) {
      console.error('Error updating appointment:', error)
      toast({ title: 'Помилка', description: 'Не вдалося оновити запис', type: 'error' })
    } finally {
      setDonePriceSaving(false)
    }
  }

  if (!isOpen) return null

  const count = appointments.length

  return (
    <>
    <ModalPortal>
      <div
        className="modal-overlay sm:!p-4 flex items-end sm:items-center justify-center"
        onClick={onClose}
        role="presentation"
      >
        <div
          className={cn(
            'relative w-full flex flex-col modal-content modal-dialog text-white min-h-0',
            'max-h-[92dvh] sm:max-h-[85dvh] sm:max-w-lg sm:my-auto sm:rounded-2xl',
            'rounded-t-2xl sm:rounded-2xl'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Шапка: іконка + заголовок + бейдж + закрити */}
          <div className="flex items-center gap-3 px-4 sm:px-5 pb-4 flex-shrink-0 border-b border-white/10">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="modal-title text-lg font-bold tracking-tight">Сповіщення</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {count === 0 ? 'Немає нових записів' : count === 1 ? '1 новий запис' : `${count} нових записів`}
              </p>
            </div>
            {count > 0 && (
              <span className="flex-shrink-0 min-w-[28px] h-7 px-2 flex items-center justify-center rounded-full bg-red-500 text-white text-sm font-bold">
                {count > 99 ? '99+' : count}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="modal-close touch-target flex-shrink-0 rounded-xl"
              aria-label="Закрити"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Контент: скрол */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] min-h-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white/60 animate-spin mb-4" />
                <p className="text-gray-400 text-sm">Завантаження...</p>
              </div>
            ) : count === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="text-white font-medium">Немає нових бронювань</p>
                <p className="text-gray-400 text-sm mt-1 max-w-[260px]">Тут з’являтимуться записи, які очікують підтвердження</p>
              </div>
            ) : (
              <div className="space-y-4">
                {appointments.map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    servicesMap={servicesMap}
                    onConfirm={handleConfirm}
                    onReschedule={handleReschedule}
                    onStatusChange={handleStatusChange}
                    processing={processing}
                    onDoneWithoutPrice={(id: string) => {
                    toast({
                      title: 'Статус не змінено',
                      description: 'Щоб позначити запис як Виконано, спочатку вкажіть вартість послуги в формі нижче.',
                      type: 'info',
                      duration: 4000,
                    })
                    setShowDonePriceModalForId(id)
                  }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>

      {showDonePriceModalForId && (() => {
        const apt = appointments.find((a) => a.id === showDonePriceModalForId)
        return (
          <ModalPortal>
            <div className="modal-overlay modal-overlay-nested sm:!p-4" onClick={() => setShowDonePriceModalForId(null)}>
              <div
                className="relative w-[95%] sm:w-full sm:max-w-md sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <button type="button" onClick={() => setShowDonePriceModalForId(null)} className="modal-close touch-target text-gray-400 hover:text-white rounded-full" aria-label="Закрити">
                  <XIcon className="w-5 h-5" />
                </button>
                <h3 className="modal-title pr-10 mb-1">Вказати вартість послуги</h3>
                <p className="text-sm text-amber-400/90 mb-1">Статус не змінено. Заповніть вартість нижче, щоб позначити запис як Виконано.</p>
                <p className="text-sm text-gray-400 mb-4">
                  {apt ? `${apt.clientName} · ${format(new Date(apt.startTime), 'd MMM, HH:mm', { locale: uk })}` : 'Запис'}
                </p>
                <div className="space-y-4">
<label className="block">
                  <span className="text-xs font-medium text-gray-400 block mb-1.5">Вартість, грн</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={donePriceInputGrn === '' ? '' : donePriceInputGrn}
                    onChange={(e) => setDonePriceInputGrn(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                    placeholder="0"
                    autoFocus
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-400 block mb-1.5">Послуга (необов'язково)</span>
                  <input
                    type="text"
                    value={donePriceServiceName}
                    onChange={(e) => setDonePriceServiceName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-white/20 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/30 placeholder-gray-500"
                    placeholder="Наприклад: Стрижка, Манікюр"
                  />
                </label>
                <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setShowDonePriceModalForId(null)} className="flex-1 px-4 py-3 rounded-xl border border-white/20 bg-white/10 text-white text-sm font-medium hover:bg-white/15">
                      Скасувати
                    </button>
                    <button
                      type="button"
                      onClick={handleDoneWithPriceSubmit}
                      disabled={donePriceSaving || donePriceInputGrn === '' || Number(donePriceInputGrn) < 0}
                      className="flex-1 px-4 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {donePriceSaving ? 'Збереження...' : 'Зберегти та Виконано'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </ModalPortal>
        )
      })()}
    </>
  )
}

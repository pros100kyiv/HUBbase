'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { XIcon, CheckIcon, ClockIcon, PhoneIcon } from '@/components/icons'
import { StatusSwitcher, type StatusValue } from './StatusSwitcher'
import { ModalPortal } from '@/components/ui/modal-portal'
import { toast } from '@/components/ui/toast'
import { cn, fixMojibake } from '@/lib/utils'

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
  source?: string | null
  isFromBooking?: boolean
}

type ServicesMap = Record<string, { name: string; price?: number }>

interface ChangeRequest {
  id: string
  type: 'RESCHEDULE' | 'CANCEL' | string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | string
  requestedStartTime?: string | null
  requestedEndTime?: string | null
  clientNote?: string | null
  createdAt: string
  appointment: {
    id: string
    clientName: string
    startTime: string
    endTime: string
    status: string
    master?: { id: string; name: string } | null
  }
}

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
  const serviceNamesFull =
    serviceNames.length > 0 ? serviceNames : (appointment.customServiceName?.trim() ? [appointment.customServiceName.trim()] : [])
  const visibleServices = serviceNamesFull.slice(0, 2)
  const restServices = Math.max(0, serviceNamesFull.length - visibleServices.length)
  const statusBorderColor =
    appointment.status === 'Done' || appointment.status === 'Виконано'
      ? 'border-l-sky-500/80'
      : appointment.status === 'Confirmed' || appointment.status === 'Підтверджено'
        ? 'border-l-emerald-500/80'
        : appointment.status === 'Pending' || appointment.status === 'Очікує'
          ? 'border-l-amber-500/80'
          : appointment.status === 'Cancelled' || appointment.status === 'Скасовано'
            ? 'border-l-rose-500/70'
            : 'border-l-white/20'

  const [newDate, setNewDate] = useState(format(startTime, 'yyyy-MM-dd'))
  const [newStartTime, setNewStartTime] = useState(format(startTime, 'HH:mm'))
  const [newEndTime, setNewEndTime] = useState(format(endTime, 'HH:mm'))
  const [showReschedule, setShowReschedule] = useState(false)

  return (
    <article className={cn('rounded-2xl p-4 sm:p-5 bg-white/[0.04] border border-white/10 outline-none border-l-4', statusBorderColor)}>
      {/* Клієнт і час — на перший план */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-white leading-tight truncate">{fixMojibake(appointment.clientName)}</h3>
          <a href={`tel:${appointment.clientPhone}`} className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 mt-0.5">
            <PhoneIcon className="w-3.5 h-3.5 flex-shrink-0" />
            {appointment.clientPhone}
          </a>
        </div>
        <div className="flex items-end gap-2 flex-shrink-0">
          {displayPriceGrn != null && displayPriceGrn > 0 && (
            <div className="text-sm font-semibold text-emerald-400 tabular-nums">
              {displayPriceGrn} грн
            </div>
          )}
          <div className="text-sm text-gray-300 flex items-center gap-1.5">
            <ClockIcon className="w-4 h-4 flex-shrink-0 text-gray-500" />
            <span className="tabular-nums">
              {format(startTime, 'd MMM', { locale: uk })}, {format(startTime, 'HH:mm', { locale: uk })}–{format(endTime, 'HH:mm', { locale: uk })}
            </span>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-gray-500 flex items-center gap-2 flex-wrap mb-3">
        <span className="truncate">{appointment.masterName ?? '—'}</span>
        <span className="text-gray-700">·</span>
        {appointment.source === 'telegram' ? (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#0088cc]/20 text-[#6eb8e8] border border-[#0088cc]/40"
            title="Запис через Telegram — клієнт отримає сповіщення в боті"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.192l-1.87 8.803c-.14.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.053 5.56-5.022c.24-.213-.054-.334-.373-.12l-6.87 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
            </svg>
            TG · Зовнішній запис
          </span>
        ) : (
          <span className="truncate">Бронювання</span>
        )}
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {visibleServices.length > 0 ? (
            <>
              {visibleServices.map((name, idx) => (
                <span
                  key={`${appointment.id}-svc-${idx}`}
                  className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-white/10 text-gray-200 border border-white/10 truncate max-w-[16rem]"
                  title={name}
                >
                  {name}
                </span>
              ))}
              {restServices > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-white/5 text-gray-400 border border-white/10">
                  +{restServices}
                </span>
              )}
            </>
          ) : (
            <span className="text-[11px] text-gray-500">Послуги не вказані</span>
          )}
        </div>
        {appointment.notes && (
          <p className="text-[11px] text-gray-500 italic mt-1.5 line-clamp-1">{appointment.notes}</p>
        )}
      </div>

      {showReschedule ? (
        <div className="space-y-3 p-3 rounded-xl bg-white/[0.06] border border-white/10">
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
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 min-w-0 pt-0.5">
          <div className="w-full sm:w-auto min-w-0 shrink-0 flex items-center">
            <StatusSwitcher
              status={appointment.status}
              isFromBooking={true}
              appointmentId={appointment.id}
              onStatusChange={onStatusChange}
              size="sm"
              customPrice={appointment.customPrice}
              hasServicesFromPriceList={serviceIds.length > 0}
              onDoneWithoutPrice={onDoneWithoutPrice}
            />
          </div>
          <div className="flex gap-2 min-w-0">
            <button
              type="button"
              onClick={() => onConfirm(appointment.id)}
              disabled={processing === appointment.id}
              className="touch-target flex-1 min-w-0 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-gray-100 hover:text-gray-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 whitespace-nowrap outline-none"
              style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}
            >
              <CheckIcon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{processing === appointment.id ? 'Підтвердження...' : 'Підтвердити'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowReschedule(true)}
              disabled={processing === appointment.id}
              className="touch-target flex-shrink-0 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap outline-none border-0"
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
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([])
  const [servicesMap, setServicesMap] = useState<Record<string, { name: string; price?: number }>>({})
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [showDonePriceModalForId, setShowDonePriceModalForId] = useState<string | null>(null)
  const [donePriceInputGrn, setDonePriceInputGrn] = useState<number | ''>('')
  const [donePriceServiceName, setDonePriceServiceName] = useState('')
  const [donePriceSaving, setDonePriceSaving] = useState(false)

  useEffect(() => {
    if (isOpen && businessId) {
      loadNotifications()
    }
  }, [isOpen, businessId])

  useEffect(() => {
    if (showDonePriceModalForId) {
      setDonePriceInputGrn('')
      const apt = appointments.find((a) => a.id === showDonePriceModalForId)
      setDonePriceServiceName(apt?.customServiceName?.trim() ?? '')
    }
  }, [showDonePriceModalForId, appointments])

  const loadNotifications = async () => {
    setLoading(true)
    try {
      const [appointmentsRes, mastersRes, servicesRes, changeReqRes] = await Promise.all([
        fetch(`/api/appointments?businessId=${businessId}&status=Pending`),
        fetch(`/api/masters?businessId=${businessId}`),
        fetch(`/api/services?businessId=${businessId}`),
        fetch(`/api/appointment-change-requests?businessId=${businessId}&status=PENDING`),
      ])
      if (!appointmentsRes.ok) throw new Error('Failed to fetch appointments')
      const data = await appointmentsRes.json()
      const masters = mastersRes.ok ? await mastersRes.json() : []
      const servicesList = servicesRes.ok ? await servicesRes.json() : []
      const changeReqList = changeReqRes.ok ? await changeReqRes.json() : []

      const map: Record<string, { name: string; price?: number }> = {}
      if (Array.isArray(servicesList)) {
        servicesList.forEach((s: { id: string; name: string; price?: number }) => {
          if (s?.id) map[s.id] = { name: s.name || 'Послуга', price: s.price }
        })
      }
      setServicesMap(map)

      const withMasters = (data || []).map((apt: Appointment) => {
        const master = masters.find((m: { id: string }) => m.id === apt.masterId)
        return { ...apt, masterName: master?.name || 'Невідомий спеціаліст' }
      })
      setAppointments(withMasters)
      setChangeRequests(Array.isArray(changeReqList) ? changeReqList : [])
    } catch (error) {
      console.error('Error loading appointments:', error)
      setAppointments([])
      setChangeRequests([])
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
        await loadNotifications()
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
        await loadNotifications()
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
        await loadNotifications()
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
        await loadNotifications()
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

  const count = appointments.length + changeRequests.length

  const handleRequestDecision = async (requestId: string, action: 'approve' | 'reject') => {
    setProcessing(requestId)
    try {
      const res = await fetch(`/api/appointment-change-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, action }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast({ title: action === 'approve' ? 'Запит підтверджено' : 'Запит відхилено', type: 'success' })
        await loadNotifications()
        onUpdate()
      } else {
        toast({ title: 'Помилка', description: data?.error || 'Не вдалося обробити запит', type: 'error' })
      }
    } catch (e) {
      toast({ title: 'Помилка', description: e instanceof Error ? e.message : 'Не вдалося обробити запит', type: 'error' })
    } finally {
      setProcessing(null)
    }
  }

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
                {changeRequests.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Запити від клієнтів</p>
                      <span className="text-xs text-gray-500">{changeRequests.length}</span>
                    </div>
                    {changeRequests.map((r) => {
                      const currentStart = new Date(r.appointment.startTime)
                      const currentEnd = new Date(r.appointment.endTime)
                      const reqStart = r.requestedStartTime ? new Date(r.requestedStartTime) : null
                      const reqEnd = r.requestedEndTime ? new Date(r.requestedEndTime) : null
                      const typeLabel = r.type === 'CANCEL' ? 'Скасування' : r.type === 'RESCHEDULE' ? 'Перенесення' : r.type
                      const reqBorderColor = r.status === 'PENDING' || r.status === 'Очікує' ? 'border-l-amber-500/80' : 'border-l-white/20'
                      return (
                        <article key={r.id} className={cn('rounded-2xl p-4 bg-white/[0.04] border border-white/10 outline-none border-l-4', reqBorderColor)}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate">{fixMojibake(r.appointment.clientName)}</p>
                              <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                                {r.appointment.master?.name || '—'} · {typeLabel}
                              </p>
                            </div>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 whitespace-nowrap">
                              Очікує
                            </span>
                          </div>

                          <div className="mt-3 text-[12px] text-gray-300 space-y-1">
                            <div className="flex justify-between gap-3">
                              <span className="text-gray-500">Було:</span>
                              <span className="tabular-nums text-right">
                                {format(currentStart, 'd MMM, HH:mm', { locale: uk })}–{format(currentEnd, 'HH:mm', { locale: uk })}
                              </span>
                            </div>
                            {r.type === 'RESCHEDULE' && reqStart && reqEnd ? (
                              <div className="flex justify-between gap-3">
                                <span className="text-gray-500">Просить:</span>
                                <span className="tabular-nums text-right">
                                  {format(reqStart, 'd MMM, HH:mm', { locale: uk })}–{format(reqEnd, 'HH:mm', { locale: uk })}
                                </span>
                              </div>
                            ) : null}
                            {r.clientNote ? <p className="text-[11px] text-gray-500 italic line-clamp-2">{r.clientNote}</p> : null}
                          </div>

                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleRequestDecision(r.id, 'approve')}
                              disabled={processing === r.id}
                              className="touch-target flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-gray-100 transition-colors disabled:opacity-50"
                              style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}
                            >
                              {processing === r.id ? 'Обробка...' : 'Підтвердити'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRequestDecision(r.id, 'reject')}
                              disabled={processing === r.id}
                              className="touch-target min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-medium border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-colors disabled:opacity-50"
                            >
                              Відхилити
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}

                {appointments.length > 0 && (
                  <div className="space-y-3">
                    {changeRequests.length > 0 && <div className="h-px bg-white/10" />}
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Нові бронювання</p>
                      <span className="text-xs text-gray-500">{appointments.length}</span>
                    </div>
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
                  {apt ? `${fixMojibake(apt.clientName)} · ${format(new Date(apt.startTime), 'd MMM, HH:mm', { locale: uk })}` : 'Запис'}
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

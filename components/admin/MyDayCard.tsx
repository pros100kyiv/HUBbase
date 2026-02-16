'use client'

import React, { useState, useRef, useEffect } from 'react'
import { format, addDays, subDays, isSameDay, startOfDay } from 'date-fns'
import { uk } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { ModalPortal } from '@/components/ui/modal-portal'
import { ClockIcon, UserIcon } from '@/components/icons'
import { StatusSwitcher, type StatusValue } from './StatusSwitcher'
import { toast } from '@/components/ui/toast'
import { cn, fixMojibake } from '@/lib/utils'
import { normalizeUaPhone } from '@/lib/utils/phone'
import { VisitHistorySections, type VisitHistoryItem, type VisitTone } from '@/components/admin/VisitHistorySections'

interface Appointment {
  id: string
  clientName: string
  clientPhone: string
  startTime: string
  endTime: string
  status: string
  masterName?: string
  services?: string
  customServiceName?: string | null
  customPrice?: number | null
  procedureDone?: string | null
  notes?: string | null
  isFromBooking?: boolean
}

export interface MyDayCardProps {
  businessId: string | undefined
  appointments: Appointment[]
  totalAppointments: number
  completedAppointments: number
  pendingAppointments: number
  confirmedAppointments: number
  totalRevenue?: number
  onBookAppointment?: () => void
  /** Вибір вільного слота: дата + час (HH:mm) + опційно masterId для переходу на запис */
  onBookSlot?: (date: Date, time: string, masterId?: string) => void
  /** Відкрити модалку «Вільні години» (рендериться на батьківській сторінці) */
  onOpenFreeSlots?: (date: Date) => void
  selectedDate?: Date
  onDateChange?: (date: Date) => void
  onRefresh?: () => void
}

export function MyDayCard({
  businessId,
  appointments,
  totalAppointments,
  completedAppointments,
  pendingAppointments,
  confirmedAppointments,
  totalRevenue = 0,
  onBookAppointment,
  onBookSlot,
  onOpenFreeSlots,
  selectedDate: externalSelectedDate,
  onDateChange,
  onRefresh,
}: MyDayCardProps) {
  const router = useRouter()
  const [internalSelectedDate, setInternalSelectedDate] = useState(() => startOfDay(new Date()))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const [shareFeedback, setShareFeedback] = useState<'share' | 'unsupported' | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'confirmed' | 'done' | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [servicesList, setServicesList] = useState<Array<{ id: string; name: string; price?: number }>>([])
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [postVisitProcedureDone, setPostVisitProcedureDone] = useState('')
  const [postVisitCustomPriceGrn, setPostVisitCustomPriceGrn] = useState<number | ''>('')
  const [postVisitSaving, setPostVisitSaving] = useState(false)
  /** Відкрити модалку «Вказати вартість» перед перемиканням на Виконано (id запису) */
  const [showDonePriceModalForId, setShowDonePriceModalForId] = useState<string | null>(null)
  const [donePriceInputGrn, setDonePriceInputGrn] = useState<number | ''>('')
  const [donePriceServiceName, setDonePriceServiceName] = useState('')
  const [donePriceSaving, setDonePriceSaving] = useState(false)

  /** Профіль клієнта з API (за телефоном) для вікна «Інформація про клієнта» */
  interface ClientProfile {
    id: string
    name: string
    phone: string
    email?: string | null
    notes?: string | null
    status?: string | null
    totalAppointments: number
    totalSpent: number
    lastAppointmentDate?: string | null
    appointments?: Array<{ id: string; startTime: string; endTime: string; status: string; masterId?: string; customServiceName?: string | null; services?: string | null }>
  }
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null)
  const [clientProfileLoading, setClientProfileLoading] = useState(false)

  /** Вікно «Історія клієнта»: повний профіль + усі записи */
  interface ClientHistoryAppointment {
    id: string
    startTime: string
    endTime: string
    status: string
    services?: string | null
    customServiceName?: string | null
    customPrice?: number | null
    master?: { id: string; name: string } | null
  }
  interface ClientHistoryData {
    id: string
    name: string
    phone: string
    email?: string | null
    notes?: string | null
    status?: string | null
    totalAppointments: number
    totalSpent: number
    appointments: ClientHistoryAppointment[]
  }
  const [showClientHistoryModal, setShowClientHistoryModal] = useState(false)
  const [clientHistoryData, setClientHistoryData] = useState<ClientHistoryData | null>(null)
  const [clientHistoryLoading, setClientHistoryLoading] = useState(false)

  useEffect(() => {
    if (selectedAppointment) {
      setPostVisitProcedureDone(selectedAppointment.procedureDone ?? '')
      setPostVisitCustomPriceGrn(
        selectedAppointment.customPrice != null && selectedAppointment.customPrice > 0
          ? Math.round(selectedAppointment.customPrice / 100)
          : ''
      )
    }
  }, [selectedAppointment?.id, selectedAppointment?.procedureDone, selectedAppointment?.customPrice])

  useEffect(() => {
    if (showDonePriceModalForId) {
      setDonePriceInputGrn('')
      const apt = appointments.find((a) => a.id === showDonePriceModalForId)
      setDonePriceServiceName(apt?.customServiceName?.trim() ?? '')
    }
  }, [showDonePriceModalForId, appointments])

  useEffect(() => {
    if (!businessId) return
    fetch(`/api/services?businessId=${businessId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setServicesList(Array.isArray(data) ? data : []))
      .catch(() => setServicesList([]))
  }, [businessId])

  // Завантажити профіль клієнта при відкритті вікна запису (за телефоном)
  useEffect(() => {
    if (!selectedAppointment?.clientPhone || !businessId) {
      setClientProfile(null)
      return
    }
    setClientProfileLoading(true)
    setClientProfile(null)
    const phone = normalizeUaPhone(selectedAppointment.clientPhone)
    if (!phone) {
      setClientProfileLoading(false)
      return
    }
    fetch(`/api/clients?businessId=${encodeURIComponent(businessId)}&phone=${encodeURIComponent(phone)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.clients ?? [])
        const client = list[0] ?? null
        setClientProfile(client ? {
          id: client.id,
          name: client.name ?? '',
          phone: client.phone ?? '',
          email: client.email ?? null,
          notes: client.notes ?? null,
          status: client.status ?? null,
          totalAppointments: client.totalAppointments ?? 0,
          totalSpent: client.totalSpent ?? 0,
          lastAppointmentDate: client.lastAppointmentDate ?? null,
          appointments: client.appointments ?? [],
        } : null)
      })
      .catch(() => setClientProfile(null))
      .finally(() => setClientProfileLoading(false))
  }, [selectedAppointment?.id, selectedAppointment?.clientPhone, businessId])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.targetTouches?.length > 0) {
      setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY })
    }
  }

  const handleTouchEnd = (e: React.TouchEvent, onClose: () => void) => {
    if (!touchStart || !e.changedTouches?.length) return
    const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
    
    const deltaX = touchEnd.x - touchStart.x
    const deltaY = touchEnd.y - touchStart.y
    
    // Swipe right (deltaX > 70) or swipe down (deltaY > 70)
    // Add restriction: horizontal swipe should be more horizontal than vertical, and vice versa
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 70) onClose()
    } else {
      if (deltaY > 70) onClose()
    }
    
    setTouchStart(null)
  }

  const selectedDate = externalSelectedDate
    ? startOfDay(externalSelectedDate)
    : internalSelectedDate
  const isToday = isSameDay(selectedDate, new Date())

  /** Записи тільки для вибраного дня (за календарною датою). Якщо startTime відсутній або невалідний — не відкидаємо запис, щоб не втрачати дані */
  const appointmentsForSelectedDay = appointments.filter((apt) => {
    if (apt.startTime == null || apt.startTime === '') return true
    try {
      const start = new Date(apt.startTime)
      if (Number.isNaN(start.getTime())) return true
      return isSameDay(start, selectedDate)
    } catch {
      return true
    }
  })
  const totalForDay = appointmentsForSelectedDay.length
  const completedForDay = appointmentsForSelectedDay.filter(
    (apt) => apt.status === 'Done' || apt.status === 'Виконано'
  ).length
  const pendingForDay = appointmentsForSelectedDay.filter(
    (apt) => apt.status === 'Pending' || apt.status === 'Очікує'
  ).length
  const confirmedForDay = appointmentsForSelectedDay.filter(
    (apt) => apt.status === 'Confirmed' || apt.status === 'Підтверджено'
  ).length
  
  const handleDateChange = (newDate: Date) => {
    const normalized = startOfDay(newDate)
    if (onDateChange) {
      onDateChange(normalized)
    } else {
      setInternalSelectedDate(normalized)
    }
  }

  const handlePreviousDay = () => {
    handleDateChange(subDays(selectedDate, 1))
  }

  const handleNextDay = () => {
    handleDateChange(addDays(selectedDate, 1))
  }

  const handleToday = () => {
    handleDateChange(startOfDay(new Date()))
  }
  
  const handleBookAppointment = () => {
    if (onBookAppointment) {
      onBookAppointment()
    } else {
      router.push('/dashboard/appointments?create=true')
    }
  }

  const handleAppointmentClick = (id: string) => {
    const apt = appointmentsForSelectedDay.find((a) => a.id === id) ?? appointments.find((a) => a.id === id) ?? null
    setSelectedAppointment(apt)
  }

  /** Відкрити картку (профіль) клієнта на сторінці клієнтів */
  const openClientProfile = (phone: string) => {
    if (clientProfile?.id) {
      router.push(`/dashboard/clients?id=${encodeURIComponent(clientProfile.id)}`)
    } else {
      router.push(`/dashboard/clients?phone=${encodeURIComponent(phone)}`)
    }
  }

  const openClientHistory = (phone: string) => {
    if (clientProfile?.id && businessId) {
      setShowClientHistoryModal(true)
      setClientHistoryData(null)
      setClientHistoryLoading(true)
      fetch(`/api/clients/${clientProfile.id}?businessId=${encodeURIComponent(businessId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.appointments) {
            setClientHistoryData({
              id: data.id,
              name: data.name ?? '',
              phone: data.phone ?? '',
              email: data.email ?? null,
              notes: data.notes ?? null,
              status: data.status ?? null,
              totalAppointments: data.totalAppointments ?? 0,
              totalSpent: data.totalSpent ?? 0,
              appointments: data.appointments ?? [],
            })
          } else {
            setClientHistoryData(null)
          }
        })
        .catch(() => setClientHistoryData(null))
        .finally(() => setClientHistoryLoading(false))
    } else {
      router.push(`/dashboard/clients?phone=${encodeURIComponent(phone)}`)
    }
  }

  const parseServices = (services?: string) => {
    if (!services) return []
    try {
      const parsed = JSON.parse(services)
      if (Array.isArray(parsed)) return parsed
      return [parsed]
    } catch {
      return [services]
    }
  }

  /** Повертає масив назв послуг за JSON-рядком з масивом ID послуг або customServiceName */
  const getServiceNamesList = (servicesJson?: string | null, customServiceName?: string | null): string[] => {
    const ids = parseServices(servicesJson ?? undefined) as string[]
    if (ids.length > 0) {
      return ids.map((id) => {
        const service = servicesList.find((s) => s.id === id)
        return service ? service.name : id
      })
    }
    if (customServiceName && customServiceName.trim()) return [customServiceName.trim()]
    return []
  }

  /** Сума за запис: customPrice (копійки) / 100 або сума цін послуг */
  const getDisplayPrice = (apt: Appointment): number | null => {
    if (apt.customPrice != null && apt.customPrice > 0) return Math.round(apt.customPrice / 100)
    const ids = parseServices(apt.services ?? undefined) as string[]
    if (ids.length === 0) return null
    let sum = 0
    for (const id of ids) {
      const s = servicesList.find((x) => x.id === id)
      if (s?.price != null && s.price > 0) sum += s.price
    }
    return sum > 0 ? sum : null
  }

  /** Дохід за день — тільки з виконаних записів (статус Виконано) */
  const dayTotalRevenue = appointmentsForSelectedDay
    .filter(apt => apt.status === 'Done' || apt.status === 'Виконано')
    .reduce((acc, apt) => {
      const p = getDisplayPrice(apt)
      return acc + (p ?? 0)
    }, 0)

  const getDaySummaryText = () => {
    const dateLabel = isToday ? 'Сьогодні' : format(selectedDate, 'd MMMM yyyy', { locale: uk })
    let text = `Мій день — ${dateLabel}\nЗаписів: ${totalForDay} (підтверджено: ${confirmedForDay}, очікує: ${pendingForDay}, виконано: ${completedForDay})`
    if (dayTotalRevenue > 0) text += `\nДохід за день (виконано): ${dayTotalRevenue} грн`
    if (appointmentsForSelectedDay.length > 0) {
      text += '\n\nЗаписи:\n'
      appointmentsForSelectedDay.forEach((apt) => {
        const start = format(new Date(apt.startTime), 'HH:mm')
        const end = format(new Date(apt.endTime), 'HH:mm')
        text += `• ${fixMojibake(apt.clientName)} ${start}–${end} — ${apt.status}\n`
      })
    }
    return text
  }

  const handleShare = async () => {
    const text = getDaySummaryText()
    const title = `Мій день — ${format(selectedDate, 'd MMMM yyyy', { locale: uk })}`
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title,
          text,
        })
        setShareFeedback('share')
      } else {
        setShareFeedback('unsupported')
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setShareFeedback('unsupported')
    }
    setTimeout(() => setShareFeedback(null), 2000)
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showMenu])

  const getStatusLabel = (status: string, isFromBooking?: boolean) => {
    if ((status === 'Pending' || status === 'Очікує') && !isFromBooking) return 'Підтверджено'
    switch (status) {
      case 'Done': return 'Виконано'
      case 'Pending': return 'Очікує'
      case 'Confirmed': return 'Підтверджено'
      case 'Cancelled': return 'Скасовано'
      default: return status
    }
  }

  const getStatusColor = (status: string, isFromBooking?: boolean) => {
    if ((status === 'Pending' || status === 'Очікує') && !isFromBooking) return 'bg-green-500/20 text-green-400 border-green-500/50'
    switch (status) {
      case 'Confirmed':
      case 'Підтверджено':
        return 'bg-green-500/20 text-green-400 border-green-500/50'
      case 'Pending':
      case 'Очікує':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      case 'Done':
      case 'Виконано':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
      case 'Cancelled':
      case 'Скасовано':
        return 'bg-red-500/20 text-red-400 border-red-500/50'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
    }
  }

  const toTone = (status: string): VisitTone => {
    const s = String(status || '')
    if (s === 'Done' || s === 'Виконано') return 'done'
    if (s === 'Confirmed' || s === 'Підтверджено') return 'confirmed'
    if (s === 'Pending' || s === 'Очікує') return 'pending'
    if (s === 'Cancelled' || s === 'Скасовано') return 'cancelled'
    return 'other'
  }

  const getFilteredAppointments = (type: 'pending' | 'confirmed' | 'done') => {
    return appointmentsForSelectedDay.filter(apt => {
      const status = apt.status
      switch (type) {
        case 'pending':
          return status === 'Pending' || status === 'Очікує'
        case 'confirmed':
          return status === 'Confirmed' || status === 'Підтверджено'
        case 'done':
          return status === 'Done' || status === 'Виконано'
        default:
          return false
      }
    })
  }

  const handleMarkDone = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!businessId) return

    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId,
          status: 'Done',
        }),
      })

      if (res.ok && onRefresh) {
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to mark appointment as done:', error)
    }
  }

  const handleConfirm = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!businessId) return

    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId,
          status: 'Confirmed',
        }),
      })

      if (res.ok && onRefresh) {
        onRefresh()
      }
    } catch (error) {
      console.error('Failed to confirm appointment:', error)
    }
  }

  const handleStatusChange = async (id: string, status: StatusValue) => {
    if (!businessId) return
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, status }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        if (selectedAppointment?.id === id) {
          setSelectedAppointment((prev) => prev ? { ...prev, status } : null)
        }
        onRefresh?.()
        toast({ title: 'Статус оновлено', type: 'success' })
      } else {
        toast({ title: 'Помилка', description: data?.error || 'Не вдалося оновити статус', type: 'error' })
      }
    } catch (error) {
      console.error('Failed to update status:', error)
      toast({ title: 'Помилка', description: 'Не вдалося оновити статус', type: 'error' })
    }
  }

  const handleDoneWithPriceSubmit = async () => {
    if (!businessId || !showDonePriceModalForId) return
    const grn = donePriceInputGrn === '' ? NaN : Number(donePriceInputGrn)
    if (Number.isNaN(grn) || grn < 0) {
      toast({ title: 'Вкажіть вартість', type: 'error' })
      return
    }
    setDonePriceSaving(true)
    try {
      const res = await fetch(`/api/appointments/${showDonePriceModalForId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          status: 'Done',
          customPrice: Math.round(grn * 100),
          ...(donePriceServiceName.trim() && { customServiceName: donePriceServiceName.trim() }),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        if (selectedAppointment?.id === showDonePriceModalForId) {
          setSelectedAppointment((prev) => prev ? { ...prev, status: 'Done', customPrice: Math.round(grn * 100) } : null)
        }
        setShowDonePriceModalForId(null)
        onRefresh?.()
        toast({ title: 'Вартість збережено, статус: Виконано', type: 'success' })
      } else {
        toast({ title: 'Помилка', description: data?.error || 'Не вдалося зберегти', type: 'error' })
      }
    } catch (error) {
      console.error('Done with price failed:', error)
      toast({ title: 'Помилка', description: 'Не вдалося зберегти', type: 'error' })
    } finally {
      setDonePriceSaving(false)
    }
  }

  const isCostAfterProcedure = (apt: Appointment) => {
    const hasPrice = apt.customPrice != null && apt.customPrice > 0
    if (hasPrice) return false
    const hasCustom = apt.customServiceName?.trim()
    try {
      const ids = apt.services ? JSON.parse(apt.services) : []
      const noServices = Array.isArray(ids) && ids.length === 0
      return Boolean(hasCustom || noServices)
    } catch {
      return Boolean(hasCustom)
    }
  }

  const handleSavePostVisit = async () => {
    if (!businessId || !selectedAppointment) return
    setPostVisitSaving(true)
    try {
      const res = await fetch(`/api/appointments/${selectedAppointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          procedureDone: postVisitProcedureDone.trim() || null,
          customPrice:
            postVisitCustomPriceGrn !== '' && Number(postVisitCustomPriceGrn) >= 0
              ? Number(postVisitCustomPriceGrn) * 100
              : null,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      const updated = await res.json()
      setSelectedAppointment({ ...selectedAppointment, ...updated, masterName: updated.master?.name ?? selectedAppointment.masterName })
      if (onRefresh) onRefresh()
    } catch (e) {
      console.error('Save post-visit failed:', e)
    } finally {
      setPostVisitSaving(false)
    }
  }

  const AppointmentItem = ({ apt, onClick }: { apt: Appointment; onClick: () => void }) => {
    const startTime = new Date(apt.startTime)
    const endTime = new Date(apt.endTime)
    const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / 60000)
    const isDone = apt.status === 'Done' || apt.status === 'Виконано'
    const isPending = apt.status === 'Pending' || apt.status === 'Очікує'
    const isConfirmed = apt.status === 'Confirmed' || apt.status === 'Підтверджено'
    const serviceNames = getServiceNamesList(apt.services, apt.customServiceName)
    const displayPrice = getDisplayPrice(apt)
    const statusBorderColor =
      isDone ? 'border-l-sky-500/80' :
      isConfirmed ? 'border-l-emerald-500/80' :
      isPending ? 'border-l-amber-500/80' : 'border-l-rose-500/70'
    const statusLabel = getStatusLabel(apt.status, apt.isFromBooking === true)
    const serviceDisplay =
      serviceNames.length > 0
        ? serviceNames.join(', ')
        : (apt.customServiceName?.trim() ? apt.customServiceName.trim() : 'Послуги не вказані')

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
        className={cn(
          'w-full text-left bg-transparent hover:bg-white/[0.06] transition-colors',
          'px-3 py-2.5 touch-manipulation cursor-pointer',
          'border-l-4',
          statusBorderColor
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-white tabular-nums">
                {format(startTime, 'HH:mm')}–{format(endTime, 'HH:mm')}
              </span>
              <span className="text-[11px] text-gray-500 tabular-nums">
                {durationMin} хв
              </span>
              <span className="text-gray-700">·</span>
              <span className="text-[11px] text-gray-400 truncate">
                {apt.masterName || 'Невідомий спеціаліст'}
              </span>
              <span className="text-gray-700">·</span>
              <span className="text-[11px] text-gray-400">
                {statusLabel}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-white truncate">
                {fixMojibake(apt.clientName)}
              </span>
              {apt.clientPhone && (
                <a
                  href={`tel:${apt.clientPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-emerald-400 hover:text-emerald-300 transition-colors p-1 -m-1 touch-manipulation flex-shrink-0"
                  aria-label="Зателефонувати"
                  title={apt.clientPhone}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </a>
              )}
            </div>

            <div className="mt-1.5 text-[11px] text-gray-300 truncate">
              {serviceDisplay}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {displayPrice != null && (
              <div className="text-sm font-semibold text-emerald-400 tabular-nums">
                {displayPrice} грн
              </div>
            )}
            <StatusSwitcher
              status={apt.status}
              isFromBooking={apt.isFromBooking === true}
              onStatusChange={handleStatusChange}
              appointmentId={apt.id}
              size="sm"
              customPrice={apt.customPrice}
              hasServicesFromPriceList={(parseServices(apt.services) as string[]).length > 0}
              onDoneWithoutPrice={(id) => {
                toast({
                  title: 'Статус не змінено',
                  description: 'Щоб позначити запис як Виконано, спочатку вкажіть вартість послуги в формі нижче.',
                  type: 'info',
                  duration: 4000,
                })
                setShowDonePriceModalForId(id)
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  const dateDisplayShort = isToday ? 'Сьогодні' : format(selectedDate, 'EEE, d MMM', { locale: uk })

  return (
    <div className="rounded-2xl p-4 md:p-6 card-floating text-white border border-white/10 overflow-hidden min-w-0">
      {/* Дата */}
      <div className="flex items-center gap-2 mb-4 md:mb-5 p-3 md:p-3.5 rounded-xl bg-white/5 border border-white/10">
        <button
          onClick={handlePreviousDay}
          className="touch-target p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center active:scale-95 flex-shrink-0"
          aria-label="Попередній день"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => setShowDatePicker(true)}
          className="flex-1 min-w-0 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white"
        >
          <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm md:text-base font-medium truncate capitalize tabular-nums" suppressHydrationWarning>
            {dateDisplayShort}
          </span>
        </button>
        <button
          onClick={handleNextDay}
          className="touch-target p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center active:scale-95 flex-shrink-0"
          aria-label="Наступний день"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {!isToday && (
          <button
            onClick={handleToday}
            className="px-3 py-2 text-xs font-medium bg-white/10 hover:bg-white/15 rounded-lg transition-colors text-white whitespace-nowrap flex-shrink-0"
          >
            Сьогодні
          </button>
        )}
      </div>

      {/* Статистика за день: flex-wrap щоб картки переносились і завжди поміщались */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 md:gap-3 mb-3 md:mb-5 min-w-0">
        <div className="rounded-lg sm:rounded-xl bg-white/5 border border-white/10 p-2 sm:p-3 flex-1 min-w-[85px] shrink-0">
          <div className="text-base sm:text-lg md:text-xl font-bold text-white tabular-nums leading-tight">{totalForDay}</div>
          <div className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 mt-0.5 leading-tight">Записів</div>
        </div>
        <button
          type="button"
          onClick={() => setSelectedStatus('confirmed')}
          className="rounded-lg sm:rounded-xl bg-white/5 border border-white/10 p-2 sm:p-3 hover:bg-white/10 transition-colors text-left active:scale-[0.98] flex-1 min-w-[85px] shrink-0"
        >
          <div className="text-base sm:text-lg md:text-xl font-bold text-emerald-400 tabular-nums leading-tight">{confirmedForDay}</div>
          <div className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 mt-0.5 leading-tight">Підтверджено</div>
        </button>
        <button
          type="button"
          onClick={() => setSelectedStatus('pending')}
          className="rounded-lg sm:rounded-xl bg-white/5 border border-white/10 p-2 sm:p-3 hover:bg-white/10 transition-colors text-left active:scale-[0.98] flex-1 min-w-[85px] shrink-0"
        >
          <div className="text-base sm:text-lg md:text-xl font-bold text-amber-400 tabular-nums leading-tight">{pendingForDay}</div>
          <div className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 mt-0.5 leading-tight">Очікує</div>
        </button>
        <button
          type="button"
          onClick={() => setSelectedStatus('done')}
          className="rounded-lg sm:rounded-xl bg-white/5 border border-white/10 p-2 sm:p-3 hover:bg-white/10 transition-colors text-left active:scale-[0.98] flex-1 min-w-[85px] shrink-0"
        >
          <div className="text-base sm:text-lg md:text-xl font-bold text-sky-400 tabular-nums leading-tight">{completedForDay}</div>
          <div className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 mt-0.5 leading-tight">Виконано</div>
        </button>
        <button
          type="button"
          onClick={() => onOpenFreeSlots?.(selectedDate)}
          className="rounded-lg sm:rounded-xl bg-white/5 border border-white/10 p-2 sm:p-3 hover:bg-white/10 transition-colors text-left active:scale-[0.98] flex-1 min-w-[85px] shrink-0 flex items-center gap-2"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs sm:text-sm font-semibold text-white">Вільні години</div>
            <div className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5">Переглянути слоти</div>
          </div>
        </button>
      </div>

      {/* Список записів */}
      {appointmentsForSelectedDay.length > 0 ? (
        <div className="space-y-2 mb-3 md:mb-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm md:text-base font-semibold text-white flex items-center gap-2">
              {isToday ? 'Записи на сьогодні' : `Записи на ${format(selectedDate, 'd MMMM', { locale: uk })}`}
              <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-md bg-white/10 text-xs font-medium text-gray-300 tabular-nums">
                {totalForDay}
              </span>
            </h3>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all active:scale-[0.95] flex-shrink-0"
              aria-label={isExpanded ? 'Згорнути список' : 'Розгорнути список'}
              title={isExpanded ? 'Згорнути' : 'Розгорнути'}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <div
            className={`space-y-1.5 md:space-y-2 transition-all duration-300 pr-1 ${
              isExpanded ? '' : 'max-h-48 md:max-h-64 overflow-y-auto scrollbar-hide'
            }`}
          >
            <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden divide-y divide-white/10">
              {appointmentsForSelectedDay
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                .map((apt) => (
                  <AppointmentItem
                    key={apt.id}
                    apt={apt}
                    onClick={() => handleAppointmentClick(apt.id)}
                  />
                ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 px-4 rounded-xl bg-white/5 border border-white/10 border-dashed">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400 mb-1">
            {isToday ? 'На сьогодні записів немає' : `На ${format(selectedDate, 'd MMMM', { locale: uk })} записів немає`}
          </p>
          <p className="text-xs text-gray-500 mb-5">Додайте запис, щоб планувати день</p>
          <button
            type="button"
            onClick={handleBookAppointment}
            className="px-5 py-2.5 bg-white text-black rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors active:scale-[0.98] shadow-lg shadow-black/20"
          >
            Записати
          </button>
        </div>
      )}

      {/* Підсумок доходу після списку — компактно, тільки якщо є виконані */}
      {appointmentsForSelectedDay.length > 0 && dayTotalRevenue > 0 && (
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-sm">
          <span className="text-gray-400">Дохід за день</span>
          <span className="font-semibold text-emerald-400 tabular-nums">{dayTotalRevenue} грн</span>
        </div>
      )}

      {/* Модалка за статусом: Підтверджено / Очікує / Виконано */}
      {selectedStatus && (() => {
        const filtered = getFilteredAppointments(selectedStatus)
        const statusConfig = {
          pending: { title: 'Очікують підтвердження', label: 'Очікує', accent: 'amber', iconBg: 'bg-amber-500/20', iconColor: 'text-amber-400', borderColor: 'border-amber-500/40' },
          confirmed: { title: 'Підтверджені записи', label: 'Підтверджено', accent: 'emerald', iconBg: 'bg-emerald-500/20', iconColor: 'text-emerald-400', borderColor: 'border-emerald-500/40' },
          done: { title: 'Виконані записи', label: 'Виконано', accent: 'sky', iconBg: 'bg-sky-500/20', iconColor: 'text-sky-400', borderColor: 'border-sky-500/40' },
        }
        const config = statusConfig[selectedStatus]
        return (
          <ModalPortal>
            <div className="modal-overlay sm:!p-4" onClick={() => setSelectedStatus(null)}>
              <div
                className="relative w-[95%] sm:w-full sm:max-w-md sm:my-auto modal-content modal-dialog text-white max-h-[90dvh] flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={handleTouchStart}
                onTouchEnd={(e) => handleTouchEnd(e, () => setSelectedStatus(null))}
              >
                <button
                  type="button"
                  onClick={() => setSelectedStatus(null)}
                  className="modal-close touch-target text-gray-400 hover:text-white rounded-full"
                  aria-label="Закрити"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {/* Шапка з акцентом по статусу */}
                <div className={`pr-10 flex-shrink-0 pb-4 border-b border-white/10 border-l-4 ${config.borderColor}`}>
                  <div className="flex items-center gap-3 pl-1">
                    <div className={`w-10 h-10 rounded-xl ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
                      {selectedStatus === 'pending' && (
                        <svg className={`w-5 h-5 ${config.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {selectedStatus === 'confirmed' && (
                        <svg className={`w-5 h-5 ${config.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {selectedStatus === 'done' && (
                        <svg className={`w-5 h-5 ${config.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-bold text-white truncate" style={{ letterSpacing: '-0.02em' }}>
                        {config.title}
                      </h2>
                      <p className="text-sm text-gray-400 mt-0.5">
                        {filtered.length === 0
                          ? 'Немає записів'
                          : `${filtered.length} ${filtered.length === 1 ? 'запис' : filtered.length < 5 ? 'записи' : 'записів'}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Список записів або пустий стан */}
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide py-4">
                  {filtered.length > 0 ? (
                    <div className="px-4">
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden divide-y divide-white/10">
                      {filtered.map((apt) => (
                        <AppointmentItem
                          key={apt.id}
                          apt={apt}
                          onClick={() => {
                            setSelectedStatus(null)
                            handleAppointmentClick(apt.id)
                          }}
                        />
                      ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                      <div className={`w-14 h-14 rounded-2xl ${config.iconBg} flex items-center justify-center mb-4`}>
                        {selectedStatus === 'pending' && (
                          <svg className={`w-7 h-7 ${config.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {selectedStatus === 'confirmed' && (
                          <svg className={`w-7 h-7 ${config.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {selectedStatus === 'done' && (
                          <svg className={`w-7 h-7 ${config.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-300 mb-1">
                        У категорії «{config.label}» записів немає
                      </p>
                      <p className="text-xs text-gray-500">
                        {selectedStatus === 'pending' && 'Записи зі статусом «Очікує» з\'являться тут'}
                        {selectedStatus === 'confirmed' && 'Підтверджені записи з\'являться тут'}
                        {selectedStatus === 'done' && 'Виконані записи з\'являться тут'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ModalPortal>
        )
      })()}

      {/* Модалка запису — деталі клієнта */}
      {selectedAppointment && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => setSelectedAppointment(null)}>
            <div
              className="relative w-[95%] sm:w-full sm:max-w-md sm:my-auto modal-content modal-dialog text-white max-h-[90dvh] flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleTouchStart}
              onTouchEnd={(e) => handleTouchEnd(e, () => setSelectedAppointment(null))}
            >
              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="modal-close touch-target rounded-full"
                aria-label="Закрити"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Заголовок вікна: Інформація про клієнта */}
              <div className="pr-10 flex-shrink-0 pb-3 border-b border-white/10">
                <h2 className="text-base font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
                  Інформація про клієнта
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Деталі клієнта та поточний запис</p>
              </div>

              {/* Контент: профіль клієнта + запис */}
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide py-4 space-y-3">
                {/* Клієнт + цей запис — один компактний блок */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                  <div className="p-3 flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0 text-lg font-bold text-white">
                      {fixMojibake(clientProfile?.name || selectedAppointment.clientName).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white truncate">
                          {fixMojibake(clientProfile?.name ?? selectedAppointment.clientName)}
                        </h3>
                        {selectedAppointment.clientPhone && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openClientProfile(selectedAppointment.clientPhone) }}
                            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors touch-target"
                            title="Відкрити профіль клієнта"
                            aria-label="Відкрити профіль клієнта"
                          >
                            <UserIcon className="w-5 h-5" />
                          </button>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                        {selectedAppointment.clientPhone && (
                          <a
                            href={`tel:${selectedAppointment.clientPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm font-mono text-emerald-400 hover:text-emerald-300 transition-colors inline-flex items-center gap-1.5"
                            title="Зателефонувати"
                          >
                            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {selectedAppointment.clientPhone}
                          </a>
                        )}
                        {clientProfile?.email && (
                          <span className="text-xs text-gray-500 truncate">{clientProfile.email}</span>
                        )}
                        {clientProfileLoading && (
                          <span className="text-xs text-gray-500">Завантаження…</span>
                        )}
                      </div>

                      {!clientProfileLoading && clientProfile && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {clientProfile.status && clientProfile.status !== 'new' && (
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-[11px] font-medium border',
                              clientProfile.status === 'vip' && 'bg-amber-500/15 text-amber-200 border-amber-400/30',
                              clientProfile.status === 'regular' && 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
                              clientProfile.status === 'inactive' && 'bg-white/10 text-gray-200 border-white/20',
                              clientProfile.status === 'new' && 'bg-white/10 text-gray-200 border-white/20'
                            )}>
                              {clientProfile.status === 'vip' ? 'VIP' : clientProfile.status === 'regular' ? 'Постійний' : clientProfile.status === 'inactive' ? 'Неактивний' : 'Новий'}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-gray-300">
                            Візитів: <span className="font-semibold text-purple-300 tabular-nums">{clientProfile.totalAppointments}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-gray-300">
                            Зароблено: <span className="font-semibold text-purple-300 tabular-nums">{Math.round(clientProfile.totalSpent / 100)} грн</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-white/10 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-white tabular-nums">
                            {format(new Date(selectedAppointment.startTime), 'HH:mm')}–{format(new Date(selectedAppointment.endTime), 'HH:mm')}
                          </span>
                          <span className="text-[11px] text-gray-400 truncate">
                            {selectedAppointment.masterName || '—'}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {getStatusLabel(selectedAppointment.status, selectedAppointment.isFromBooking === true)}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-gray-300 truncate">
                          {getServiceNamesList(selectedAppointment.services, selectedAppointment.customServiceName).length > 0
                            ? getServiceNamesList(selectedAppointment.services, selectedAppointment.customServiceName).join(', ')
                            : (selectedAppointment.customServiceName?.trim() || 'Послуги не вказані')}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {getDisplayPrice(selectedAppointment) != null && (
                          <div className="text-sm font-semibold text-emerald-400 tabular-nums">
                            {getDisplayPrice(selectedAppointment)} грн
                          </div>
                        )}
                        <StatusSwitcher
                          status={selectedAppointment.status}
                          isFromBooking={selectedAppointment.isFromBooking === true}
                          onStatusChange={handleStatusChange}
                          appointmentId={selectedAppointment.id}
                          size="sm"
                          customPrice={selectedAppointment.customPrice}
                          hasServicesFromPriceList={(parseServices(selectedAppointment.services) as string[]).length > 0}
                          onDoneWithoutPrice={(id) => {
                            toast({
                              title: 'Статус не змінено',
                              description: 'Щоб позначити запис як Виконано, спочатку вкажіть вартість послуги в формі нижче.',
                              type: 'info',
                              duration: 4000,
                            })
                            setShowDonePriceModalForId(id)
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Минулі візити (якщо є профіль з історією) */}
                {!clientProfileLoading && clientProfile?.appointments && clientProfile.appointments.length > 0 && (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Минулі візити</p>
                    <div className="max-h-56 overflow-y-auto pr-1 scrollbar-hide">
                      <VisitHistorySections
                        items={clientProfile.appointments
                          .filter((a) => a.id !== selectedAppointment.id)
                          .slice(0, 8)
                          .map((a): VisitHistoryItem => {
                            const serviceNames = getServiceNamesList(a.services, a.customServiceName)
                            return {
                              id: String(a.id),
                              startTime: a.startTime,
                              endTime: a.endTime,
                              statusLabel: getStatusLabel(a.status, false),
                              tone: toTone(String(a.status)),
                              masterName: null,
                              services: serviceNames,
                              amountGrn: null,
                            }
                          })}
                        emptyText="Немає минулих візитів"
                      />
                    </div>
                  </div>
                )}

                {/* Нотатки клієнта з профілю */}
                {!clientProfileLoading && clientProfile?.notes && (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">Нотатки про клієнта</p>
                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{clientProfile.notes}</p>
                  </div>
                )}

                {/* Контакт виніс в шапку (посилання tel:), копіювання номера прибрано */}

                {selectedAppointment.procedureDone && (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">Що зроблено після візиту</p>
                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{selectedAppointment.procedureDone}</p>
                  </div>
                )}

                {isCostAfterProcedure(selectedAppointment) && (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-3">
                    <p className="text-xs font-medium text-gray-300">Після візиту</p>
                    <label className="block">
                      <span className="block text-[10px] text-gray-500 mb-1">Що зроблено</span>
                      <textarea
                        value={postVisitProcedureDone}
                        onChange={(e) => setPostVisitProcedureDone(e.target.value)}
                        placeholder="Опишіть виконані послуги..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="block">
                        <span className="block text-[10px] text-gray-500 mb-1">Сума, грн</span>
                        <input
                          type="number"
                          min={0}
                          value={postVisitCustomPriceGrn}
                          onChange={(e) => {
                            const v = e.target.value
                            setPostVisitCustomPriceGrn(v === '' ? '' : Math.max(0, Number(v)))
                          }}
                          placeholder="0"
                          className="w-24 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSavePostVisit() }}
                        disabled={postVisitSaving}
                        className="self-end px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                      >
                        {postVisitSaving ? 'Збереження…' : 'Зберегти'}
                      </button>
                    </div>
                  </div>
                )}

                {selectedAppointment.notes && (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">Примітки</p>
                    <p className="text-sm text-gray-200 whitespace-pre-wrap">{selectedAppointment.notes}</p>
                  </div>
                )}
              </div>

              {/* Кнопки внизу */}
              <div className="pt-4 border-t border-white/10 flex gap-2 flex-shrink-0">
                {selectedAppointment.clientPhone && (
                  <button
                    type="button"
                    onClick={() => openClientHistory(selectedAppointment.clientPhone)}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm font-medium text-white hover:bg-white/15 transition-colors active:scale-[0.98] inline-flex items-center justify-center gap-2"
                  >
                    <ClockIcon className="w-4 h-4 flex-shrink-0" />
                    Історія клієнта
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/appointments?edit=${selectedAppointment.id}`)}
                  className="flex-1 px-4 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-colors active:scale-[0.98] shadow-lg shadow-black/20"
                >
                  Редагувати запис
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Вікно «Історія клієнта» — детальна історія візитів */}
      {showClientHistoryModal && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => setShowClientHistoryModal(false)}>
            <div
              className="relative w-[95%] sm:w-full sm:max-w-lg sm:my-auto modal-content modal-dialog text-white max-h-[90dvh] flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowClientHistoryModal(false)}
                className="modal-close touch-target rounded-full"
                aria-label="Закрити"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="pr-10 flex-shrink-0 pb-3 border-b border-white/10">
                <h2 className="text-lg font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
                  Історія клієнта
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Усі візити та записи</p>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide py-4 space-y-4">
                {clientHistoryLoading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}

                {!clientHistoryLoading && clientHistoryData && (
                  <>
                    <div className="rounded-xl bg-white/10 border border-white/15 p-3">
                      <h3 className="text-base font-bold text-white truncate">{clientHistoryData.name}</h3>
                      {clientHistoryData.phone && (
                        <p className="text-sm font-mono text-gray-400 mt-0.5">{clientHistoryData.phone}</p>
                      )}
                      {clientHistoryData.email && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{clientHistoryData.email}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        <span className="text-xs text-gray-500">
                          Візитів: <span className="font-semibold text-purple-400 tabular-nums">{clientHistoryData.totalAppointments}</span>
                        </span>
                        <span className="text-xs text-gray-500">
                          Зароблено: <span className="font-semibold text-purple-400 tabular-nums">{Math.round(Number(clientHistoryData.totalSpent) / 100)} грн</span>
                        </span>
                        {clientHistoryData.status && clientHistoryData.status !== 'new' && (
                          <span className={cn(
                            'px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase',
                            clientHistoryData.status === 'vip' && 'bg-amber-500/25 text-amber-200 border border-amber-400/50',
                            clientHistoryData.status === 'regular' && 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50',
                            clientHistoryData.status === 'inactive' && 'bg-gray-500/25 text-gray-300 border border-gray-400/50'
                          )}>
                            {clientHistoryData.status === 'vip' ? 'VIP' : clientHistoryData.status === 'regular' ? 'Постійний' : clientHistoryData.status === 'inactive' ? 'Неактивний' : 'Новий'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
                        Усі записи ({clientHistoryData.appointments.length})
                      </p>
                      <div className="max-h-[50vh] overflow-y-auto pr-1 scrollbar-hide">
                        <VisitHistorySections
                          items={clientHistoryData.appointments.map((apt): VisitHistoryItem => {
                            const serviceNames = getServiceNamesList(apt.services, apt.customServiceName)
                            const amountGrn =
                              apt.customPrice != null && apt.customPrice > 0 ? Math.round(Number(apt.customPrice) / 100) : null
                            return {
                              id: String(apt.id),
                              startTime: apt.startTime,
                              endTime: apt.endTime,
                              statusLabel:
                                apt.status === 'Done' || apt.status === 'Виконано'
                                  ? 'Виконано'
                                  : apt.status === 'Confirmed' || apt.status === 'Підтверджено'
                                    ? 'Підтверджено'
                                    : apt.status === 'Pending' || apt.status === 'Очікує'
                                      ? 'Очікує'
                                      : apt.status === 'Cancelled' || apt.status === 'Скасовано'
                                        ? 'Скасовано'
                                        : String(apt.status),
                              tone: toTone(String(apt.status)),
                              masterName: apt.master?.name ?? '—',
                              services: serviceNames,
                              amountGrn,
                            }
                          })}
                          emptyText="Немає записів"
                        />
                      </div>
                    </div>

                    {clientHistoryData.notes && (
                      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">Нотатки</p>
                        <p className="text-sm text-gray-200 whitespace-pre-wrap">{clientHistoryData.notes}</p>
                      </div>
                    )}
                  </>
                )}

                {!clientHistoryLoading && !clientHistoryData && (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-6 text-center">
                    <p className="text-sm text-gray-400">Не вдалося завантажити історію</p>
                    <button
                      type="button"
                      onClick={() => selectedAppointment?.clientPhone && router.push(`/dashboard/clients?phone=${encodeURIComponent(selectedAppointment.clientPhone)}`)}
                      className="mt-3 px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/15"
                    >
                      Відкрити в розділі Клієнти
                    </button>
                  </div>
                )}
              </div>

              {!clientHistoryLoading && clientHistoryData && (
                <div className="pt-4 border-t border-white/10 flex gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowClientHistoryModal(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm font-medium text-white hover:bg-white/15"
                  >
                    Закрити
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowClientHistoryModal(false)
                      router.push(`/dashboard/clients?id=${encodeURIComponent(clientHistoryData.id)}`)
                    }}
                    className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
                  >
                    Відкрити картку клієнта
                  </button>
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Модалка: вказати вартість перед перемиканням на Виконано */}
      {showDonePriceModalForId && (() => {
        const apt = appointments.find((a) => a.id === showDonePriceModalForId)
        return (
          <ModalPortal>
            <div className="modal-overlay sm:!p-4" onClick={() => setShowDonePriceModalForId(null)}>
              <div
                className="relative w-[95%] sm:w-full sm:max-w-md sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setShowDonePriceModalForId(null)}
                  className="modal-close touch-target text-gray-400 hover:text-white rounded-full"
                  aria-label="Закрити"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
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
                    <button
                      type="button"
                      onClick={() => setShowDonePriceModalForId(null)}
                      className="flex-1 px-4 py-3 rounded-xl border border-white/20 bg-white/10 text-white text-sm font-medium hover:bg-white/15"
                    >
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

      {/* Date Picker Modal — компактна ширина */}
      {showDatePicker && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => setShowDatePicker(false)}>
            <div
              className="relative w-[95%] sm:w-full sm:max-w-lg sm:my-auto modal-content modal-dialog text-white max-h-[85dvh] flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200"
              style={{ maxWidth: 'min(24rem, 95vw)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowDatePicker(false)}
                className="modal-close touch-target text-gray-400 hover:text-white rounded-full"
                aria-label="Закрити"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h3 className="modal-title pr-10 mb-2">Виберіть дату</h3>
              <div className="space-y-2 flex-1 min-h-0 overflow-y-auto scrollbar-hide">
              <input
                type="date"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => {
                  const newDate = new Date(e.target.value)
                  handleDateChange(newDate)
                  setShowDatePicker(false)
                }}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-white/20"
              />
              <button
                onClick={() => {
                  handleToday()
                  setShowDatePicker(false)
                }}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors"
              >
                Сьогодні
              </button>
            </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  )
}


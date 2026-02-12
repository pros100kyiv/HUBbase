'use client'

import React, { useState, useRef, useEffect } from 'react'
import { format, addDays, subDays, isSameDay, startOfDay } from 'date-fns'
import { uk } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { ModalPortal } from '@/components/ui/modal-portal'
import { StatusSwitcher, type StatusValue } from './StatusSwitcher'
import { toast } from '@/components/ui/toast'

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

  const openClientHistory = (phone: string) => {
    router.push(`/dashboard/clients?phone=${encodeURIComponent(phone)}`)
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
  const getServiceNamesList = (servicesJson?: string, customServiceName?: string | null): string[] => {
    const ids = parseServices(servicesJson) as string[]
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
    const ids = parseServices(apt.services) as string[]
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
        text += `• ${apt.clientName} ${start}–${end} — ${apt.status}\n`
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
    const serviceDisplay = serviceNames.length > 0 ? serviceNames.join(', ') : (apt.customServiceName?.trim() ? apt.customServiceName.trim() : 'Послуга не вказана')
    const displayPrice = getDisplayPrice(apt)
    const statusBorder =
      isDone ? 'border-l-4 border-l-sky-500' :
      isConfirmed ? 'border-l-4 border-l-emerald-500' :
      isPending ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-rose-500/70'

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
        className={`w-full text-left bg-white/5 border border-white/10 rounded-xl p-2.5 md:p-3 hover:bg-white/10 transition-all active:scale-[0.99] group relative overflow-hidden touch-manipulation cursor-pointer ${statusBorder}`}
      >
        <div className="flex flex-row items-stretch gap-2 sm:gap-3">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
            {/* Час запису — блок з табular-nums для вирівнювання */}
            <div className="flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl border border-white/15 bg-white/10 flex-shrink-0">
              <span className="text-sm font-semibold tabular-nums text-white leading-none">
                {format(startTime, 'HH:mm')}
              </span>
              <span className="text-[10px] text-gray-400 mt-1 tabular-nums">{durationMin} хв</span>
            </div>

            {/* Info + price */}
            <div className="flex-1 min-w-0 py-0.5">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <h5 className="text-sm font-bold text-white truncate leading-tight">
                  {apt.clientName}
                </h5>
                {displayPrice != null && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold border border-emerald-500/30 flex-shrink-0">
                    {displayPrice} грн
                  </span>
                )}
                {apt.clientPhone && (
                  <a
                    href={`tel:${apt.clientPhone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-gray-400 hover:text-white transition-colors p-1.5 -m-1.5 touch-manipulation"
                    aria-label="Зателефонувати"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </a>
                )}
              </div>
              <div className="text-xs text-gray-300 font-medium truncate mb-0.5">
                {serviceDisplay}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="truncate">{apt.masterName || 'Невідомий спеціаліст'}</span>
                <span className="text-gray-600">·</span>
                <span className="tabular-nums">{format(startTime, 'HH:mm')}–{format(endTime, 'HH:mm')}</span>
              </div>
            </div>
          </div>

          <div
            className="flex items-center justify-center flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <StatusSwitcher
              status={apt.status}
              isFromBooking={apt.isFromBooking === true}
              onStatusChange={handleStatusChange}
              appointmentId={apt.id}
              size="xs"
              customPrice={apt.customPrice}
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
      {/* Header: заголовок + меню */}
      <div className="flex items-center justify-between gap-3 mb-3 md:mb-4">
        <h2
          className="text-lg md:text-xl font-bold text-white"
          style={{ letterSpacing: '-0.02em' }}
        >
          Мій день
        </h2>
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0 relative" ref={menuRef}>
          {shareFeedback && (
            <span className="absolute -top-8 right-0 px-2 py-1 bg-white/90 text-black text-xs rounded whitespace-nowrap z-10">
              {shareFeedback === 'share' ? 'Поділено' : 'Не підтримується'}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v) }}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Меню"
            aria-expanded={showMenu}
          >
            <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-full mt-1 py-1 min-w-[180px] max-h-[min(70vh,calc(100dvh-6rem))] overflow-y-auto dropdown-theme rounded-lg shadow-xl z-[150]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={async () => {
                  setShowMenu(false)
                  await handleShare()
                }}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
                Поділитися
              </button>
            </div>
          )}
        </div>
      </div>

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

      {/* Статистика за день: на мобільному — 4 слоти в один ряд (менша висота), Вільні години окремо */}
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 sm:gap-2 md:gap-3 mb-3 md:mb-5 min-w-0">
        <div className="rounded-lg sm:rounded-xl bg-white/5 border border-white/10 p-2 sm:p-3">
          <div className="text-base sm:text-lg md:text-xl font-bold text-white tabular-nums leading-tight">{totalForDay}</div>
          <div className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 mt-0.5 leading-tight">Записів</div>
        </div>
        <button
          type="button"
          onClick={() => setSelectedStatus('confirmed')}
          className="rounded-lg sm:rounded-xl bg-white/5 border border-white/10 p-2 sm:p-3 hover:bg-white/10 transition-colors text-left active:scale-[0.98]"
        >
          <div className="text-base sm:text-lg md:text-xl font-bold text-emerald-400 tabular-nums leading-tight">{confirmedForDay}</div>
          <div className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 mt-0.5 leading-tight">Підтверджено</div>
        </button>
        <button
          type="button"
          onClick={() => setSelectedStatus('pending')}
          className="rounded-lg sm:rounded-xl bg-white/5 border border-white/10 p-2 sm:p-3 hover:bg-white/10 transition-colors text-left active:scale-[0.98]"
        >
          <div className="text-base sm:text-lg md:text-xl font-bold text-amber-400 tabular-nums leading-tight">{pendingForDay}</div>
          <div className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 mt-0.5 leading-tight">Очікує</div>
        </button>
        <button
          type="button"
          onClick={() => setSelectedStatus('done')}
          className="rounded-lg sm:rounded-xl bg-white/5 border border-white/10 p-2 sm:p-3 hover:bg-white/10 transition-colors text-left active:scale-[0.98]"
        >
          <div className="text-base sm:text-lg md:text-xl font-bold text-sky-400 tabular-nums leading-tight">{completedForDay}</div>
          <div className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 mt-0.5 leading-tight">Виконано</div>
        </button>
        <button
          type="button"
          onClick={() => onOpenFreeSlots?.(selectedDate)}
          className="rounded-lg sm:rounded-xl bg-white/5 border border-white/10 p-2 sm:p-3 hover:bg-white/10 transition-colors text-left active:scale-[0.98] col-span-4 sm:col-span-1 flex items-center gap-2"
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
          <span className="font-semibold text-purple-400 tabular-nums">{dayTotalRevenue} грн</span>
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
                    <div className="space-y-2">
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

              {/* Шапка: ім'я + час + статус */}
              <div className="pr-10 flex-shrink-0 pb-4 border-b border-white/10">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 text-lg font-bold text-white">
                    {selectedAppointment.clientName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-white truncate" style={{ letterSpacing: '-0.02em' }}>
                      {selectedAppointment.clientName}
                    </h2>
                    <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 tabular-nums font-medium text-gray-300">
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {format(new Date(selectedAppointment.startTime), 'HH:mm')}–{format(new Date(selectedAppointment.endTime), 'HH:mm')}
                      </span>
                      <span>{format(new Date(selectedAppointment.startTime), 'd MMMM', { locale: uk })}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div onClick={(e) => e.stopPropagation()}>
                        <StatusSwitcher
                          status={selectedAppointment.status}
                          isFromBooking={selectedAppointment.isFromBooking === true}
                          onStatusChange={handleStatusChange}
                          appointmentId={selectedAppointment.id}
                          size="sm"
                          customPrice={selectedAppointment.customPrice}
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
                      {(() => {
                        const sum = getDisplayPrice(selectedAppointment)
                        return sum != null ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-semibold border border-emerald-500/40">
                            {sum} грн
                          </span>
                        ) : null
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Контент: картки інфо */}
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide py-4 space-y-3">
                {selectedAppointment.clientPhone && (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-2">Телефон</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={`tel:${selectedAppointment.clientPhone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-sm font-medium hover:bg-emerald-500/30 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Зателефонувати
                      </a>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(selectedAppointment.clientPhone!)
                          toast({ title: 'Скопійовано', type: 'success' })
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-gray-300 text-sm font-medium hover:bg-white/15 transition-colors"
                      >
                        Копіювати
                      </button>
                    </div>
                    <p className="text-sm text-white/80 mt-1.5 font-mono">{selectedAppointment.clientPhone}</p>
                  </div>
                )}

                {selectedAppointment.masterName && (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">Спеціаліст</p>
                    <p className="text-sm font-medium text-white">{selectedAppointment.masterName}</p>
                  </div>
                )}

                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-2">Послуги</p>
                  {(() => {
                    const names = getServiceNamesList(selectedAppointment.services, selectedAppointment.customServiceName)
                    const needsPriceAfter = isCostAfterProcedure(selectedAppointment)
                    return (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {names.length > 0
                            ? names.map((name, idx) => (
                                <span key={idx} className="px-2.5 py-1 rounded-lg bg-white/10 text-sm text-gray-200 border border-white/10">
                                  {name}
                                </span>
                              ))
                            : (
                              <span className="text-sm text-gray-400">Послуга не вказана</span>
                            )}
                        </div>
                        {needsPriceAfter && (
                          <p className="text-xs text-gray-500 mt-2">Вартість узгоджується після процедури</p>
                        )}
                      </>
                    )
                  })()}
                </div>

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
                    className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-sm font-medium text-white hover:bg-white/15 transition-colors active:scale-[0.98]"
                  >
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


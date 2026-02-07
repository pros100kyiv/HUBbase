'use client'

import React, { useState, useRef, useEffect } from 'react'
import { format, addDays, subDays, isSameDay, startOfDay } from 'date-fns'
import { uk } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { ModalPortal } from '@/components/ui/modal-portal'

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
  notes?: string | null
}

export interface MyDayCardProps {
  businessId?: string
  appointments: Appointment[]
  totalAppointments: number
  completedAppointments: number
  pendingAppointments: number
  confirmedAppointments: number
  totalRevenue?: number
  onBookAppointment?: () => void
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
  const [historyPhone, setHistoryPhone] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyAppointments, setHistoryAppointments] = useState<Appointment[]>([])
  const [servicesList, setServicesList] = useState<Array<{ id: string; name: string }>>([])
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!businessId) return
    fetch(`/api/services?businessId=${businessId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setServicesList(Array.isArray(data) ? data : []))
      .catch(() => setServicesList([]))
  }, [businessId])

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY })
  }

  const handleTouchEnd = (e: React.TouchEvent, onClose: () => void) => {
    if (!touchStart) return
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

  /** Записи тільки для вибраного дня (за календарною датою), щоб відображення завжди відповідало обраній даті */
  const appointmentsForSelectedDay = appointments.filter((apt) =>
    isSameDay(new Date(apt.startTime), selectedDate)
  )
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
  
  const dateDisplay = isToday 
    ? `Сьогодні, ${format(selectedDate, 'd MMMM yyyy', { locale: uk })}`
    : format(selectedDate, 'EEEE, d MMMM yyyy', { locale: uk })

  // Мобільний формат: сьогодні = текст, інакше тільки число (щоб не ламався хедер)
  const dateDisplayMobile = isToday ? 'СЬОГОДНІ' : format(selectedDate, 'd', { locale: uk })

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
    setHistoryPhone(phone)
  }

  useEffect(() => {
    const loadHistory = async () => {
      if (!businessId || !historyPhone) return
      try {
        setHistoryLoading(true)
        const res = await fetch(
          `/api/appointments?businessId=${encodeURIComponent(businessId)}&clientPhone=${encodeURIComponent(historyPhone)}`
        )
        if (!res.ok) throw new Error('Failed to load client history')
        const data = await res.json()
        const arr = Array.isArray(data) ? data : []
        // Sort newest first for history
        arr.sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        setHistoryAppointments(arr)
      } catch (e) {
        console.error('Error loading client history:', e)
        setHistoryAppointments([])
      } finally {
        setHistoryLoading(false)
      }
    }
    loadHistory()
  }, [businessId, historyPhone])

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

  const getDaySummaryText = () => {
    const dateLabel = isToday ? 'Сьогодні' : format(selectedDate, 'd MMMM yyyy', { locale: uk })
    let text = `Мій день — ${dateLabel}\nЗаписів: ${totalForDay} (підтверджено: ${confirmedForDay}, очікує: ${pendingForDay}, виконано: ${completedForDay})`
    if (totalRevenue > 0) text += `\nДохід: ${totalRevenue} грн`
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Done': return 'Виконано'
      case 'Pending': return 'Очікує'
      case 'Confirmed': return 'Підтверджено'
      case 'Cancelled': return 'Скасовано'
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
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

  const getStatusTitle = (type: 'pending' | 'confirmed' | 'done') => {
    switch (type) {
      case 'pending': return 'Очікують підтвердження'
      case 'confirmed': return 'Підтверджені записи'
      case 'done': return 'Виконані записи'
    }
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

  const AppointmentItem = ({ apt, onClick }: { apt: Appointment; onClick: () => void }) => {
    const startTime = new Date(apt.startTime)
    const isDone = apt.status === 'Done' || apt.status === 'Виконано'
    const serviceNames = getServiceNamesList(apt.services, apt.customServiceName)
    const serviceDisplay = serviceNames.length > 0 ? serviceNames.join(', ') : (apt.customServiceName?.trim() ? apt.customServiceName.trim() : 'Послуга не вказана')

    return (
      <button
        onClick={onClick}
        className="w-full text-left bg-white/5 border border-white/10 rounded-xl p-2.5 md:p-3 hover:bg-white/10 transition-all active:scale-[0.99] group relative overflow-hidden touch-manipulation"
      >
        {/* Мобільний: вертикальний стек. Десктоп: ряд */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
            {/* Time Box */}
            <div className="flex flex-col items-center justify-center w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-[#2A2A2A] rounded-lg border border-white/10 flex-shrink-0 shadow-inner">
              <span className="text-sm font-bold text-blue-400 leading-none">
                {format(startTime, 'HH:mm')}
              </span>
              <div className="w-1 h-1 rounded-full bg-gray-600 mt-1 hidden sm:block" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 py-0.5">
              <div className="flex items-center gap-2 mb-0.5">
                <h5 className="text-sm font-bold text-white truncate leading-tight">
                  {apt.clientName}
                </h5>
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
              </div>
            </div>
          </div>

          {/* Right: Status & Actions — завжди внизу на мобільному, справа на десктопі */}
          <div className="flex items-center justify-between sm:justify-end gap-2 sm:flex-col sm:items-end sm:pl-0">
            <div className={`px-2 py-1 rounded text-[10px] font-medium border flex-shrink-0 ${getStatusColor(apt.status)}`}>
              {getStatusLabel(apt.status)}
            </div>
            <div className="flex items-center gap-1.5">
              {(apt.status === 'Pending' || apt.status === 'Очікує') && (
                <button
                  onClick={(e) => handleConfirm(e, apt.id)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30 transition-all active:scale-95 touch-manipulation min-h-[36px]"
                  title="Підтвердити запис"
                >
                  Підтвердити
                </button>
              )}
              {!isDone && (
                <button
                  onClick={(e) => handleMarkDone(e, apt.id)}
                  className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-all border border-green-500/20 touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center"
                  title="Виконано (в архів)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="bg-[#1A1A1A] text-white rounded-xl p-4 md:p-6 card-floating">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 md:mb-6">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <h3
            className="text-base sm:text-lg md:text-2xl font-bold text-white whitespace-nowrap flex-shrink-0"
            style={{ letterSpacing: '-0.02em' }}
          >
            МІЙ ДЕНЬ
          </h3>
          
          {/* Date Navigation */}
          <div className="flex items-center gap-1 md:gap-2 min-w-0 flex-1 whitespace-nowrap">
            <button
              onClick={handlePreviousDay}
              className="touch-target p-1.5 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center active:scale-95 flex-shrink-0"
              aria-label="Попередній день"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button
              onClick={() => setShowDatePicker(true)}
              className="px-2 md:px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-xs md:text-sm text-white flex items-center gap-1 md:gap-2 min-w-0 flex-1"
            >
              <svg className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="md:hidden w-16 text-center truncate tabular-nums">{dateDisplayMobile}</span>
              <span className="hidden md:inline capitalize truncate">{dateDisplay}</span>
            </button>
            
            <button
              onClick={handleNextDay}
              className="touch-target p-1.5 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center active:scale-95 flex-shrink-0"
              aria-label="Наступний день"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            {!isToday && (
              <button
                onClick={handleToday}
                className="px-2 py-1.5 text-xs bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-white whitespace-nowrap flex-shrink-0"
              >
                Сьогодні
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0 relative" ref={menuRef}>
          {shareFeedback && (
            <span className="absolute -top-8 right-0 px-2 py-1 bg-white/90 text-black text-xs rounded whitespace-nowrap z-10">
              {shareFeedback === 'share' ? 'Поділено' : 'Не підтримується'}
            </span>
          )}
          {/* Three dots menu */}
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
              className="absolute right-0 top-full mt-1 py-1 min-w-[180px] bg-[#2A2A2A] border border-white/10 rounded-lg shadow-xl z-50"
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

      {/* Statistics Grid — завжди для вибраного дня */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4">
          <div className="text-xl md:text-2xl font-bold text-white mb-0.5 md:mb-1">{totalForDay}</div>
          <div className="text-[10px] md:text-xs text-gray-400 leading-tight">Всього записів</div>
        </div>
        <button 
          onClick={() => setSelectedStatus('confirmed')}
          className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4 hover:bg-white/10 transition-colors text-left active:scale-[0.98]"
        >
          <div className="text-xl md:text-2xl font-bold text-green-400 mb-0.5 md:mb-1">{confirmedForDay}</div>
          <div className="text-[10px] md:text-xs text-gray-400 leading-tight">Підтверджено</div>
        </button>
        <button 
          onClick={() => setSelectedStatus('pending')}
          className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4 hover:bg-white/10 transition-colors text-left active:scale-[0.98]"
        >
          <div className="text-xl md:text-2xl font-bold text-orange-400 mb-0.5 md:mb-1">{pendingForDay}</div>
          <div className="text-[10px] md:text-xs text-gray-400 leading-tight">Очікує</div>
        </button>
        <button 
          onClick={() => setSelectedStatus('done')}
          className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4 hover:bg-white/10 transition-colors text-left active:scale-[0.98]"
        >
          <div className="text-xl md:text-2xl font-bold text-blue-400 mb-0.5 md:mb-1">{completedForDay}</div>
          <div className="text-[10px] md:text-xs text-gray-400 leading-tight">Виконано</div>
        </button>
      </div>

      {/* Appointments List — тільки записи вибраного дня */}
      {appointmentsForSelectedDay.length > 0 ? (
        <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-4">
          <div className="flex items-center justify-between mb-1.5 md:mb-2 gap-2">
            <h4 className="text-xs md:text-sm font-semibold text-gray-300 uppercase flex-1" style={{ letterSpacing: '0.05em' }}>
              {isToday ? 'Записи на сьогодні' : `Записи на ${format(selectedDate, 'd MMMM', { locale: uk })}`}
            </h4>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 hover:text-white transition-all active:scale-[0.95] flex-shrink-0"
              aria-label={isExpanded ? 'Згорнути список записів' : 'Розгорнути список записів'}
              title={isExpanded ? 'Згорнути' : 'Розгорнути'}
            >
              <svg 
                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
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
              .filter(apt => apt.status !== 'Done' && apt.status !== 'Виконано' && apt.status !== 'Cancelled' && apt.status !== 'Скасовано')
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
        /* Empty State */
        <div className="text-center py-8">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            {isToday ? 'Сьогодні немає записів' : `На ${format(selectedDate, 'd MMMM yyyy', { locale: uk })} немає записів`}
          </p>
          <button
            onClick={handleBookAppointment}
            className="px-4 md:px-6 py-2.5 md:py-3 bg-white text-black rounded-lg text-xs md:text-sm font-semibold hover:bg-gray-100 hover:text-gray-900 transition-colors active:scale-[0.98]"
            style={{ letterSpacing: '-0.01em', boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.3)' }}
          >
            Записати на послугу
          </button>
        </div>
      )}

      {/* Revenue (if available) */}
      {totalRevenue > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Дохід за день</span>
            <span className="text-lg font-bold text-white">{totalRevenue} грн</span>
          </div>
        </div>
      )}

      {/* Status Details Modal */}
      {selectedStatus && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => setSelectedStatus(null)}>
            <div
              className="relative w-[95%] sm:w-full max-w-lg modal-content modal-dialog text-white max-h-[82dvh] flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleTouchStart}
              onTouchEnd={(e) => handleTouchEnd(e, () => setSelectedStatus(null))}
            >
              <button
                type="button"
                onClick={() => setSelectedStatus(null)}
                className="modal-close text-gray-400 hover:text-white rounded-xl"
                aria-label="Закрити"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h3 className="modal-title pr-10 mb-1.5">{getStatusTitle(selectedStatus)}</h3>
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-2 pt-0 sm:p-3 sm:pt-0">
                <div className="space-y-1.5">
                  {getFilteredAppointments(selectedStatus).length > 0 ? (
                    getFilteredAppointments(selectedStatus).map((apt) => (
                      <AppointmentItem 
                        key={apt.id} 
                        apt={apt} 
                        onClick={() => {
                          setSelectedStatus(null)
                          handleAppointmentClick(apt.id)
                        }} 
                      />
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      Немає записів у цій категорії
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Appointment Details Modal */}
      {selectedAppointment && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => setSelectedAppointment(null)}>
            <div
              className="relative w-[95%] sm:w-full max-w-lg modal-content modal-dialog text-white max-h-[82dvh] flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleTouchStart}
              onTouchEnd={(e) => handleTouchEnd(e, () => setSelectedAppointment(null))}
            >
              <button
                type="button"
                onClick={() => setSelectedAppointment(null)}
                className="modal-close text-gray-400 hover:text-white rounded-xl"
                aria-label="Закрити"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="pr-10 mb-1.5 flex-shrink-0">
                <h3 className="modal-title truncate">{selectedAppointment.clientName}</h3>
                <p className="modal-subtitle truncate">
                  {format(new Date(selectedAppointment.startTime), 'd MMMM yyyy', { locale: uk })}{' '}
                  • {format(new Date(selectedAppointment.startTime), 'HH:mm')}–{format(new Date(selectedAppointment.endTime), 'HH:mm')}
                </p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-2 pt-0 sm:p-3 sm:pt-0 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Статус</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(selectedAppointment.status)}`}>
                    {getStatusLabel(selectedAppointment.status)}
                  </span>
                </div>

                {selectedAppointment.masterName && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-400">Спеціаліст</span>
                    <span className="text-sm text-white truncate">{selectedAppointment.masterName}</span>
                  </div>
                )}

                {selectedAppointment.clientPhone && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-400">Телефон</span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(selectedAppointment.clientPhone)}
                      className="text-sm text-blue-300 hover:text-blue-200 transition-colors"
                      title="Натисніть щоб скопіювати"
                    >
                      {selectedAppointment.clientPhone}
                    </button>
                  </div>
                )}

                {(() => {
                  const modalServiceNames = getServiceNamesList(selectedAppointment.services, selectedAppointment.customServiceName)
                  const hasCustomPrice = selectedAppointment.customPrice != null && selectedAppointment.customPrice > 0
                  return (
                    <div>
                      <div className="text-xs text-gray-400 mb-2">Послуги</div>
                      <div className="flex flex-wrap gap-2">
                        {modalServiceNames.length > 0
                          ? modalServiceNames.map((name, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-200"
                              >
                                {name}
                              </span>
                            ))
                          : (
                              <span className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-400">
                                Послуга не вказана
                              </span>
                            )}
                      </div>
                      {hasCustomPrice && (
                        <div className="text-xs text-gray-400 mt-2">
                          Вартість: <span className="text-white font-medium">{(selectedAppointment.customPrice! / 100).toFixed(0)} ₴</span>
                        </div>
                      )}
                      {!hasCustomPrice && (selectedAppointment.customServiceName?.trim() || (() => {
                        try {
                          const ids = selectedAppointment.services ? JSON.parse(selectedAppointment.services) : []
                          return Array.isArray(ids) && ids.length === 0
                        } catch { return false }
                      })()) && (
                        <div className="text-xs text-gray-400 mt-1">Вартість узгоджується після процедури</div>
                      )}
                    </div>
                  )
                })()}

                {selectedAppointment.notes && (
                  <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
                    <div className="text-xs text-gray-400 mb-1">Примітки</div>
                    <div className="text-sm text-gray-200 whitespace-pre-wrap">{selectedAppointment.notes}</div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-white/10 flex gap-2 flex-shrink-0">
                {selectedAppointment.clientPhone && (
                  <button
                    type="button"
                    onClick={() => openClientHistory(selectedAppointment.clientPhone)}
                    className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-sm font-medium text-white hover:bg-white/20 transition-colors active:scale-[0.98]"
                  >
                    Історія клієнта
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/appointments?edit=${selectedAppointment.id}`)}
                  className="flex-1 px-4 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors active:scale-[0.98]"
                >
                  Редагувати
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Client History Modal */}
      {historyPhone && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => setHistoryPhone(null)}>
            <div
              className="relative w-[95%] sm:w-full max-w-xl modal-content modal-dialog text-white max-h-[82dvh] flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={handleTouchStart}
              onTouchEnd={(e) => handleTouchEnd(e, () => setHistoryPhone(null))}
            >
              <button
                type="button"
                onClick={() => setHistoryPhone(null)}
                className="modal-close text-gray-400 hover:text-white rounded-xl"
                aria-label="Закрити"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="pr-10 mb-2 flex-shrink-0">
                <h3 className="modal-title truncate">Історія клієнта</h3>
                <p className="modal-subtitle truncate">{historyPhone}</p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-2 pt-0 sm:p-3 sm:pt-0">
                {historyLoading ? (
                  <div className="text-center py-10 text-sm text-gray-400">Завантаження…</div>
                ) : historyAppointments.length === 0 ? (
                  <div className="text-center py-10 text-sm text-gray-400">
                    {businessId ? 'Немає записів для цього клієнта' : 'Немає businessId для пошуку історії'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historyAppointments.map((apt) => {
                      const start = new Date(apt.startTime)
                      const end = new Date(apt.endTime)
                      return (
                        <button
                          key={apt.id}
                          className="w-full text-left bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-colors active:scale-[0.98]"
                          onClick={() => {
                            setSelectedAppointment(apt)
                            setHistoryPhone(null)
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white truncate">{apt.clientName}</div>
                              <div className="text-xs text-gray-400 truncate">
                                {format(start, 'd MMM yyyy', { locale: uk })} • {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
                                {apt.masterName ? ` • ${apt.masterName}` : ''}
                              </div>
                            </div>
                            <div className={`px-2 py-1 rounded text-xs font-medium border flex-shrink-0 ${getStatusColor(apt.status)}`}>
                              {getStatusLabel(apt.status)}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Date Picker Modal */}
      {showDatePicker && (
        <ModalPortal>
          <div className="modal-overlay sm:!p-4" onClick={() => setShowDatePicker(false)}>
            <div
              className="relative w-[95%] sm:w-full max-w-sm modal-content modal-dialog text-white max-h-[82dvh] flex flex-col min-h-0 animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowDatePicker(false)}
                className="modal-close text-gray-400 hover:text-white rounded-xl"
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


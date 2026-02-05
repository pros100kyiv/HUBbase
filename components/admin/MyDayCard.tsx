'use client'

import { useState, useRef } from 'react'
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
}

interface MyDayCardProps {
  appointments: Appointment[]
  totalAppointments: number
  completedAppointments: number
  pendingAppointments: number
  confirmedAppointments: number
  totalRevenue?: number
  onBookAppointment?: () => void
  selectedDate?: Date
  onDateChange?: (date: Date) => void
}

export function MyDayCard({
  appointments,
  totalAppointments,
  completedAppointments,
  pendingAppointments,
  confirmedAppointments,
  totalRevenue = 0,
  onBookAppointment,
  selectedDate: externalSelectedDate,
  onDateChange,
}: MyDayCardProps) {
  const router = useRouter()
  const [internalSelectedDate, setInternalSelectedDate] = useState(() => startOfDay(new Date()))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [shareFeedback, setShareFeedback] = useState<'share' | 'copy' | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selectedDate = externalSelectedDate || internalSelectedDate
  const isToday = isSameDay(selectedDate, new Date())
  
  const handleDateChange = (newDate: Date) => {
    if (onDateChange) {
      onDateChange(newDate)
    } else {
      setInternalSelectedDate(startOfDay(newDate))
    }
  }
  
  const handlePreviousDay = () => {
    const newDate = subDays(selectedDate, 1)
    handleDateChange(newDate)
  }
  
  const handleNextDay = () => {
    const newDate = addDays(selectedDate, 1)
    handleDateChange(newDate)
  }
  
  const handleToday = () => {
    handleDateChange(startOfDay(new Date()))
  }
  
  const dateDisplay = isToday 
    ? `Сьогодні, ${format(selectedDate, 'd MMMM yyyy', { locale: uk })}`
    : format(selectedDate, 'EEEE, d MMMM yyyy', { locale: uk })

  const handleBookAppointment = () => {
    if (onBookAppointment) {
      onBookAppointment()
    } else {
      router.push('/dashboard/appointments?create=true')
    }
  }

  const handleAppointmentClick = (id: string) => {
    router.push(`/dashboard/appointments?edit=${id}`)
  }

  const getDaySummaryText = () => {
    const dateLabel = isToday ? 'Сьогодні' : format(selectedDate, 'd MMMM yyyy', { locale: uk })
    let text = `Мій день — ${dateLabel}\nЗаписів: ${totalAppointments} (підтверджено: ${confirmedAppointments}, очікує: ${pendingAppointments}, виконано: ${completedAppointments})`
    if (totalRevenue > 0) text += `\nДохід: ${totalRevenue} грн`
    if (appointments.length > 0) {
      text += '\n\nЗаписи:\n'
      appointments.forEach((apt) => {
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
        await navigator.clipboard.writeText(text)
        setShareFeedback('copy')
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(text).catch(() => {})
        setShareFeedback('copy')
      }
    }
    setTimeout(() => setShareFeedback(null), 2000)
  }

  const handleCopyDay = async () => {
    try {
      await navigator.clipboard.writeText(getDaySummaryText())
      setShareFeedback('copy')
      setShowMenu(false)
      setTimeout(() => setShareFeedback(null), 2000)
    } catch {
      setShowMenu(false)
    }
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

  return (
    <div className="bg-[#1A1A1A] text-white rounded-xl p-4 md:p-6 card-floating">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg md:text-2xl font-bold text-white mb-1" style={{ letterSpacing: '-0.02em' }}>
            МІЙ ДЕНЬ
          </h3>
          {/* Date Navigation */}
          <div className="flex items-center gap-2 md:gap-3 mt-2 flex-wrap">
            <button
              onClick={handlePreviousDay}
              className="touch-target min-h-[40px] min-w-[40px] p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center active:scale-95"
              aria-label="Попередній день"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button
              onClick={() => setShowDatePicker(true)}
              className="px-2 md:px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-xs md:text-sm text-white flex items-center gap-1 md:gap-2 flex-1 min-w-0"
            >
              <svg className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="capitalize truncate">{dateDisplay}</span>
            </button>
            
            <button
              onClick={handleNextDay}
              className="touch-target min-h-[40px] min-w-[40px] p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center active:scale-95"
              aria-label="Наступний день"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            {!isToday && (
              <button
                onClick={handleToday}
                className="px-2 py-1.5 text-xs bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-white"
              >
                Сьогодні
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0 relative" ref={menuRef}>
          {/* Share icon - Hidden on mobile */}
          {shareFeedback && (
            <span className="absolute -top-8 right-0 px-2 py-1 bg-white/90 text-black text-xs rounded whitespace-nowrap z-10">
              {shareFeedback === 'share' ? 'Поділено' : 'Скопійовано'}
            </span>
          )}
          <button
            type="button"
            onClick={handleShare}
            className="hidden md:flex p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Поділитися днем"
            title="Поділитися днем"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="9" cy="9" r="3" strokeWidth={2} />
              <circle cx="15" cy="15" r="3" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v6m0 0l-3-3m3 3l3-3" />
            </svg>
          </button>
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
                onClick={handleCopyDay}
                className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h2m0 0h2a2 2 0 012 2v2m0 0h2a2 2 0 012-2h2m0 0a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2m0 0V6a2 2 0 012-2h2" />
                </svg>
                Скопіювати день
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4">
          <div className="text-xl md:text-2xl font-bold text-white mb-0.5 md:mb-1">{totalAppointments}</div>
          <div className="text-[10px] md:text-xs text-gray-400 leading-tight">Всього записів</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4">
          <div className="text-xl md:text-2xl font-bold text-green-400 mb-0.5 md:mb-1">{confirmedAppointments}</div>
          <div className="text-[10px] md:text-xs text-gray-400 leading-tight">Підтверджено</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4">
          <div className="text-xl md:text-2xl font-bold text-orange-400 mb-0.5 md:mb-1">{pendingAppointments}</div>
          <div className="text-[10px] md:text-xs text-gray-400 leading-tight">Очікує</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-3 md:p-4">
          <div className="text-xl md:text-2xl font-bold text-blue-400 mb-0.5 md:mb-1">{completedAppointments}</div>
          <div className="text-[10px] md:text-xs text-gray-400 leading-tight">Виконано</div>
        </div>
      </div>

      {/* Appointments List */}
      {appointments.length > 0 ? (
        <div className="space-y-2 md:space-y-3 mb-4">
          <div className="flex items-center justify-between mb-2 md:mb-3 gap-2">
            <h4 className="text-xs md:text-sm font-semibold text-gray-300 uppercase flex-1" style={{ letterSpacing: '0.05em' }}>
              Записи {isToday ? 'на сьогодні' : `на ${format(selectedDate, 'd MMMM', { locale: uk })}`}
            </h4>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 md:px-2 md:py-1 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 hover:text-white transition-all active:scale-[0.95] flex-shrink-0"
            >
              <span className="hidden sm:inline">{isExpanded ? 'Згорнути' : 'Розгорнути'}</span>
              <svg 
                className={`w-4 h-4 sm:w-4 sm:h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <div className={`space-y-2 ${isExpanded ? '' : 'max-h-48 md:max-h-64'} overflow-y-auto transition-all duration-300`}>
            {appointments.map((apt) => {
              const startTime = new Date(apt.startTime)
              const endTime = new Date(apt.endTime)
              
              return (
                <button
                  key={apt.id}
                  onClick={() => handleAppointmentClick(apt.id)}
                  className="w-full text-left bg-white/5 border border-white/10 rounded-lg p-3 md:p-4 hover:bg-white/10 transition-colors active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between mb-1 md:mb-2 gap-2">
                    <div className="flex-1 min-w-0">
                      <h5 className="text-xs md:text-sm font-semibold text-white mb-0.5 md:mb-1 truncate" style={{ letterSpacing: '-0.01em' }}>
                        {apt.clientName}
                      </h5>
                      {apt.masterName && (
                        <p className="text-[10px] md:text-xs text-gray-400 mb-1 md:mb-2 truncate">{apt.masterName}</p>
                      )}
                      <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-xs text-gray-300 flex-wrap">
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
                        </div>
                        {apt.clientPhone && (
                          <div className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {apt.clientPhone}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[9px] md:text-xs font-medium border flex-shrink-0 ${getStatusColor(apt.status)}`}>
                      {apt.status}
                    </div>
                  </div>
                  {apt.services && (
                    <div className="text-[10px] md:text-xs text-gray-400 mt-1 md:mt-2 line-clamp-1">
                      {(() => {
                        try {
                          const services = JSON.parse(apt.services)
                          return Array.isArray(services) 
                            ? services.map((s: any) => s.name || s).join(', ')
                            : apt.services
                        } catch {
                          return apt.services
                        }
                      })()}
                    </div>
                  )}
                </button>
              )
            })}
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

      {/* Date Picker Modal */}
      {showDatePicker && (
        <ModalPortal>
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4" 
            style={{ 
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0
            }}
          >
            <div 
              className="fixed inset-0 bg-black/70 backdrop-blur-sm" 
              onClick={() => setShowDatePicker(false)}
              style={{ 
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0
              }}
            />
            <div 
              className="relative w-[95%] sm:w-full max-w-sm bg-[#2A2A2A] rounded-xl p-4 sm:p-6 border border-white/10 shadow-2xl max-h-[90vh] sm:max-h-[calc(100vh-2rem)] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
              style={{ 
                position: 'relative',
                zIndex: 10000
              }}
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Виберіть дату</h3>
              <button
                onClick={() => setShowDatePicker(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
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


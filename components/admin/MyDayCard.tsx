'use client'

import { useState } from 'react'
import { format, addDays, subDays, isSameDay, startOfDay } from 'date-fns'
import { uk } from 'date-fns/locale'
import { useRouter } from 'next/navigation'

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
    <div className="bg-[#1A1A1A] text-white rounded-xl p-6 card-floating">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-white mb-1" style={{ letterSpacing: '-0.02em' }}>
            МІЙ ДЕНЬ
          </h3>
          {/* Date Navigation */}
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={handlePreviousDay}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Попередній день"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button
              onClick={() => setShowDatePicker(true)}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm text-white flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="capitalize">{dateDisplay}</span>
            </button>
            
            <button
              onClick={handleNextDay}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
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
        <div className="flex items-center gap-2">
          {/* Share icon */}
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="9" cy="9" r="3" strokeWidth={2} />
              <circle cx="15" cy="15" r="3" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v6m0 0l-3-3m3 3l3-3" />
            </svg>
          </button>
          {/* Three dots menu */}
          <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-white mb-1">{totalAppointments}</div>
          <div className="text-xs text-gray-400">Всього записів</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400 mb-1">{confirmedAppointments}</div>
          <div className="text-xs text-gray-400">Підтверджено</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-orange-400 mb-1">{pendingAppointments}</div>
          <div className="text-xs text-gray-400">Очікує</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400 mb-1">{completedAppointments}</div>
          <div className="text-xs text-gray-400">Виконано</div>
        </div>
      </div>

      {/* Appointments List */}
      {appointments.length > 0 ? (
        <div className="space-y-3 mb-4">
          <h4 className="text-sm font-semibold text-gray-300 uppercase mb-3" style={{ letterSpacing: '0.05em' }}>
            Записи {isToday ? 'на сьогодні' : `на ${format(selectedDate, 'd MMMM', { locale: uk })}`}
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {appointments.map((apt) => {
              const startTime = new Date(apt.startTime)
              const endTime = new Date(apt.endTime)
              
              return (
                <button
                  key={apt.id}
                  onClick={() => handleAppointmentClick(apt.id)}
                  className="w-full text-left bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h5 className="text-sm font-semibold text-white mb-1" style={{ letterSpacing: '-0.01em' }}>
                        {apt.clientName}
                      </h5>
                      {apt.masterName && (
                        <p className="text-xs text-gray-400 mb-2">{apt.masterName}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-300">
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
                    <div className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(apt.status)}`}>
                      {apt.status}
                    </div>
                  </div>
                  {apt.services && (
                    <div className="text-xs text-gray-400 mt-2">
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
            className="px-6 py-3 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowDatePicker(false)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <div className="relative w-full max-w-sm bg-[#2A2A2A] rounded-xl p-6 border border-white/10 z-10 shadow-2xl overflow-y-auto max-h-[90vh]" style={{ position: 'relative', zIndex: 10 }}>
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
      )}
    </div>
  )
}


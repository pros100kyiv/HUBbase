'use client'

import { format, isValid } from 'date-fns'
import { uk } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ClockIcon, CheckIcon, XIcon, UserIcon, PhoneIcon, EditIcon } from '@/components/icons'

interface Appointment {
  id: string
  masterId: string
  masterName?: string
  clientName: string
  clientPhone: string
  startTime: string
  endTime: string
  status: string
  services?: string
  customServiceName?: string | null
  customPrice?: number | null
}

interface MobileAppointmentCardProps {
  appointment: Appointment
  services?: Array<{ id: string; name: string }>
  onStatusChange?: (id: string, status: string) => void
  onEdit?: (appointment: Appointment) => void
}

export function MobileAppointmentCard({
  appointment,
  services = [],
  onStatusChange,
  onEdit,
}: MobileAppointmentCardProps) {
  const startTimeDate = new Date(appointment.startTime)
  const endTimeDate = new Date(appointment.endTime)
  const startTime = isValid(startTimeDate) ? startTimeDate : new Date()
  const endTime = isValid(endTimeDate) ? endTimeDate : new Date()
  const isDone = appointment.status === 'Done' || appointment.status === 'Виконано'

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Pending': return 'Очікує'
      case 'Confirmed': return 'Підтверджено'
      case 'Done': return 'Виконано'
      case 'Cancelled': return 'Скасовано'
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
      case 'Очікує':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      case 'Confirmed':
      case 'Підтверджено':
        return 'bg-green-500/20 text-green-400 border-green-500/50'
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

  let serviceIds: string[] = []
  try {
    if (appointment.services) {
      const parsed = JSON.parse(appointment.services)
      serviceIds = Array.isArray(parsed) ? parsed : [parsed]
    }
  } catch {
    // ignore
  }
  const serviceNames = serviceIds.length > 0
    ? serviceIds.map((id) => services.find((s) => s.id === id)?.name || id)
    : (appointment.customServiceName?.trim() ? [appointment.customServiceName.trim()] : [])
  const serviceDisplay = serviceNames.length > 0 ? serviceNames.join(', ') : 'Послуга не вказана'

  return (
    <div className="w-full text-left bg-white/5 border border-white/10 rounded-xl p-3 md:p-4 hover:bg-white/10 transition-all active:scale-[0.99] group touch-manipulation">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        {/* Time box — як у MyDayCard */}
        <div className="flex flex-col items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-[#2A2A2A] rounded-lg border border-white/10 flex-shrink-0 shadow-inner">
          <span className="text-sm md:text-base font-bold text-blue-400 leading-none">
            {format(startTime, 'HH:mm')}
          </span>
          <div className="w-1 h-1 rounded-full bg-gray-600 mt-1" />
        </div>

        {/* Info — клієнт, телефон, послуги, майстер */}
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-center gap-2 mb-0.5">
            <h5 className="text-sm md:text-base font-bold text-white truncate leading-tight">
              {appointment.clientName}
            </h5>
            {appointment.clientPhone && (
              <a
                href={`tel:${appointment.clientPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="text-gray-400 hover:text-white transition-colors p-1 flex-shrink-0"
                title={appointment.clientPhone}
              >
                <PhoneIcon className="w-3 h-3 md:w-3.5 md:h-3.5" />
              </a>
            )}
          </div>
          <div className="text-xs md:text-sm text-gray-300 font-medium truncate mb-0.5">
            {serviceDisplay}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-gray-500">
            <UserIcon className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{appointment.masterName || 'Невідомий спеціаліст'}</span>
          </div>
        </div>

        {/* Права частина: статус, кнопки, редагувати */}
        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 sm:pl-2 flex-shrink-0 w-full sm:w-auto">
          <div className={cn('px-2 py-0.5 rounded text-[10px] md:text-xs font-medium border', getStatusColor(appointment.status))}>
            {getStatusLabel(appointment.status)}
          </div>
          <div className="flex items-center gap-1">
            {onStatusChange && (
              <>
                {(appointment.status === 'Pending' || appointment.status === 'Очікує') && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); onStatusChange(appointment.id, 'Confirmed') }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30 transition-all active:scale-95 touch-manipulation min-h-[36px]"
                      title="Підтвердити"
                    >
                      <CheckIcon className="w-3 h-3 inline mr-0.5" />
                      Підтвердити
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onStatusChange(appointment.id, 'Done') }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 transition-all active:scale-95 touch-manipulation min-h-[36px]"
                      title="В роботі"
                    >
                      <CheckIcon className="w-3 h-3 inline mr-0.5" />
                      В роботі
                    </button>
                  </>
                )}
                {(appointment.status === 'Confirmed' || appointment.status === 'Підтверджено') && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onStatusChange(appointment.id, 'Done') }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 transition-all active:scale-95 touch-manipulation min-h-[36px]"
                    title="Виконано"
                  >
                    <CheckIcon className="w-3 h-3 inline mr-0.5" />
                    Виконано
                  </button>
                )}
                {!isDone && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onStatusChange(appointment.id, 'Cancelled') }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 transition-all active:scale-95 touch-manipulation min-h-[36px]"
                    title="Скасувати"
                  >
                    <XIcon className="w-3 h-3 inline mr-0.5" />
                    Скасувати
                  </button>
                )}
              </>
            )}
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(appointment) }}
                className="p-2 bg-white/10 text-gray-300 rounded-lg hover:bg-white/20 hover:text-white transition-all border border-white/10 touch-manipulation min-h-[36px] min-w-[36px] flex items-center justify-center"
                title="Редагувати"
              >
                <EditIcon className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Час внизу — один рядок */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
        <ClockIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
        <span className="text-[10px] md:text-xs text-gray-400 font-medium">
          {format(startTime, 'HH:mm')} – {format(endTime, 'HH:mm')}
          <span className="text-gray-500 ml-1">
            ({Math.round((endTime.getTime() - startTime.getTime()) / 60000)} хв)
          </span>
        </span>
      </div>
    </div>
  )
}

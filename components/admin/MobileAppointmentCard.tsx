'use client'

import { format, isValid } from 'date-fns'
import { uk } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ClockIcon, CheckIcon, XIcon, UserIcon, SettingsIcon } from '@/components/icons'

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
}

interface MobileAppointmentCardProps {
  appointment: Appointment
  onStatusChange?: (id: string, status: string) => void
  onEdit?: (appointment: Appointment) => void
}

export function MobileAppointmentCard({
  appointment,
  onStatusChange,
  onEdit,
}: MobileAppointmentCardProps) {
  const startTimeDate = new Date(appointment.startTime)
  const endTimeDate = new Date(appointment.endTime)
  
  const startTime = isValid(startTimeDate) ? startTimeDate : new Date()
  const endTime = isValid(endTimeDate) ? endTimeDate : new Date()

  /** Статус у стилі Dashboard: напівпрозорі фони та акцентний текст */
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'Очікує'
      case 'Confirmed':
        return 'Підтверджено'
      case 'Done':
        return 'Виконано'
      case 'Cancelled':
        return 'Скасовано'
      default:
        return status
    }
  }

  let servicesList: string[] = []
  try {
    if (appointment.services) {
      servicesList = JSON.parse(appointment.services)
    }
  } catch (e) {
    // Ignore
  }

  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case 'Pending':
      case 'Очікує':
        return 'border-l-4 border-orange-500/60'
      case 'Confirmed':
      case 'Підтверджено':
        return 'border-l-4 border-green-500/60'
      case 'Done':
      case 'Виконано':
        return 'border-l-4 border-blue-500/60'
      case 'Cancelled':
      case 'Скасовано':
        return 'border-l-4 border-red-500/60'
      default:
        return 'border-l-4 border-gray-500/60'
    }
  }

  return (
    <div className={cn("rounded-xl p-3 overflow-hidden transition-all bg-white/5 border border-white/10 hover:bg-white/10", getStatusBorderColor(appointment.status))}>
      {/* Header with time and status */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-lg bg-[#2A2A2A] border border-white/10 flex flex-col items-center justify-center text-blue-400 flex-shrink-0 overflow-hidden shadow-inner">
            <span className="text-sm font-bold leading-tight">
              {format(startTime, 'HH:mm')}
            </span>
            <span className="text-[10px] font-semibold leading-tight text-gray-400">
              {format(startTime, 'dd.MM')}
            </span>
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="font-black text-white text-sm mb-0.5 truncate">{appointment.clientName}</p>
            <p className="text-xs text-gray-300 font-medium mb-0.5 truncate">{appointment.clientPhone}</p>
            {appointment.masterName && (
              <div className="flex items-center gap-1 min-w-0">
                <UserIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <p className="text-[10px] text-gray-400 font-semibold truncate min-w-0">
                  {appointment.masterName}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap",
              getStatusColor(appointment.status)
            )}
          >
            {getStatusLabel(appointment.status)}
          </span>
          {onStatusChange && (
            <div className="flex flex-col gap-1">
              {appointment.status === 'Pending' && (
                <>
                  <button
                    onClick={() => onStatusChange(appointment.id, 'Confirmed')}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap flex items-center justify-center gap-1 bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30 transition-all active:scale-95"
                    title="Підтвердити"
                  >
                    <CheckIcon className="w-3 h-3" />
                    Підтвердити
                  </button>
                  <button
                    onClick={() => onStatusChange(appointment.id, 'Done')}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap flex items-center justify-center gap-1 bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 transition-all active:scale-95"
                    title="В роботі"
                  >
                    <CheckIcon className="w-3 h-3" />
                    В роботі
                  </button>
                </>
              )}
              {appointment.status === 'Confirmed' && (
                <button
                  onClick={() => onStatusChange(appointment.id, 'Done')}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap flex items-center justify-center gap-1 bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 transition-all active:scale-95"
                  title="Виконано"
                >
                  <CheckIcon className="w-3 h-3" />
                  Виконано
                </button>
              )}
              {appointment.status !== 'Cancelled' && (
                <button
                  onClick={() => onStatusChange(appointment.id, 'Cancelled')}
                  className="px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap flex items-center justify-center gap-1 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 transition-all active:scale-95"
                  title="Скасувати"
                >
                  <XIcon className="w-3 h-3" />
                  Скасувати
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Services and Time */}
      {(servicesList.length > 0 || true) && (
        <div className="flex items-center justify-between gap-1.5 mt-1.5 pt-1.5 border-t border-white/10">
          {servicesList.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] text-gray-400 font-semibold uppercase">Послуги:</span>
              {servicesList.slice(0, 2).map((serviceId, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-semibold text-gray-300"
                >
                  {idx + 1}
                </span>
              ))}
              {servicesList.length > 2 && (
                <span className="text-[9px] text-gray-500 font-semibold">+{servicesList.length - 2}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            <ClockIcon className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] font-semibold text-gray-300">
              {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
            </span>
            <span className="text-[9px] text-gray-400">•</span>
            <span className="text-[10px] text-gray-400 font-medium">
              {Math.round((endTime.getTime() - startTime.getTime()) / 60000)} хв
            </span>
          </div>
        </div>
      )}
    </div>
  )
}


'use client'

import { format } from 'date-fns'
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
  const startTime = new Date(appointment.startTime)
  const endTime = new Date(appointment.endTime)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
      case 'Очікує':
        return 'text-orange-500 border-orange-500 bg-orange-50'
      case 'Confirmed':
      case 'Підтверджено':
        return 'text-green-500 border-green-500 bg-green-50'
      case 'Done':
      case 'Виконано':
        return 'text-blue-500 border-blue-500 bg-blue-50'
      case 'Cancelled':
      case 'Скасовано':
        return 'text-red-500 border-red-500 bg-red-50'
      default:
        return 'text-gray-500 border-gray-400 bg-gray-50'
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
        return 'border-l-4 border-orange-500'
      case 'Confirmed':
      case 'Підтверджено':
        return 'border-l-4 border-green-500'
      case 'Done':
      case 'Виконано':
        return 'border-l-4 border-blue-500'
      case 'Cancelled':
      case 'Скасовано':
        return 'border-l-4 border-red-500'
      default:
        return 'border-l-4 border-gray-400'
    }
  }

  return (
    <div className={cn("rounded-lg p-3 overflow-hidden transition-all bg-[#1A1A1A] border border-white/10", getStatusBorderColor(appointment.status))}>
      {/* Header with time and status */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-lg bg-blue-500 flex flex-col items-center justify-center text-white flex-shrink-0 overflow-hidden" style={{ boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.1)' }}>
            <span className="text-sm font-black leading-tight">
              {format(startTime, 'HH:mm')}
            </span>
            <span className="text-[10px] font-bold leading-tight">
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
              "px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
              getStatusColor(appointment.status)
            )}
          >
            {getStatusLabel(appointment.status)}
          </span>
          {onStatusChange && (
            <div className="flex flex-col gap-1">
              {/* Кнопки зміни статусу - покращений інтерфейс */}
              {appointment.status === 'Pending' && (
                <>
                  <button
                    onClick={() => onStatusChange(appointment.id, 'Confirmed')}
                    className="px-2 py-1 rounded-lg bg-green-50 border border-green-500 text-green-500 hover:bg-green-500 hover:text-white transition-all duration-200 active:scale-95 flex items-center justify-center gap-1 text-[10px] font-bold whitespace-nowrap"
                    title="Підтвердити"
                  >
                    <CheckIcon className="w-3 h-3" />
                    Підтвердити
                  </button>
                  <button
                    onClick={() => onStatusChange(appointment.id, 'Done')}
                    className="px-2 py-1 rounded-lg bg-blue-50 border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white transition-all duration-200 active:scale-95 flex items-center justify-center gap-1 text-[10px] font-bold whitespace-nowrap"
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
                  className="px-2 py-1 rounded-lg bg-blue-50 border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white transition-all duration-200 active:scale-95 flex items-center justify-center gap-1 text-[10px] font-bold whitespace-nowrap"
                  title="Виконано"
                >
                  <CheckIcon className="w-3 h-3" />
                  Виконано
                </button>
              )}
              {appointment.status !== 'Cancelled' && (
                <button
                  onClick={() => onStatusChange(appointment.id, 'Cancelled')}
                  className="px-2 py-1 rounded-lg bg-red-50 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200 active:scale-95 flex items-center justify-center gap-1 text-[10px] font-bold whitespace-nowrap"
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
        <div className="flex items-center justify-between gap-1.5 mt-1.5 pt-1.5 border-t border-gray-100">
          {servicesList.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] text-gray-400 font-bold uppercase">Послуги:</span>
              {servicesList.slice(0, 2).map((serviceId, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-[9px] font-bold text-foreground"
                >
                  {idx + 1}
                </span>
              ))}
              {servicesList.length > 2 && (
                <span className="text-[9px] text-gray-500 font-bold">+{servicesList.length - 2}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            <ClockIcon className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-300">
              {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
            </span>
            <span className="text-[9px] text-gray-400">•</span>
            <span className="text-[10px] text-gray-400 font-semibold">
              {Math.round((endTime.getTime() - startTime.getTime()) / 60000)} хв
            </span>
          </div>
        </div>
      )}
    </div>
  )
}


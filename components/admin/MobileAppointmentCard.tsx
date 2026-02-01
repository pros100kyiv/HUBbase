'use client'

import { format } from 'date-fns'
import { uk } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ClockIcon, CheckIcon, XIcon, UserIcon } from '@/components/icons'

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
}

export function MobileAppointmentCard({
  appointment,
  onStatusChange,
}: MobileAppointmentCardProps) {
  const startTime = new Date(appointment.startTime)
  const endTime = new Date(appointment.endTime)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
      case 'Очікує':
        return 'text-candy-orange border-candy-orange bg-candy-orange/10 dark:bg-candy-orange/20'
      case 'Confirmed':
      case 'Підтверджено':
        return 'text-candy-mint border-candy-mint bg-candy-mint/10 dark:bg-candy-mint/20'
      case 'Arrived':
      case 'Прибув':
        return 'text-blue-600 dark:text-blue-400 border-blue-500 bg-blue-50 dark:bg-blue-900/30'
      case 'InProgress':
      case 'В роботі':
        return 'text-yellow-600 dark:text-yellow-400 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30'
      case 'Done':
      case 'Виконано':
      case 'Закінчили':
        return 'text-candy-blue border-candy-blue bg-candy-blue/10 dark:bg-candy-blue/20'
      case 'Cancelled':
      case 'Скасовано':
        return 'text-red-600 dark:text-red-400 border-red-500 bg-red-50 dark:bg-red-900/30'
      default:
        return 'text-gray-600 dark:text-gray-400 border-gray-400 bg-gray-50 dark:bg-gray-700'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'Очікує'
      case 'Confirmed':
        return 'Підтверджено'
      case 'Arrived':
        return 'Прибув'
      case 'InProgress':
        return 'В роботі'
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
        return 'border-l-4 border-candy-orange'
      case 'Confirmed':
      case 'Підтверджено':
        return 'border-l-4 border-candy-mint'
      case 'Arrived':
      case 'Прибув':
        return 'border-l-4 border-blue-500'
      case 'InProgress':
      case 'В роботі':
        return 'border-l-4 border-yellow-500'
      case 'Done':
      case 'Виконано':
      case 'Закінчили':
        return 'border-l-4 border-candy-blue'
      case 'Cancelled':
      case 'Скасовано':
        return 'border-l-4 border-red-500'
      default:
        return 'border-l-4 border-gray-400'
    }
  }

  return (
    <div className={cn("card-candy card-candy-hover p-2.5 overflow-hidden", getStatusBorderColor(appointment.status))}>
      {/* Header with time and status */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-candy-sm candy-blue flex flex-col items-center justify-center shadow-soft text-white flex-shrink-0 overflow-hidden">
            <span className="text-sm font-black leading-tight">
              {format(startTime, 'HH:mm')}
            </span>
            <span className="text-[10px] font-bold leading-tight">
              {format(startTime, 'dd.MM')}
            </span>
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="font-black text-gray-900 dark:text-white text-sm mb-0.5 truncate">{appointment.clientName}</p>
            <p className="text-xs text-gray-700 dark:text-gray-300 font-semibold mb-0.5 truncate">{appointment.clientPhone}</p>
            {appointment.masterName && (
              <div className="flex items-center gap-1 min-w-0">
                <UserIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                <p className="text-[10px] text-gray-600 dark:text-gray-400 font-semibold truncate min-w-0">
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
            <div className="flex gap-1 flex-wrap justify-end">
              {appointment.status === 'Pending' && (
                <button
                  onClick={() => onStatusChange(appointment.id, 'Confirmed')}
                  className="px-2 py-1 rounded-candy-xs border border-candy-mint text-candy-mint hover:bg-candy-mint hover:text-white transition-all duration-200 active:scale-95 flex items-center justify-center flex-shrink-0 text-[10px] font-bold whitespace-nowrap"
                  title="Підтвердити"
                >
                  Підтвердити
                </button>
              )}
              {appointment.status === 'Confirmed' && (
                <button
                  onClick={() => onStatusChange(appointment.id, 'Arrived')}
                  className="px-2 py-1 rounded-candy-xs border border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-500 hover:text-white transition-all duration-200 active:scale-95 flex items-center justify-center flex-shrink-0 text-[10px] font-bold whitespace-nowrap"
                  title="Прибув"
                >
                  Прибув
                </button>
              )}
              {appointment.status === 'Arrived' && (
                <button
                  onClick={() => onStatusChange(appointment.id, 'InProgress')}
                  className="px-2 py-1 rounded-candy-xs border border-yellow-500 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500 hover:text-white transition-all duration-200 active:scale-95 flex items-center justify-center flex-shrink-0 text-[10px] font-bold whitespace-nowrap"
                  title="В роботі"
                >
                  В роботі
                </button>
              )}
              {(appointment.status === 'InProgress' || appointment.status === 'Arrived') && (
                <button
                  onClick={() => onStatusChange(appointment.id, 'Done')}
                  className="px-2 py-1 rounded-candy-xs border border-candy-blue text-candy-blue hover:bg-candy-blue hover:text-white transition-all duration-200 active:scale-95 flex items-center justify-center flex-shrink-0 text-[10px] font-bold whitespace-nowrap"
                  title="Закінчили"
                >
                  Закінчили
                </button>
              )}
              {appointment.status !== 'Cancelled' && appointment.status !== 'Done' && (
                <button
                  onClick={() => onStatusChange(appointment.id, 'Cancelled')}
                  className="px-2 py-1 rounded-candy-xs border border-red-500 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white transition-all duration-200 active:scale-95 flex items-center justify-center flex-shrink-0 text-[10px] font-bold whitespace-nowrap"
                  title="Скасувати"
                >
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
              <span className="text-[9px] text-gray-600 dark:text-gray-400 font-bold uppercase">Послуги:</span>
              {servicesList.slice(0, 2).map((serviceId, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-[9px] font-bold text-gray-900 dark:text-gray-100"
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
            <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">
              {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
            </span>
            <span className="text-[9px] text-gray-500 dark:text-gray-500">•</span>
            <span className="text-[10px] text-gray-600 dark:text-gray-400 font-semibold">
              {Math.round((endTime.getTime() - startTime.getTime()) / 60000)} хв
            </span>
          </div>
        </div>
      )}
    </div>
  )
}


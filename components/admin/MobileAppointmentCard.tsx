'use client'

import { format, isValid } from 'date-fns'
import { cn } from '@/lib/utils'
import { UserIcon, PhoneIcon, EditIcon } from '@/components/icons'
import { StatusSwitcher } from './StatusSwitcher'

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
  isFromBooking?: boolean
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
    <div className="w-full text-left bg-white/5 border border-white/10 rounded-lg p-2.5 md:p-3 hover:bg-white/10 transition-all active:scale-[0.99] group touch-manipulation">
      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
        {/* Час — компактний блок */}
        <div className="flex flex-col items-center justify-center w-10 h-10 sm:w-11 sm:h-11 bg-[#2A2A2A] rounded-lg border border-white/10 flex-shrink-0 shadow-inner">
          <span className="text-xs sm:text-sm font-bold text-blue-400 leading-none">
            {format(startTime, 'HH:mm')}
          </span>
          <span className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5">
            {Math.round((endTime.getTime() - startTime.getTime()) / 60000)} хв
          </span>
        </div>

        {/* Клієнт, послуга, майстер — один стовпчик */}
        <div className="flex-1 min-w-0 py-0.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <h5 className="text-sm font-bold text-white truncate leading-tight">
              {appointment.clientName}
            </h5>
            {appointment.clientPhone && (
              <a
                href={`tel:${appointment.clientPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="text-gray-400 hover:text-white transition-colors p-1 flex-shrink-0"
                title={appointment.clientPhone}
              >
                <PhoneIcon className="w-3 h-3" />
              </a>
            )}
          </div>
          <div className="text-[11px] md:text-xs text-gray-300 truncate mb-0.5">
            {serviceDisplay}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <UserIcon className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate">{appointment.masterName || 'Спеціаліст'}</span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-500">{format(startTime, 'HH:mm')}–{format(endTime, 'HH:mm')}</span>
          </div>
        </div>

        {/* Статус і дії */}
        <div className="flex flex-row items-center justify-end sm:justify-start gap-1.5 sm:pl-1 flex-shrink-0 w-full sm:w-auto">
          <StatusSwitcher
            status={appointment.status}
            isFromBooking={appointment.isFromBooking === true}
            onStatusChange={onStatusChange ?? (() => {})}
            appointmentId={appointment.id}
            disabled={!onStatusChange}
          />
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
  )
}

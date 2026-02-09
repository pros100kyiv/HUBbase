'use client'

import { format, isValid } from 'date-fns'
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

interface ServiceWithPrice {
  id: string
  name: string
  price?: number
}

interface MobileAppointmentCardProps {
  appointment: Appointment
  services?: Array<ServiceWithPrice>
  onStatusChange?: (id: string, status: string) => void
  onEdit?: (appointment: Appointment) => void
  /** Відкрити історію клієнта на сторінці Клієнти (передати phone) */
  onOpenClientHistory?: (phone: string) => void
  /** Якщо вартість не вказана і користувач обирає «Виконано» — викликається (відкрити модалку введення вартості) */
  onDoneWithoutPrice?: (id: string) => void
}

function getDisplayPrice(
  appointment: Appointment,
  services: Array<ServiceWithPrice>
): number | null {
  if (appointment.customPrice != null && appointment.customPrice > 0) {
    return Math.round(appointment.customPrice / 100)
  }
  let serviceIds: string[] = []
  try {
    if (appointment.services) {
      const parsed = JSON.parse(appointment.services)
      serviceIds = Array.isArray(parsed) ? parsed : [parsed]
    }
  } catch {
    return null
  }
  if (serviceIds.length === 0) return null
  let sum = 0
  for (const id of serviceIds) {
    const s = services.find((x) => x.id === id)
    if (s?.price != null && s.price > 0) sum += s.price
  }
  return sum > 0 ? sum : null
}

export function MobileAppointmentCard({
  appointment,
  services = [],
  onStatusChange,
  onEdit,
  onOpenClientHistory,
  onDoneWithoutPrice,
}: MobileAppointmentCardProps) {
  const startTimeDate = new Date(appointment.startTime)
  const endTimeDate = new Date(appointment.endTime)
  const startTime = isValid(startTimeDate) ? startTimeDate : new Date()
  const endTime = isValid(endTimeDate) ? endTimeDate : new Date()
  const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

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

  const displayPrice = getDisplayPrice(appointment, services)

  return (
    <div className="w-full text-left bg-white/5 border border-white/10 rounded-xl p-3 md:p-3.5 hover:bg-white/8 transition-all active:scale-[0.99] group touch-manipulation">
      <div className="flex gap-3">
        {/* Час запису — блок з tabular-nums */}
        <div className="flex flex-col items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl border border-white/15 bg-white/10 flex-shrink-0">
          <span className="text-sm font-semibold tabular-nums text-white leading-none">
            {format(startTime, 'HH:mm')}
          </span>
          <span className="text-[10px] text-gray-400 mt-1 tabular-nums">
            {durationMin} хв
          </span>
        </div>

        {/* Клієнт, послуга, майстер, сума */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-0.5">
            <h5 className="text-sm font-bold text-white truncate leading-tight">
              {appointment.clientName}
            </h5>
            {appointment.clientPhone && (
              <>
                <a
                  href={`tel:${appointment.clientPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-gray-400 hover:text-emerald-400 transition-colors p-1 flex-shrink-0"
                  title={appointment.clientPhone}
                >
                  <PhoneIcon className="w-3.5 h-3.5" />
                </a>
                {onOpenClientHistory && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenClientHistory(appointment.clientPhone)
                    }}
                    className="text-gray-400 hover:text-purple-400 transition-colors p-1 flex-shrink-0"
                    title="Історія клієнта"
                  >
                    <UserIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </>
            )}
          </div>
          <div className="text-[11px] md:text-xs text-gray-300 truncate mb-1">
            {serviceDisplay}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <UserIcon className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate">{appointment.masterName || 'Спеціаліст'}</span>
              <span className="text-gray-600">·</span>
              <span className="tabular-nums text-gray-400">{format(startTime, 'HH:mm')}–{format(endTime, 'HH:mm')}</span>
            </div>
            {displayPrice != null && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-xs font-semibold border border-emerald-500/30">
                {displayPrice} грн
              </span>
            )}
          </div>
        </div>

        {/* Статус і дії */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <StatusSwitcher
            status={appointment.status}
            isFromBooking={appointment.isFromBooking === true}
            onStatusChange={onStatusChange ?? (() => {})}
            appointmentId={appointment.id}
            disabled={!onStatusChange}
            size="sm"
            customPrice={appointment.customPrice}
            onDoneWithoutPrice={onDoneWithoutPrice}
          />
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(appointment) }}
              className="touch-target p-2 bg-white/10 text-gray-300 rounded-lg hover:bg-white/20 hover:text-white transition-all border border-white/10 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Редагувати"
              aria-label="Редагувати запис"
            >
              <EditIcon className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { format, isValid } from 'date-fns'
import { UserIcon, PhoneIcon, EditIcon } from '@/components/icons'
import { fixMojibake } from '@/lib/utils'
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

type Tone = 'done' | 'confirmed' | 'pending' | 'cancelled' | 'other'

function toTone(status: string): Tone {
  switch (status) {
    case 'Done':
    case 'Виконано':
      return 'done'
    case 'Confirmed':
    case 'Підтверджено':
      return 'confirmed'
    case 'Pending':
    case 'Очікує':
      return 'pending'
    case 'Cancelled':
    case 'Скасовано':
      return 'cancelled'
    default:
      return 'other'
  }
}

function toneBorderClass(tone: Tone): string {
  switch (tone) {
    case 'done':
      return 'border-l-sky-500/80'
    case 'confirmed':
      return 'border-l-emerald-500/80'
    case 'pending':
      return 'border-l-amber-500/80'
    case 'cancelled':
      return 'border-l-rose-500/70'
    default:
      return 'border-l-white/20'
  }
}

function toneBadgeClass(tone: Tone): string {
  switch (tone) {
    case 'done':
      return 'bg-sky-500/20 text-sky-300 border-transparent'
    case 'confirmed':
      return 'bg-emerald-500/20 text-emerald-300 border-transparent'
    case 'pending':
      return 'bg-amber-500/20 text-amber-300 border-transparent'
    case 'cancelled':
      return 'bg-rose-500/20 text-rose-300 border-transparent'
    default:
      return 'bg-white/10 text-gray-300 border-transparent'
  }
}

function statusLabel(status: string): string {
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
  const visibleServices = serviceNames.slice(0, 2)
  const restServices = Math.max(0, serviceNames.length - visibleServices.length)

  const displayPrice = getDisplayPrice(appointment, services)
  const tone = toTone(appointment.status)

  return (
    <div className={`w-full text-left rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] transition-colors px-3 py-2.5 active:scale-[0.99] touch-manipulation border-l-4 ${toneBorderClass(tone)}`}>
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

        {/* Клієнт, послуга, спеціаліст, сума */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2 flex-wrap">
            <h5 className="text-sm font-bold text-white truncate leading-tight">
              {fixMojibake(appointment.clientName)}
            </h5>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${toneBadgeClass(tone)}`}>
              {statusLabel(appointment.status)}
            </span>
            {appointment.clientPhone && (
              <>
                <a
                  href={`tel:${appointment.clientPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-emerald-400 hover:text-emerald-300 transition-colors p-1 flex-shrink-0"
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

          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {visibleServices.length > 0 ? (
              <>
                {visibleServices.map((name, idx) => (
                  <span
                    key={`${appointment.id}-svc-${idx}`}
                    className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-white/10 text-gray-200 border border-white/10 truncate max-w-[14rem]"
                    title={name}
                  >
                    {name}
                  </span>
                ))}
                {restServices > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-medium rounded-lg bg-white/5 text-gray-400 border border-white/10">
                    +{restServices}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[11px] text-gray-500">Послуги не вказані</span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-[10px] text-gray-500 min-w-0">
              <UserIcon className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate">{appointment.masterName || 'Спеціаліст'}</span>
              <span className="text-gray-600">·</span>
              <span className="tabular-nums text-gray-400">{format(startTime, 'HH:mm')}–{format(endTime, 'HH:mm')}</span>
            </div>
          </div>
        </div>

        {/* Статус і дії */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {displayPrice != null && (
            <div className="hidden sm:block text-sm font-semibold text-emerald-400 tabular-nums mr-1">
              {displayPrice} грн
            </div>
          )}
          <StatusSwitcher
            status={appointment.status}
            isFromBooking={appointment.isFromBooking === true}
            onStatusChange={onStatusChange ?? (() => {})}
            appointmentId={appointment.id}
            disabled={!onStatusChange}
            size="sm"
            customPrice={appointment.customPrice}
            hasServicesFromPriceList={serviceIds.length > 0}
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

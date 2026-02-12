'use client'

import { format, differenceInMinutes, isValid } from 'date-fns'
import { fixMojibake } from '@/lib/utils'

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

export interface Appointment {
  id: string
  masterId: string
  clientName: string
  clientPhone: string
  startTime: string
  endTime: string
  status: string
  services: string
  master: {
    id: string
    name: string
  }
}

interface AppointmentCardProps {
  appointment: Appointment
  slotTime: Date
  getStatusColor: (status: string) => string
}

export function AppointmentCard({
  appointment,
  slotTime,
  getStatusColor,
}: AppointmentCardProps) {
  const startTimeRaw = new Date(appointment.startTime)
  const endTimeRaw = new Date(appointment.endTime)
  const startTime = isValid(startTimeRaw) ? startTimeRaw : new Date()
  const endTime = isValid(endTimeRaw) ? endTimeRaw : startTime
  const duration = differenceInMinutes(endTime, startTime)
  const rowSpan = Math.max(1, Math.ceil(duration / 15))

  let services: string[] = []
  try {
    const parsed = JSON.parse(appointment.services)
    services = Array.isArray(parsed) ? parsed : []
  } catch {
    services = []
  }

  return (
    <div
      className={`absolute inset-0 border-l-4 ${getStatusColor(
        appointment.status
      )} p-2 text-xs overflow-hidden`}
      style={{ height: `${rowSpan * 100}%`, zIndex: 10 }}
    >
      <div className="font-semibold text-secondary mb-1">
        {fixMojibake(appointment.clientName)}
      </div>
      <div className="text-secondary/70 text-[10px] mb-1 tabular-nums">
        {format(startTime, 'HH:mm')}–{format(endTime, 'HH:mm')}
      </div>
      {services.length > 0 && (
        <div className="text-secondary/60 text-[10px]">
          {services.length} послуг
        </div>
      )}
      <div className="text-secondary/50 text-[10px] mt-1">
        {getStatusLabel(appointment.status)}
      </div>
    </div>
  )
}


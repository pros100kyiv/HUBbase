import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeUaPhone } from '@/lib/utils/phone'
import type { Prisma } from '@prisma/client'

const STATUSES = ['Pending', 'Confirmed', 'Done', 'Cancelled'] as const
type Status = (typeof STATUSES)[number]

const UK_TO_STATUS: Record<string, Status> = {
  Очікує: 'Pending',
  Підтверджено: 'Confirmed',
  Виконано: 'Done',
  Скасовано: 'Cancelled',
}

function normalizeStatusInput(s: unknown): string {
  if (s == null) return ''
  const v = String(s).trim()
  return UK_TO_STATUS[v] ?? v
}

function toStatus(s: unknown): Status | null {
  const v = normalizeStatusInput(s)
  if (!v) return null
  return STATUSES.includes(v as Status) ? (v as Status) : null
}


function toServicesJson(value: unknown): string | null {
  if (value == null) return null
  try {
    const arr = typeof value === 'string' ? JSON.parse(value) : value
    if (!Array.isArray(arr)) return null
    return JSON.stringify(arr)
  } catch {
    return null
  }
}

function toStrOrNull(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

function toIntOrNull(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function toDateOrNull(value: unknown): Date | null {
  if (value == null) return null
  const d = new Date(value as string | number)
  return Number.isFinite(d.getTime()) ? d : null
}

async function resolveParams(
  context: { params: Promise<{ id: string }> | { id: string } }
): Promise<{ id: string } | null> {
  try {
    const p = context.params
    if (p && typeof (p as Promise<unknown>).then === 'function') {
      return await (p as Promise<{ id: string }>)
    }
    return p as { id: string }
  } catch {
    return null
  }
}

function getBusinessId(request: Request, body: Record<string, unknown>): string | null {
  const fromUrl = new URL(request.url).searchParams.get('businessId')
  const fromBody = body?.businessId
  const v = fromBody ?? fromUrl
  return v != null && typeof v === 'string' && v.trim() ? v.trim() : null
}

async function getBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const b = await request.json()
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {}
  } catch {
    return null
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const params = await resolveParams(context)
  if (!params?.id) {
    return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 })
  }
  const appointmentId = params.id

  const body = await getBody(request)
  if (body === null) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const businessId = getBusinessId(request, body)
  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
  }

  const exists = await prisma.appointment.findFirst({
    where: { id: appointmentId, businessId },
    select: { id: true },
  })
  if (!exists) {
    return NextResponse.json({ error: 'Appointment not found or access denied' }, { status: 404 })
  }

  const bodyKeys = Object.keys(body).filter(k => k !== 'businessId')
  const statusOnly = bodyKeys.length === 1 && body.status != null
  const newStatus = toStatus(body.status)

  if (statusOnly && !newStatus) {
    return NextResponse.json(
      { error: 'Invalid status value. Use: Pending, Confirmed, Done, Cancelled (or Ukrainian equivalents)' },
      { status: 400 }
    )
  }

  if (statusOnly && newStatus) {
    try {
      const result = await prisma.appointment.updateMany({
        where: { id: appointmentId, businessId },
        data: { status: newStatus },
      })
      if (result.count === 0) {
        return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
      }
      const updated = await prisma.appointment.findUniqueOrThrow({
        where: { id: appointmentId },
      })
      if (newStatus === 'Confirmed' || newStatus === 'Cancelled') {
        const { sendAppointmentNotificationToTelegram } = await import('@/lib/services/appointment-telegram-notify')
        sendAppointmentNotificationToTelegram(
          businessId,
          appointmentId,
          newStatus === 'Confirmed' ? 'confirmed' : 'cancelled'
        ).catch((e) => console.error('TG notify:', e))
      }
      return NextResponse.json(updated)
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'P2025') return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
      return NextResponse.json({ error: 'Update failed', details: process.env.NODE_ENV === 'development' ? String(err) : undefined }, { status: 400 })
    }
  }

  const data: Prisma.AppointmentUpdateInput = {}

  if (newStatus) data.status = newStatus
  const startTime = toDateOrNull(body.startTime)
  if (startTime) data.startTime = startTime
  const endTime = toDateOrNull(body.endTime)
  if (endTime) data.endTime = endTime
  const masterId = toStrOrNull(body.masterId)
  if (masterId) data.master = { connect: { id: masterId } }
  const clientName = toStrOrNull(body.clientName)
  if (clientName) data.clientName = clientName
  if (body.clientPhone != null && String(body.clientPhone).trim()) {
    data.clientPhone = normalizeUaPhone(String(body.clientPhone))
  }
  if (body.clientEmail !== undefined) data.clientEmail = toStrOrNull(body.clientEmail)
  const servicesJson = toServicesJson(body.services)
  if (servicesJson !== null) data.services = servicesJson
  if (body.notes !== undefined) data.notes = toStrOrNull(body.notes)
  if (body.procedureDone !== undefined) data.procedureDone = toStrOrNull(body.procedureDone)
  if (body.customPrice !== undefined) data.customPrice = toIntOrNull(body.customPrice)
  if (body.customServiceName !== undefined) data.customServiceName = toStrOrNull(body.customServiceName)
  else if (body.customService !== undefined) data.customServiceName = toStrOrNull(body.customService)

  if (Object.keys(data).length === 0) {
    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    })
    if (!current) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(current)
  }

  if (data.clientPhone && data.clientName) {
    const phone = data.clientPhone as string
    const name = data.clientName as string
    try {
      const client = await prisma.client.upsert({
        where: { businessId_phone: { businessId, phone } },
        create: {
          businessId,
          name,
          phone,
          email: (data.clientEmail as string) ?? null,
        },
        update: {
          name,
          ...(data.clientEmail !== undefined ? { email: data.clientEmail } : {}),
        },
      })
      data.client = { connect: { id: client.id } }
      try {
        const { addClientPhoneToDirectory } = await import('@/lib/services/management-center')
        await addClientPhoneToDirectory(phone, businessId, client.id, name)
      } catch {
        // non-blocking
      }
    } catch {
      return NextResponse.json({ error: 'Invalid client data' }, { status: 400 })
    }
  }

  try {
    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data,
    })
    const isReschedule = startTime && endTime
    const statusChanged = newStatus && (newStatus === 'Confirmed' || newStatus === 'Cancelled')
    if (statusChanged || isReschedule) {
      const { sendAppointmentNotificationToTelegram } = await import('@/lib/services/appointment-telegram-notify')
      if (newStatus === 'Cancelled') {
        sendAppointmentNotificationToTelegram(businessId, appointmentId, 'cancelled').catch((e) =>
          console.error('TG notify:', e)
        )
      } else if (newStatus === 'Confirmed') {
        sendAppointmentNotificationToTelegram(businessId, appointmentId, 'confirmed').catch((e) =>
          console.error('TG notify:', e)
        )
      } else if (isReschedule && startTime && endTime) {
        sendAppointmentNotificationToTelegram(businessId, appointmentId, 'rescheduled', {
          newStartTime: startTime,
          newEndTime: endTime,
        }).catch((e) => console.error('TG notify:', e))
      }
    }
    return NextResponse.json(updated)
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    return NextResponse.json({ error: 'Update failed', details: process.env.NODE_ENV === 'development' ? String(err) : undefined }, { status: 400 })
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const params = await resolveParams(context)
  if (!params?.id) {
    return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 })
  }
  const businessId = new URL(request.url).searchParams.get('businessId')
  if (!businessId?.trim()) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
  }
  const appointment = await prisma.appointment.findFirst({
    where: { id: params.id, businessId: businessId.trim() },
    include: { master: { select: { id: true, name: true } }, client: { select: { id: true, name: true, phone: true } } },
  })
  if (!appointment) {
    return NextResponse.json({ error: 'Appointment not found or access denied' }, { status: 404 })
  }
  return NextResponse.json(appointment)
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const params = await resolveParams(context)
  if (!params?.id) {
    return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 })
  }
  const id = params.id

  let businessId: string | null = new URL(request.url).searchParams.get('businessId')
  if (!businessId) {
    const body = await getBody(request)
    businessId = body ? getBusinessId(request, body) : null
  }
  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
  }

  const exists = await prisma.appointment.findFirst({
    where: { id, businessId },
    select: { id: true },
  })
  if (!exists) {
    return NextResponse.json({ error: 'Appointment not found or access denied' }, { status: 404 })
  }

  try {
    await prisma.appointment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === 'P2025') return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    return NextResponse.json({ error: 'Delete failed' }, { status: 400 })
  }
}

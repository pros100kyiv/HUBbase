import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

const STATUSES = ['Pending', 'Confirmed', 'Done', 'Cancelled'] as const
type Status = (typeof STATUSES)[number]

function toStatus(s: unknown): Status | null {
  if (s == null) return null
  const v = String(s)
  return STATUSES.includes(v as Status) ? (v as Status) : null
}

function toPhone(phone: string): string {
  let s = String(phone ?? '').replace(/\s/g, '').replace(/[()-]/g, '').trim()
  if (s.startsWith('0')) return `+380${s.slice(1)}`
  if (s.startsWith('380')) return `+${s}`
  if (!s.startsWith('+380')) return `+380${s}`
  return s
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

  if (statusOnly && newStatus) {
    try {
      const updated = await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: newStatus },
      })
      return NextResponse.json(updated)
    } catch {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }
  }

  const data: Prisma.AppointmentUpdateInput = {}

  if (newStatus) data.status = newStatus
  const startTime = toDateOrNull(body.startTime)
  if (startTime) data.startTime = startTime
  const endTime = toDateOrNull(body.endTime)
  if (endTime) data.endTime = endTime
  const masterId = toStrOrNull(body.masterId)
  if (masterId) data.masterId = masterId
  const clientName = toStrOrNull(body.clientName)
  if (clientName) data.clientName = clientName
  if (body.clientPhone != null && String(body.clientPhone).trim()) {
    data.clientPhone = toPhone(String(body.clientPhone))
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
      data.clientId = client.id
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
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Appointment not found or invalid data' }, { status: 404 })
  }
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
  } catch {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
  }
}

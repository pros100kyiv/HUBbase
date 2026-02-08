import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ALLOWED_STATUSES = ['Pending', 'Confirmed', 'Done', 'Cancelled'] as const

function normalizeUaPhone(phone: string): string {
  let s = String(phone ?? '').replace(/\s/g, '').replace(/[()-]/g, '').trim()
  if (s.startsWith('0')) s = `+380${s.slice(1)}`
  else if (s.startsWith('380')) s = `+${s}`
  else if (!s.startsWith('+380')) s = `+380${s}`
  return s
}

function safeJsonArray(value: unknown): string | null {
  try {
    const arr = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(arr) ? JSON.stringify(arr) : null
  } catch {
    return null
  }
}

/** Ніколи не повертає 500 — усі помилки перетворюються на 400/404 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  let appointmentId: string
  let businessId: string
  let body: Record<string, unknown>

  try {
    const params = context.params
    const resolved = typeof (params as Promise<unknown>)?.then === 'function'
      ? await (params as Promise<{ id?: string }>)
      : (params as { id?: string })
    appointmentId = resolved?.id ?? ''
    if (!appointmentId || typeof appointmentId !== 'string') {
      return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 })
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (!body || typeof body !== 'object') body = {}

    const fromQuery = new URL(request.url).searchParams.get('businessId')
    const bid = (body.businessId ?? fromQuery) as string | undefined
    if (!bid || typeof bid !== 'string') {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }
    businessId = bid
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const existing = await prisma.appointment.findFirst({
    where: { id: appointmentId, businessId },
    select: { id: true, businessId: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Appointment not found or access denied' }, { status: 404 })
  }

  const status = body.status != null ? String(body.status) : null
  const hasStatusOnly = Object.keys(body).filter(k => k !== 'businessId').length === 1 && body.status != null

  if (hasStatusOnly && status && ALLOWED_STATUSES.includes(status as typeof ALLOWED_STATUSES[number])) {
    try {
      const updated = await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: status as typeof ALLOWED_STATUSES[number] },
      })
      return NextResponse.json(updated)
    } catch {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }
  }

  const updateData: Record<string, unknown> = {}
  if (status && ALLOWED_STATUSES.includes(status as typeof ALLOWED_STATUSES[number])) {
    updateData.status = status
  }
  if (body.startTime != null) {
    const d = new Date(body.startTime as string | number)
    if (Number.isFinite(d.getTime())) updateData.startTime = d
  }
  if (body.endTime != null) {
    const d = new Date(body.endTime as string | number)
    if (Number.isFinite(d.getTime())) updateData.endTime = d
  }
  if (body.masterId != null && String(body.masterId).trim()) updateData.masterId = String(body.masterId).trim()
  if (body.clientName != null && String(body.clientName).trim()) updateData.clientName = String(body.clientName).trim()
  if (body.clientPhone != null && String(body.clientPhone).trim()) updateData.clientPhone = normalizeUaPhone(String(body.clientPhone))
  if (body.clientEmail !== undefined) updateData.clientEmail = String(body.clientEmail ?? '').trim() || null
  if (body.services !== undefined) {
    const svc = safeJsonArray(body.services)
    if (svc !== null) updateData.services = svc
  }
  if (body.notes !== undefined) updateData.notes = String(body.notes ?? '').trim() || null
  if (body.procedureDone !== undefined) updateData.procedureDone = String(body.procedureDone ?? '').trim() || null
  if (body.customPrice !== undefined) {
    const n = body.customPrice === null ? null : Number(body.customPrice)
    updateData.customPrice = n != null && Number.isFinite(n) ? n : null
  }
  if (body.customServiceName !== undefined) updateData.customServiceName = String(body.customServiceName ?? '').trim() || null
  else if (body.customService !== undefined) updateData.customServiceName = String(body.customService ?? '').trim() || null

  if (Object.keys(updateData).length === 0) {
    const current = await prisma.appointment.findUnique({ where: { id: appointmentId } })
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(current)
  }

  const needClient = updateData.clientPhone && updateData.clientName
  try {
    if (needClient) {
      const phone = String(updateData.clientPhone ?? '')
      const name = String(updateData.clientName ?? '')
      const client = await prisma.client.upsert({
        where: { businessId_phone: { businessId, phone } },
        create: { businessId, name, phone, email: (updateData.clientEmail as string) ?? null },
        update: { name, ...(updateData.clientEmail !== undefined ? { email: updateData.clientEmail as string } : {}) },
      })
      updateData.clientId = client.id
      try {
        const { addClientPhoneToDirectory } = await import('@/lib/services/management-center')
        await addClientPhoneToDirectory(phone, businessId, client.id, name)
      } catch {
        // ignore
      }
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: updateData as Record<string, unknown>,
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
  let id: string
  let businessId: string | null = null
  try {
    const params = context.params
    const resolved = typeof (params as Promise<unknown>)?.then === 'function'
      ? await (params as Promise<{ id?: string }>)
      : (params as { id?: string })
    id = resolved?.id ?? ''
    if (!id) return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 })

    businessId = new URL(request.url).searchParams.get('businessId')
    if (!businessId) {
      try {
        const body = await request.json().catch(() => ({}))
        businessId = (body as { businessId?: string }).businessId ?? null
      } catch {
        // ignore
      }
    }
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
  }

  const existing = await prisma.appointment.findFirst({
    where: { id, businessId },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Appointment not found or access denied' }, { status: 404 })
  }

  try {
    await prisma.appointment.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
  }
}

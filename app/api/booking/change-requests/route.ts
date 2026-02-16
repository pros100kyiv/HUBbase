import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addMinutes } from 'date-fns'
import { hashAppointmentAccessToken } from '@/lib/utils/appointment-access-token'
import { parseBookingTimeZone, slotKeyToUtcDate } from '@/lib/utils/booking-settings'

function safeJsonParse(raw: string | null | undefined): any {
  if (!raw || typeof raw !== 'string') return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function getClientChangeSettings(settingsRaw: string | null | undefined) {
  const parsed = safeJsonParse(settingsRaw) || {}
  const cfg = parsed?.clientChangeRequests || {}
  const enabled = cfg?.enabled !== false
  return {
    enabled,
    allowReschedule: cfg?.allowReschedule !== false,
    allowCancel: cfg?.allowCancel !== false,
    minHoursBefore: Number.isFinite(Number(cfg?.minHoursBefore)) ? Math.max(0, Math.round(Number(cfg.minHoursBefore))) : 3,
    requireMasterApproval: cfg?.requireMasterApproval !== false,
  }
}

async function hasConflict(businessId: string, masterId: string, startTime: Date, endTime: Date, excludeId: string) {
  const conflict = await prisma.appointment.findFirst({
    where: {
      businessId,
      masterId,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      status: { notIn: ['Cancelled', 'Скасовано'] },
      id: { not: excludeId },
    },
    select: { id: true },
  })
  return !!conflict
}

export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const typeRaw = typeof body?.type === 'string' ? body.type.trim().toUpperCase() : ''
  const note = typeof body?.note === 'string' ? body.note.trim() : ''
  const slot = typeof body?.slot === 'string' ? body.slot.trim() : ''
  const durationMinutes = Math.max(15, Math.min(480, Math.round(Number(body?.durationMinutes) || 0)))

  if (!token || token.length < 20) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  if (typeRaw !== 'RESCHEDULE' && typeRaw !== 'CANCEL') {
    return NextResponse.json({ error: 'Invalid type. Use RESCHEDULE or CANCEL.' }, { status: 400 })
  }

  const tokenHash = hashAppointmentAccessToken(token)
  const access = await prisma.appointmentAccessToken.findFirst({
    where: { tokenHash, revokedAt: null },
    select: { appointmentId: true, businessId: true },
  })
  if (!access) return NextResponse.json({ error: 'Appointment not found or access denied' }, { status: 404 })

  const appointment = await prisma.appointment.findFirst({
    where: { id: access.appointmentId, businessId: access.businessId },
    select: {
      id: true,
      businessId: true,
      masterId: true,
      startTime: true,
      endTime: true,
      status: true,
      business: { select: { settings: true } },
    },
  })
  if (!appointment) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })

  if (String(appointment.status).toLowerCase().includes('cancel')) {
    return NextResponse.json({ error: 'Цей запис вже скасовано.' }, { status: 409 })
  }
  if (String(appointment.status).toLowerCase().includes('done') || String(appointment.status).toLowerCase().includes('викон')) {
    return NextResponse.json({ error: 'Цей запис вже виконано, його не можна змінити.' }, { status: 409 })
  }

  const settingsRaw = appointment.business?.settings ?? null
  const changeSettings = getClientChangeSettings(settingsRaw)
  if (!changeSettings.enabled) {
    return NextResponse.json({ error: 'Зміни запису для клієнта вимкнені в налаштуваннях.' }, { status: 403 })
  }
  if (typeRaw === 'RESCHEDULE' && !changeSettings.allowReschedule) {
    return NextResponse.json({ error: 'Перенесення запису вимкнене.' }, { status: 403 })
  }
  if (typeRaw === 'CANCEL' && !changeSettings.allowCancel) {
    return NextResponse.json({ error: 'Скасування запису вимкнене.' }, { status: 403 })
  }

  // Rule: only allow change if there is enough time before the visit.
  const now = new Date()
  const minAllowed = new Date(now.getTime() + changeSettings.minHoursBefore * 60 * 60 * 1000)
  if (appointment.startTime < minAllowed) {
    return NextResponse.json(
      { error: `Змінити/скасувати можна мінімум за ${changeSettings.minHoursBefore} год до візиту.` },
      { status: 409 }
    )
  }

  const pendingExists = await prisma.appointmentChangeRequest.findFirst({
    where: {
      businessId: appointment.businessId,
      appointmentId: appointment.id,
      status: 'PENDING',
    },
    select: { id: true },
  })
  if (pendingExists) {
    return NextResponse.json({ error: 'Вже є активний запит на зміну цього запису. Дочекайтесь відповіді майстра.' }, { status: 409 })
  }

  let requestedStartTime: Date | null = null
  let requestedEndTime: Date | null = null

  if (typeRaw === 'RESCHEDULE') {
    if (!slot || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slot)) {
      return NextResponse.json({ error: 'Невірний формат слоту. Очікується "YYYY-MM-DDTHH:mm".' }, { status: 400 })
    }
    const timeZone = parseBookingTimeZone(settingsRaw)
    const startUtc = slotKeyToUtcDate(slot, timeZone)
    if (!startUtc) {
      return NextResponse.json({ error: 'Невірний слот.' }, { status: 400 })
    }

    const currentDur = Math.max(15, Math.round((appointment.endTime.getTime() - appointment.startTime.getTime()) / 60000))
    const dur = durationMinutes > 0 ? durationMinutes : currentDur
    requestedStartTime = startUtc
    requestedEndTime = addMinutes(startUtc, dur)

    const conflict = await hasConflict(appointment.businessId, appointment.masterId, requestedStartTime, requestedEndTime, appointment.id)
    if (conflict) {
      return NextResponse.json({ error: 'На цей час вже є інший запис. Оберіть інший час.' }, { status: 409 })
    }
  }

  const created = await prisma.appointmentChangeRequest.create({
    data: {
      businessId: appointment.businessId,
      appointmentId: appointment.id,
      masterId: appointment.masterId,
      type: typeRaw as any,
      status: 'PENDING',
      requestedStartTime,
      requestedEndTime,
      clientNote: note || null,
    },
  })

  try {
    await prisma.appointmentEvent.create({
      data: {
        businessId: appointment.businessId,
        appointmentId: appointment.id,
        type: 'CLIENT_CHANGE_REQUEST_CREATED',
        data: JSON.stringify({ requestId: created.id, type: created.type }),
      },
    })
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true, request: created }, { status: 201 })
}


import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashAppointmentAccessToken } from '@/lib/utils/appointment-access-token'
import { parseBookingTimeZone } from '@/lib/utils/booking-settings'

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

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token: rawToken } = await context.params
  const token = String(rawToken || '').trim()
  if (!token || token.length < 20) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const tokenHash = hashAppointmentAccessToken(token)
  const access = await prisma.appointmentAccessToken.findFirst({
    where: { tokenHash, revokedAt: null },
    select: { appointmentId: true, businessId: true },
  })
  if (!access) {
    return NextResponse.json({ error: 'Appointment not found or access denied' }, { status: 404 })
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: access.appointmentId, businessId: access.businessId },
    select: {
      id: true,
      businessId: true,
      masterId: true,
      clientName: true,
      startTime: true,
      endTime: true,
      status: true,
      services: true,
      customServiceName: true,
      customPrice: true,
      notes: true,
      isFromBooking: true,
      master: { select: { id: true, name: true } },
      business: { select: { id: true, name: true, slug: true, location: true, settings: true } },
    },
  })
  if (!appointment) {
    return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
  }

  const latestRequest = await prisma.appointmentChangeRequest.findFirst({
    where: { businessId: appointment.businessId, appointmentId: appointment.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      status: true,
      requestedStartTime: true,
      requestedEndTime: true,
      clientNote: true,
      createdAt: true,
      decidedAt: true,
      decisionNote: true,
    },
  })

  const settingsRaw = appointment.business?.settings ?? null
  const timeZone = parseBookingTimeZone(settingsRaw)
  const changeSettings = getClientChangeSettings(settingsRaw)

  return NextResponse.json({
    appointment: {
      id: appointment.id,
      businessId: appointment.businessId,
      masterId: appointment.masterId,
      masterName: appointment.master?.name || null,
      clientName: appointment.clientName,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      status: appointment.status,
      services: appointment.services,
      customServiceName: appointment.customServiceName,
      customPrice: appointment.customPrice,
      notes: appointment.notes,
      isFromBooking: appointment.isFromBooking,
    },
    business: {
      id: appointment.business?.id,
      name: appointment.business?.name,
      slug: appointment.business?.slug,
      location: appointment.business?.location,
      timeZone,
    },
    clientChangeSettings: changeSettings,
    latestRequest,
  })
}


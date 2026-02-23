import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function getBusinessId(request: Request, body: Record<string, unknown>): string | null {
  const fromUrl = new URL(request.url).searchParams.get('businessId')
  const fromBody = body?.businessId
  const v = fromBody ?? fromUrl
  return v != null && typeof v === 'string' && v.trim() ? v.trim() : null
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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const businessId = getBusinessId(request, body)
  if (!businessId) return NextResponse.json({ error: 'businessId is required' }, { status: 400 })

  const action = typeof body?.action === 'string' ? body.action.trim().toLowerCase() : ''
  const decisionNote = typeof body?.decisionNote === 'string' ? body.decisionNote.trim() : ''

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'Invalid action. Use approve/reject.' }, { status: 400 })
  }

  const reqRow = await prisma.appointmentChangeRequest.findFirst({
    where: { id, businessId },
    select: {
      id: true,
      type: true,
      status: true,
      requestedStartTime: true,
      requestedEndTime: true,
      appointmentId: true,
      masterId: true,
    },
  })
  if (!reqRow) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  if (reqRow.status !== 'PENDING') {
    return NextResponse.json({ error: 'Request already processed' }, { status: 409 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const aptExists = await tx.appointment.findFirst({
      where: { id: reqRow.appointmentId, businessId },
      select: { id: true },
    })
    if (!aptExists) {
      throw new Error('Appointment not found or access denied')
    }

    if (action === 'reject') {
      const updated = await tx.appointmentChangeRequest.update({
        where: { id: reqRow.id },
        data: {
          status: 'REJECTED',
          decisionNote: decisionNote || null,
          decidedAt: new Date(),
          decidedBy: 'dashboard',
        },
      })
      try {
        await tx.appointmentEvent.create({
          data: {
            businessId,
            appointmentId: reqRow.appointmentId,
            type: 'CLIENT_CHANGE_REQUEST_REJECTED',
            data: JSON.stringify({ requestId: reqRow.id, type: reqRow.type }),
          },
        })
      } catch {
        // ignore
      }
      return { request: updated, appointment: null }
    }

    // approve
    if (reqRow.type === 'CANCEL') {
      const [updatedReq, updatedApt] = await Promise.all([
        tx.appointmentChangeRequest.update({
          where: { id: reqRow.id },
          data: {
            status: 'APPROVED',
            decisionNote: decisionNote || null,
            decidedAt: new Date(),
            decidedBy: 'dashboard',
          },
        }),
        tx.appointment.update({
          where: { id: reqRow.appointmentId },
          data: { status: 'Cancelled' },
        }),
      ])
      try {
        await tx.appointmentEvent.create({
          data: {
            businessId,
            appointmentId: reqRow.appointmentId,
            type: 'CLIENT_CANCEL_APPROVED',
            data: JSON.stringify({ requestId: reqRow.id }),
          },
        })
      } catch {
        // ignore
      }
      return { request: updatedReq, appointment: updatedApt }
    }

    if (!reqRow.requestedStartTime || !reqRow.requestedEndTime) {
      throw new Error('Missing requestedStartTime/requestedEndTime')
    }
    const conflict = await hasConflict(businessId, reqRow.masterId, reqRow.requestedStartTime, reqRow.requestedEndTime, reqRow.appointmentId)
    if (conflict) {
      throw new Error('CONFLICT')
    }

    const [updatedReq, updatedApt] = await Promise.all([
      tx.appointmentChangeRequest.update({
        where: { id: reqRow.id },
        data: {
          status: 'APPROVED',
          decisionNote: decisionNote || null,
          decidedAt: new Date(),
          decidedBy: 'dashboard',
        },
      }),
      tx.appointment.update({
        where: { id: reqRow.appointmentId },
        data: { startTime: reqRow.requestedStartTime, endTime: reqRow.requestedEndTime },
      }),
    ])

    try {
      await tx.appointmentEvent.create({
        data: {
          businessId,
          appointmentId: reqRow.appointmentId,
          type: 'CLIENT_RESCHEDULE_APPROVED',
          data: JSON.stringify({ requestId: reqRow.id }),
        },
      })
    } catch {
      // ignore
    }

    return { request: updatedReq, appointment: updatedApt }
  })

  if (action === 'reject') {
    const { sendAppointmentNotificationToTelegram } = await import('@/lib/services/appointment-telegram-notify')
    sendAppointmentNotificationToTelegram(businessId, reqRow.appointmentId, 'change_request_rejected', {
      businessNote: decisionNote || undefined,
      rejectedRequestType: reqRow.type,
    }).catch((e) => console.error('TG notify change_request_rejected:', e))
  } else if (action === 'approve' && result.appointment) {
    const { sendAppointmentNotificationToTelegram } = await import('@/lib/services/appointment-telegram-notify')
    if (reqRow.type === 'CANCEL') {
      sendAppointmentNotificationToTelegram(businessId, reqRow.appointmentId, 'cancelled').catch((e) =>
        console.error('TG notify:', e)
      )
    } else if (reqRow.type === 'RESCHEDULE' && reqRow.requestedStartTime && reqRow.requestedEndTime) {
      sendAppointmentNotificationToTelegram(businessId, reqRow.appointmentId, 'rescheduled', {
        newStartTime: reqRow.requestedStartTime,
        newEndTime: reqRow.requestedEndTime,
      }).catch((e) => console.error('TG notify:', e))
    }
  }

  return NextResponse.json(result)
}


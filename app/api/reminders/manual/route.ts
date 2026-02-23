import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWebPush } from '@/lib/services/web-push'

export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const businessId = typeof body?.businessId === 'string' ? body.businessId.trim() : ''
  const appointmentId = typeof body?.appointmentId === 'string' ? body.appointmentId.trim() : ''

  if (!businessId || !appointmentId) {
    return NextResponse.json({ error: 'businessId and appointmentId are required' }, { status: 400 })
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, businessId },
    select: {
      id: true,
      businessId: true,
      startTime: true,
      status: true,
      clientName: true,
      master: { select: { name: true } },
      business: { select: { slug: true, name: true } },
    },
  })
  if (!appointment) {
    return NextResponse.json({ error: 'Appointment not found or access denied' }, { status: 404 })
  }

  const subs = await prisma.pushSubscription.findMany({
    where: { businessId, appointmentId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })

  if (subs.length === 0) {
    // Log attempt for visibility.
    await prisma.reminderLog.create({
      data: {
        businessId,
        appointmentId,
        channel: 'PUSH',
        status: 'FAILED',
        triggeredBy: 'manual',
        error: 'NO_PUSH_SUBSCRIPTIONS',
      },
    })
    return NextResponse.json({ ok: false, sent: 0, error: 'Клієнт ще не увімкнув push-нагадування для цього запису.' }, { status: 200 })
  }

  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://xbase.online')).replace(/\/$/, '')
  const pushUrl = appointment.business?.slug ? `${baseUrl}/booking/${appointment.business.slug}` : baseUrl
  let sent = 0
  const errors: string[] = []
  const deadIds: string[] = []

  for (const s of subs) {
    const result = await sendWebPush(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      {
        title: appointment.business?.name ? `Нагадування: ${appointment.business.name}` : 'Нагадування',
        body: `Запис: ${appointment.master?.name || 'майстер'} · ${new Date(appointment.startTime).toLocaleString('uk-UA')}`,
        url: pushUrl,
        icon: `${baseUrl}/icon.png`,
        badge: `${baseUrl}/icon.png`,
        tag: `reminder-${appointmentId}`,
        vibrate: [200, 100, 200],
      }
    )
    if (result.ok) sent += 1
    else {
      errors.push(result.error)
      if (result.dead) deadIds.push(s.id)
    }
  }

  if (deadIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: deadIds } } }).catch(() => {})
  }

  await prisma.reminderLog.create({
    data: {
      businessId,
      appointmentId,
      channel: 'PUSH',
      status: sent > 0 ? 'SENT' : 'FAILED',
      triggeredBy: 'manual',
      error: errors.length ? errors.slice(0, 5).join(' | ') : null,
    },
  })

  try {
    await prisma.appointmentEvent.create({
      data: {
        businessId,
        appointmentId,
        type: 'MANUAL_REMINDER_PUSH',
        data: JSON.stringify({ sent, errors: errors.length ? errors.slice(0, 3) : [] }),
      },
    })
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: sent > 0, sent, errors: errors.length ? errors.slice(0, 3) : [] })
}


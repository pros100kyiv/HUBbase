import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashAppointmentAccessToken } from '@/lib/utils/appointment-access-token'

type IncomingSubscription = {
  endpoint?: unknown
  keys?: { p256dh?: unknown; auth?: unknown } | null
}

export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const subscription = (body?.subscription || {}) as IncomingSubscription

  const endpoint = typeof subscription?.endpoint === 'string' ? subscription.endpoint.trim() : ''
  const p256dh = typeof subscription?.keys?.p256dh === 'string' ? subscription.keys.p256dh.trim() : ''
  const auth = typeof subscription?.keys?.auth === 'string' ? subscription.keys.auth.trim() : ''

  if (!token || token.length < 20) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 })
  }

  const tokenHash = hashAppointmentAccessToken(token)
  const access = await prisma.appointmentAccessToken.findFirst({
    where: { tokenHash, revokedAt: null },
    select: { appointmentId: true, businessId: true },
  })
  if (!access) {
    return NextResponse.json({ error: 'Appointment not found or access denied' }, { status: 404 })
  }

  // Multi-tenant safety: bind subscription to (businessId, appointmentId).
  await prisma.pushSubscription.upsert({
    where: { appointmentId_endpoint: { appointmentId: access.appointmentId, endpoint } },
    create: {
      businessId: access.businessId,
      appointmentId: access.appointmentId,
      endpoint,
      p256dh,
      auth,
      userAgent: request.headers.get('user-agent'),
    },
    update: {
      p256dh,
      auth,
      userAgent: request.headers.get('user-agent'),
    },
  })

  return NextResponse.json({ ok: true })
}


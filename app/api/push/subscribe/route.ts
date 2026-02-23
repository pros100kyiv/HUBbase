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
  const subscription = (body?.subscription || {}) as IncomingSubscription & { keys?: { p256dh?: string; p256DH?: string; auth?: string } }

  const endpoint = typeof subscription?.endpoint === 'string' ? subscription.endpoint.trim() : ''
  const keys = subscription?.keys
  const p256dh = (typeof keys?.p256dh === 'string' ? keys.p256dh : typeof keys?.p256DH === 'string' ? keys.p256DH : '')?.trim() ?? ''
  const auth = (typeof keys?.auth === 'string' ? keys.auth : '')?.trim() ?? ''

  if (!token || token.length < 20) {
    return NextResponse.json({ error: 'Немає токена доступу до запису. Оновіть сторінку та спробуйте знову.' }, { status: 400 })
  }
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({
      error: 'Неправильний формат підписки (endpoint або keys відсутні). Спробуйте в іншому браузері.',
    }, { status: 400 })
  }

  const tokenHash = hashAppointmentAccessToken(token)
  let access: { appointmentId: string; businessId: string } | null = null
  try {
    access = await prisma.appointmentAccessToken.findFirst({
      where: { tokenHash, revokedAt: null },
      select: { appointmentId: true, businessId: true },
    })
  } catch (e) {
    console.error('Push subscribe: DB error', e)
    return NextResponse.json({ error: 'Помилка сервера. Спробуйте пізніше.' }, { status: 500 })
  }
  if (!access) {
    return NextResponse.json({
      error: 'Запис не знайдено або посилання застаріло. Відкрийте сторінку керування записом знову.',
    }, { status: 404 })
  }

  try {
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
  } catch (e) {
    console.error('Push subscribe: upsert error', e)
    return NextResponse.json({ error: 'Не вдалося зберегти підписку. Спробуйте пізніше.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}


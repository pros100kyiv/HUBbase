/**
 * Підписка на push-сповіщення про нові записи (для власника бізнесу).
 * Викликається з dashboard при увімкненні "Сповіщення про нові записи".
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type IncomingSubscription = {
  endpoint?: unknown
  keys?: { p256dh?: unknown; p256DH?: unknown; auth?: unknown } | null
}

export async function POST(request: Request) {
  let body: { businessId?: unknown; subscription?: IncomingSubscription & { keys?: { p256dh?: string; p256DH?: string; auth?: string } } }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const businessId = typeof body?.businessId === 'string' ? body.businessId.trim() : ''
  const subscription = (body?.subscription || {}) as IncomingSubscription & { keys?: { p256dh?: string; p256DH?: string; auth?: string } }

  const endpoint = typeof subscription?.endpoint === 'string' ? subscription.endpoint.trim() : ''
  const keys = subscription?.keys
  const p256dh = (typeof keys?.p256dh === 'string' ? keys.p256dh : typeof keys?.p256DH === 'string' ? keys.p256DH : '')?.trim() ?? ''
  const auth = (typeof keys?.auth === 'string' ? keys.auth : '')?.trim() ?? ''

  if (!businessId) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
  }
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({
      error: 'Неправильний формат підписки (endpoint або keys відсутні). Спробуйте в іншому браузері.',
    }, { status: 400 })
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  })
  if (!business) {
    return NextResponse.json({ error: 'Бізнес не знайдено' }, { status: 404 })
  }

  try {
    await prisma.businessStaffPushSubscription.upsert({
      where: { businessId_endpoint: { businessId, endpoint } },
      create: {
        businessId,
        endpoint,
        p256dh,
        auth,
        userAgent: request.headers.get('user-agent'),
      },
      update: { p256dh, auth, userAgent: request.headers.get('user-agent') },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Push subscribe-business: upsert error', e)
    return NextResponse.json({ error: 'Не вдалося зберегти підписку. Спробуйте пізніше.' }, { status: 500 })
  }
}

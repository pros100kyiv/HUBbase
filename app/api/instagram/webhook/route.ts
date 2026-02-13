import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/utils/device'
import { checkRateLimit } from '@/lib/utils/rate-limit'

const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN
const APP_SECRET = process.env.META_APP_SECRET

function isValidMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false
  }

  const providedHex = signatureHeader.slice('sha256='.length)
  if (!providedHex) {
    return false
  }

  const expectedHex = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex')

  const provided = Buffer.from(providedHex, 'hex')
  const expected = Buffer.from(expectedHex, 'hex')
  if (provided.length !== expected.length) {
    return false
  }

  return crypto.timingSafeEqual(provided, expected)
}

/**
 * GET — перевірка підписки Meta (hub.mode=subscribe, hub.verify_token, hub.challenge).
 */
export async function GET(request: NextRequest) {
  if (!VERIFY_TOKEN) {
    return NextResponse.json({ error: 'Instagram webhook verify token is not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  return NextResponse.json({ error: 'Invalid verification' }, { status: 403 })
}

/**
 * POST — події Instagram Messaging: зберігаємо вхідні повідомлення в SocialInboxMessage.
 * Payload: { object: 'instagram', entry: [ { id: ig_account_id, time, messaging: [ { sender: { id }, recipient: { id }, message: { mid, text } } ] } ] }
 */
export async function POST(request: NextRequest) {
  if (!APP_SECRET) {
    return NextResponse.json({ error: 'Instagram webhook app secret is not configured' }, { status: 503 })
  }

  try {
    const clientIp = getClientIp(request) || 'unknown'
    const rateLimit = checkRateLimit({
      key: `instagram-webhook:${clientIp}`,
      maxRequests: 240,
      windowMs: 60 * 1000,
    })
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } }
      )
    }

    const rawBody = await request.text()
    const signature = request.headers.get('x-hub-signature-256')
    if (!isValidMetaSignature(rawBody, signature, APP_SECRET)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 403 })
    }

    const body = JSON.parse(rawBody) as {
      object?: string
      entry?: Array<{
        id: string
        time?: number
        messaging?: Array<{
          sender: { id: string }
          recipient: { id: string }
          timestamp?: string
          message?: { mid?: string; text?: string }
        }>
      }>
    }

    if (body.object !== 'instagram' || !Array.isArray(body.entry)) {
      return NextResponse.json({ ok: true })
    }

    for (const entry of body.entry) {
      const ourIgId = entry.id
      const events = entry.messaging
      if (!Array.isArray(events)) continue

      const integration = await prisma.socialIntegration.findFirst({
        where: { platform: 'instagram', userId: ourIgId, isConnected: true },
        select: { businessId: true },
      })
      if (!integration) continue

      for (const ev of events) {
        const senderId = ev.sender?.id
        const text = ev.message?.text
        const mid = ev.message?.mid
        if (!senderId || text == null) continue

        await prisma.socialInboxMessage.create({
          data: {
            businessId: integration.businessId,
            platform: 'instagram',
            direction: 'inbound',
            externalId: mid ?? undefined,
            externalChatId: senderId,
            senderId,
            senderName: 'Користувач Instagram',
            message: text,
            isRead: false,
          },
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Instagram webhook POST error:', e)
    return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || 'xbase-instagram-verify'

/**
 * GET — перевірка підписки Meta (hub.mode=subscribe, hub.verify_token, hub.challenge).
 */
export async function GET(request: NextRequest) {
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
  try {
    const body = await request.json() as {
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
    return NextResponse.json({ ok: true })
  }
}

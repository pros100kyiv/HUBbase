import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

const APP_SECRET = process.env.META_APP_SECRET

/**
 * Base64url decode (Meta signed_request uses base64url without padding).
 */
function base64UrlDecode(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4
  if (pad) base64 += '='.repeat(4 - pad)
  return Buffer.from(base64, 'base64')
}

/**
 * Verify and decode Facebook signed_request.
 * Returns payload object or null if invalid.
 */
function parseSignedRequest(signedRequest: string): { user_id: string } | null {
  if (!APP_SECRET) return null
  const [encodedSig, encodedPayload] = signedRequest.split('.', 2)
  if (!encodedSig || !encodedPayload) return null

  try {
    const payload = base64UrlDecode(encodedPayload)
    const sig = base64UrlDecode(encodedSig)
    const expectedSig = crypto
      .createHmac('sha256', APP_SECRET)
      .update(encodedPayload)
      .digest()
    if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(sig, expectedSig)) {
      return null
    }
    const data = JSON.parse(payload.toString('utf8')) as { user_id?: string }
    if (typeof data.user_id !== 'string') return null
    return { user_id: data.user_id }
  } catch {
    return null
  }
}

/**
 * POST /api/facebook/data-deletion
 * Meta Data Deletion Callback — викликається, коли користувач запитує видалення даних у налаштуваннях Facebook.
 * Документація: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
 */
export async function POST(request: NextRequest) {
  if (!APP_SECRET) {
    return NextResponse.json(
      { error: 'Data deletion callback is not configured' },
      { status: 503 }
    )
  }

  try {
    const formData = await request.formData()
    const signedRequest = formData.get('signed_request')?.toString()
    if (!signedRequest) {
      return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 })
    }

    const payload = parseSignedRequest(signedRequest)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid signed_request' }, { status: 400 })
    }

    const facebookUserId = payload.user_id
    const confirmationCode = `xbase-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
    const origin = baseUrl
      ? (baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`).replace(/\/$/, '')
      : 'https://xbase.online'
    const statusUrl = `${origin}/data-deletion?code=${encodeURIComponent(confirmationCode)}`

    // Видаляємо/відключаємо інтеграції, пов’язані з цим Facebook user (metadata.facebookUserId)
    const integrations = await prisma.socialIntegration.findMany({
      where: { platform: { in: ['instagram', 'facebook'] } },
    })
    for (const integration of integrations) {
      let meta: { facebookUserId?: string } = {}
      try {
        if (integration.metadata) meta = JSON.parse(integration.metadata) as { facebookUserId?: string }
      } catch {
        /* ignore */
      }
      if (meta.facebookUserId === facebookUserId) {
        await prisma.socialIntegration.update({
          where: { id: integration.id },
          data: {
            isConnected: false,
            accessToken: null,
            refreshToken: null,
            userId: null,
            username: null,
            metadata: null,
            lastSyncAt: null,
          },
        })
      }
    }

    return NextResponse.json({
      url: statusUrl,
      confirmation_code: confirmationCode,
    })
  } catch (e) {
    console.error('Data deletion callback error:', e)
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    )
  }
}

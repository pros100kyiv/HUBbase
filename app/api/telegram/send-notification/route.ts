import { NextRequest, NextResponse } from 'next/server'
import { sendTelegramNotification } from '@/lib/telegram'

/**
 * Відправка сповіщення через Telegram
 * POST /api/telegram/send-notification
 * Body: { businessId, message, onlyToRole?, excludeRole? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessId, message, onlyToRole, excludeRole } = body

    if (!businessId || !message) {
      return NextResponse.json({ error: 'Missing businessId or message' }, { status: 400 })
    }

    await sendTelegramNotification(businessId, message, {
      onlyToRole,
      excludeRole,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending notification:', error)
    return NextResponse.json(
      { error: 'Failed to send notification', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'

/**
 * POST /api/telegram/set-webhook
 * Встановлює webhook для Telegram бота бізнесу (один клік з кабінету).
 * Body: { businessId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const businessId = body.businessId || (request.headers.get('content-type')?.includes('json') ? undefined : null)

    if (!businessId || typeof businessId !== 'string') {
      return NextResponse.json({ error: 'businessId обов\'язковий', success: false }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, telegramBotToken: true },
    })

    if (!business?.telegramBotToken) {
      return NextResponse.json({
        error: 'Спочатку підключіть Telegram бота (токен) в налаштуваннях.',
        success: false,
      }, { status: 400 })
    }

    const webhookUrl = `${BASE_URL.replace(/\/$/, '')}/api/telegram/webhook?businessId=${business.id}`

    const res = await fetch(`https://api.telegram.org/bot${business.telegramBotToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    })

    const data = await res.json().catch(() => ({ ok: false }))

    if (!data.ok) {
      console.error('Telegram setWebhook error:', data)
      return NextResponse.json({
        success: false,
        error: data.description || 'Telegram не прийняв webhook. Спробуйте пізніше.',
      }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      message: 'Готово! Повідомлення з Telegram тепер будуть приходити в кабінет.',
      webhookUrl,
    })
  } catch (error) {
    console.error('set-webhook error:', error)
    return NextResponse.json({
      success: false,
      error: 'Помилка налаштування. Спробуйте пізніше.',
    }, { status: 500 })
  }
}

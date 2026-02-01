import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateSlug } from '@/lib/auth'

/**
 * Реєстрація нового бізнесу через Telegram
 * POST /api/telegram/business-register
 * Body: { name, email, phone, niche, telegramBotToken?, telegramChatId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, niche, telegramBotToken, telegramChatId, password } = body

    if (!name || !email || !niche) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, niche' },
        { status: 400 }
      )
    }

    // Перевіряємо чи email вже використовується
    const existing = await prisma.business.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (existing) {
      return NextResponse.json({ error: 'Business with this email already exists' }, { status: 409 })
    }

    // Генеруємо slug
    const slug = generateSlug(name)

    // Створюємо бізнес
    const business = await prisma.business.create({
      data: {
        name: name.trim(),
        slug,
        email: email.toLowerCase().trim(),
        phone: phone?.trim() || null,
        niche: niche as any, // BusinessNiche enum
        password: password ? await import('bcryptjs').then(m => m.hash(password, 10)) : null,
        telegramBotToken: telegramBotToken || null,
        telegramChatId: telegramChatId || null,
        telegramNotificationsEnabled: !!telegramBotToken,
        isActive: true,
      },
    })

    return NextResponse.json({ success: true, business }, { status: 201 })
  } catch (error) {
    console.error('Error registering business:', error)
    return NextResponse.json(
      { error: 'Failed to register business', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


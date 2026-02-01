import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Реєстрація користувача в Telegram боті
 * POST /api/telegram/register
 * Body: { businessId, telegramId, role?, permissions? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessId, telegramId, role = 'VIEWER', permissions, username, firstName, lastName } = body

    if (!businessId || !telegramId) {
      return NextResponse.json({ error: 'Missing businessId or telegramId' }, { status: 400 })
    }

    // Перевіряємо чи бізнес існує
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Створюємо або оновлюємо користувача
    const telegramUser = await prisma.telegramUser.upsert({
      where: {
        telegramId: BigInt(telegramId),
      },
      update: {
        businessId,
        username,
        firstName,
        lastName,
        role,
        permissions: permissions ? JSON.stringify(permissions) : null,
        isActive: true,
        lastActivity: new Date(),
      },
      create: {
        telegramId: BigInt(telegramId),
        businessId,
        username,
        firstName,
        lastName,
        role,
        permissions: permissions ? JSON.stringify(permissions) : null,
        isActive: true,
        lastActivity: new Date(),
      },
    })

    return NextResponse.json({ success: true, user: telegramUser })
  } catch (error) {
    console.error('Error registering Telegram user:', error)
    return NextResponse.json(
      { error: 'Failed to register user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


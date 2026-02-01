import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Отримання списку активних паролів активації
 * GET /api/telegram/passwords?businessId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })
    }

    // Отримуємо всіх користувачів з активними паролями (ще не активовані)
    const usersWithPasswords = await prisma.telegramUser.findMany({
      where: {
        businessId,
        activationPassword: { not: null },
        activatedAt: null, // Ще не активовані
      },
      select: {
        id: true,
        role: true,
        activationPassword: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(usersWithPasswords)
  } catch (error) {
    console.error('Error fetching passwords:', error)
    return NextResponse.json(
      { error: 'Failed to fetch passwords', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


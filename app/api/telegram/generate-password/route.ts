import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

/**
 * Генерація пароля активації для Telegram користувача
 * POST /api/telegram/generate-password
 * Body: { businessId, role, firstName?, lastName? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessId, role, firstName, lastName } = body

    if (!businessId || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: businessId, role' },
        { status: 400 }
      )
    }

    // Перевіряємо чи бізнес існує
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Генеруємо унікальний пароль (8 символів, буквено-цифровий)
    const password = crypto.randomBytes(4).toString('hex').toUpperCase()

    // Створюємо запис користувача з паролем активації
    const telegramUser = await prisma.telegramUser.create({
      data: {
        businessId,
        telegramId: BigInt(0), // Тимчасово, буде оновлено при активації
        role: role as any,
        firstName: firstName || null,
        lastName: lastName || null,
        activationPassword: password,
        isActive: true,
        activatedAt: null, // Ще не активований
      },
    })

    return NextResponse.json({
      success: true,
      password,
      userId: telegramUser.id,
      expiresIn: '7 days', // Пароль дійсний 7 днів
    })
  } catch (error) {
    console.error('Error generating activation password:', error)
    return NextResponse.json(
      { error: 'Failed to generate password', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


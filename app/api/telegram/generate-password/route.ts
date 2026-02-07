import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

/**
 * Генерує пароль активації для Telegram бота.
 * POST /api/telegram/generate-password
 * Body: { businessId: string, role: 'ADMIN' | 'CLIENT', firstName?: string, lastName?: string }
 * Створює запис TelegramUser з унікальним placeholder telegramId та activationPassword.
 * Користувач використовує /start <пароль> в боті для активації.
 */
function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/** Унікальний placeholder telegramId для "очікуючих" користувачів (до активації). */
function placeholderTelegramId(): bigint {
  return BigInt(-(Date.now() * 1000 + Math.floor(Math.random() * 1000)))
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, role, firstName, lastName } = body

    if (!businessId) {
      return NextResponse.json({ success: false, error: 'businessId обов\'язковий' }, { status: 400 })
    }

    const roleValue = role === 'ADMIN' ? UserRole.ADMIN : UserRole.CLIENT

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })
    if (!business) {
      return NextResponse.json({ success: false, error: 'Бізнес не знайдено' }, { status: 404 })
    }

    const password = generatePassword()
    const placeholderId = placeholderTelegramId()

    const user = await prisma.telegramUser.create({
      data: {
        businessId,
        telegramId: placeholderId,
        role: roleValue,
        activationPassword: password,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        isActive: true,
      },
      select: {
        id: true,
        role: true,
        activationPassword: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      id: user.id,
      activationPassword: user.activationPassword,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
    })
  } catch (error) {
    console.error('Error generating Telegram password:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Помилка генерації пароля',
      },
      { status: 500 }
    )
  }
}

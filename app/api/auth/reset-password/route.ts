import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { z } from 'zod'

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Токен обов\'язковий'),
  password: z.string().min(6, 'Пароль має бути мінімум 6 символів'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = resetPasswordSchema.parse(body)

    // Шукаємо бізнес за токеном (select без telegramWebhookSetAt)
    const business = await prisma.business.findFirst({
      where: {
        resetToken: validated.token,
        resetTokenExpiry: {
          gt: new Date(), // Токен ще не закінчився
        },
      },
      select: { id: true },
    })

    if (!business) {
      return NextResponse.json(
        { error: 'Невірний або застарілий токен відновлення' },
        { status: 400 }
      )
    }

    // Хешуємо новий пароль
    const hashedPassword = await hashPassword(validated.password)

    // Оновлюємо пароль та очищаємо токен (select без telegramWebhookSetAt)
    await prisma.business.update({
      where: { id: business.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
      select: { id: true },
    })

    // Синхронізуємо з ManagementCenter
    try {
      const { syncBusinessToManagementCenter } = await import('@/lib/services/management-center')
      await syncBusinessToManagementCenter(business.id)
    } catch (error) {
      console.error('Error syncing to ManagementCenter:', error)
      // Не викидаємо помилку, щоб не зламати відновлення паролю
    }

    return NextResponse.json({
      message: 'Пароль успішно змінено. Тепер ви можете увійти з новим паролем.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'Помилка при зміні паролю' },
      { status: 500 }
    )
  }
}

// GET для перевірки валідності токену
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Токен не надано' },
        { status: 400 }
      )
    }

    const business = await prisma.business.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        email: true,
      },
    })

    if (!business) {
      return NextResponse.json(
        { valid: false, error: 'Невірний або застарілий токен' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      valid: true,
      email: business.email,
    })
  } catch (error) {
    console.error('Token validation error:', error)
    return NextResponse.json(
      { valid: false, error: 'Помилка при перевірці токену' },
      { status: 500 }
    )
  }
}


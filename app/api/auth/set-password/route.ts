import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { z } from 'zod'

const setPasswordSchema = z.object({
  businessId: z.string().min(1, 'businessId обов\'язковий'),
  newPassword: z.string().min(6, 'Пароль має бути мінімум 6 символів'),
  confirmPassword: z.string().min(1, 'Підтвердіть пароль'),
  currentPassword: z.string().optional(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Паролі не збігаються',
  path: ['confirmPassword'],
})

/**
 * POST /api/auth/set-password
 * Створити або змінити пароль для входу по email.
 * Якщо пароль ще не встановлений (реєстрація через Telegram) — currentPassword не потрібен.
 * Якщо пароль вже є — потрібен поточний пароль для зміни.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = setPasswordSchema.parse(body)

    const business = await prisma.business.findUnique({
      where: { id: validated.businessId },
      select: { id: true, password: true },
    })
    if (!business) {
      return NextResponse.json({ error: 'Бізнес не знайдено' }, { status: 404 })
    }

    if (business.password) {
      if (!validated.currentPassword) {
        return NextResponse.json(
          { error: 'Введіть поточний пароль для зміни' },
          { status: 400 }
        )
      }
      const valid = await verifyPassword(validated.currentPassword, business.password)
      if (!valid) {
        return NextResponse.json(
          { error: 'Невірний поточний пароль' },
          { status: 401 }
        )
      }
    }

    const hashedPassword = await hashPassword(validated.newPassword)
    await prisma.business.update({
      where: { id: business.id },
      data: { password: hashedPassword },
      select: { id: true },
    })

    try {
      const { syncBusinessToManagementCenter } = await import('@/lib/services/management-center')
      await syncBusinessToManagementCenter(business.id)
    } catch (syncErr) {
      console.error('Sync to ManagementCenter:', syncErr)
    }

    return NextResponse.json({
      success: true,
      message: business.password
        ? 'Пароль успішно змінено. Тепер ви можете входити з новим паролем.'
        : 'Пароль створено. Тепер ви можете входити по email та паролю.',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors.map((e) => e.message).join(', ') },
        { status: 400 }
      )
    }
    console.error('Set password error:', error)
    return NextResponse.json(
      { error: 'Помилка при збереженні паролю' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { z } from 'zod'

const forgotPasswordSchema = z.object({
  email: z.string().email('Невірний формат email'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = forgotPasswordSchema.parse(body)

    // Нормалізуємо email
    const normalizedEmail = validated.email.toLowerCase().trim()

    // Шукаємо бізнес
    const business = await prisma.business.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    // Завжди повертаємо успішну відповідь (для безпеки не розкриваємо, чи існує email)
    if (!business) {
      return NextResponse.json({
        message: 'Якщо email існує, на нього було відправлено інструкції для відновлення паролю',
      })
    }

    // Генеруємо токен відновлення
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpiry = new Date()
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1) // Токен дійсний 1 годину

    // Зберігаємо токен в базі даних (select без telegramWebhookSetAt)
    await prisma.business.update({
      where: { id: business.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
      select: { id: true },
    })

    // Формуємо посилання для відновлення
    const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'}/reset-password?token=${resetToken}`

    // Відправляємо email (якщо налаштовано)
    // TODO: Інтегрувати з email провайдером (SendGrid, Mailgun, тощо)
    console.log(`[Password Reset] Token generated for ${business.email}: ${resetUrl}`)

    // В продакшені тут буде відправка email
    // await sendPasswordResetEmail(business.email, resetUrl)

    return NextResponse.json({
      message: 'Якщо email існує, на нього було відправлено інструкції для відновлення паролю',
      // В розробці повертаємо токен для тестування
      ...(process.env.NODE_ENV === 'development' && {
        resetToken,
        resetUrl,
      }),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'Помилка при обробці запиту' },
      { status: 500 }
    )
  }
}


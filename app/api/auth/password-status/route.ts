import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/auth/password-status?businessId=xxx
 * Повертає, чи встановлений пароль для входу по email (без розкриття паролю).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    if (!businessId) {
      return NextResponse.json({ error: 'businessId обов\'язковий' }, { status: 400 })
    }
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, password: true },
    })
    if (!business) {
      return NextResponse.json({ error: 'Бізнес не знайдено' }, { status: 404 })
    }
    return NextResponse.json({ hasPassword: !!business.password })
  } catch (error) {
    console.error('Error checking password status:', error)
    return NextResponse.json({ error: 'Помилка перевірки' }, { status: 500 })
  }
}

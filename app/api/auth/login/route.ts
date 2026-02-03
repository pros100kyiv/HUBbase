import { NextResponse } from 'next/server'
import { authenticateBusiness } from '@/lib/auth'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Невірний формат email'),
  password: z.string().min(1, 'Пароль обов\'язковий'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = loginSchema.parse(body)

    console.log('Login attempt for email:', validated.email)

    // Auto-create test business if it doesn't exist (only for test email)
    const TEST_EMAIL = 'admin@045barbershop.com'
    const TEST_PASSWORD = 'password123'
    
    if (validated.email.toLowerCase() === TEST_EMAIL.toLowerCase()) {
      const { prisma } = await import('@/lib/prisma')
      const { createBusiness } = await import('@/lib/auth')
      
      const existing = await prisma.business.findUnique({
        where: { email: TEST_EMAIL.toLowerCase() },
      })
      
      if (!existing) {
        console.log('Auto-creating test business...')
        await createBusiness({
          name: '5 Barbershop',
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          slug: '045-barbershop',
        })
        console.log('Test business created automatically')
      }
    }

    const business = await authenticateBusiness(validated.email, validated.password)

    if (!business) {
      console.log('Authentication failed for email:', validated.email)
      return NextResponse.json(
        { error: 'Невірний email або пароль' },
        { status: 401 }
      )
    }

    // Перевіряємо чи бізнес активний
    if (business.isActive === false) {
      return NextResponse.json(
        { error: 'Ваш акаунт деактивовано' },
        { status: 403 }
      )
    }

    console.log('Login successful for business:', business.id)

    // В продакшені тут буде JWT токен або сесія
    // Для простоти повертаємо бізнес (в реальному додатку використовуйте cookies/headers)
    return NextResponse.json({
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        email: business.email,
        phone: business.phone,
        address: business.address,
        description: business.description,
        logo: business.logo,
        avatar: (business as any).avatar || null,
        primaryColor: business.primaryColor,
        secondaryColor: business.secondaryColor,
        backgroundColor: business.backgroundColor,
        surfaceColor: business.surfaceColor,
        isActive: business.isActive,
        telegramChatId: (business as any).telegramChatId || null,
      },
      message: 'Вхід успішний',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Помилка при вході', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}


import { NextResponse } from 'next/server'
import { createBusiness, generateSlug, hashPassword } from '@/lib/auth'
import { z } from 'zod'

const registerSchema = z.object({
  name: z.string().min(1, 'Назва обов\'язкова'),
  email: z.string().email('Невірний формат email'),
  password: z.string().min(6, 'Пароль має бути мінімум 6 символів'),
  phone: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = registerSchema.parse(body)

    // Генеруємо slug з назви
    const slug = generateSlug(validated.name)

    // Хешуємо пароль для збереження в Центрі управління
    const hashedPassword = await hashPassword(validated.password)

    // Створюємо бізнес (автоматично реєструється в Центрі управління)
    const business = await createBusiness({
      name: validated.name,
      email: validated.email,
      password: validated.password,
      slug: slug,
      phone: validated.phone || null,
    })

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
        primaryColor: business.primaryColor,
        secondaryColor: business.secondaryColor,
        backgroundColor: business.backgroundColor,
        surfaceColor: business.surfaceColor,
        isActive: business.isActive,
      },
      message: 'Реєстрація успішна',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    // Перевірка на дублікат email
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Email вже зареєстровано' },
        { status: 409 }
      )
    }

    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Помилка при реєстрації', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}


import { NextResponse } from 'next/server'
import { createBusiness, generateSlug } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const registerSchema = z.object({
  name: z.string().min(2, 'Назва має бути мінімум 2 символи'),
  email: z.string().email('Невірний формат email'),
  password: z.string().min(6, 'Пароль має бути мінімум 6 символів'),
  slug: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validated = registerSchema.parse(body)

    // Генеруємо slug якщо не вказано
    const slug = validated.slug || generateSlug(validated.name)

    // Перевіряємо чи slug вже існує
    const existingBusiness = await prisma.business.findFirst({
      where: {
        OR: [
          { slug },
          { email: validated.email },
        ],
      },
    })

    if (existingBusiness) {
      return NextResponse.json(
        { error: 'Бізнес з таким email або slug вже існує' },
        { status: 409 }
      )
    }

    const business = await createBusiness({
      name: validated.name,
      email: validated.email,
      password: validated.password,
      slug,
    })

    // Не повертаємо пароль
    const { password: _, ...businessWithoutPassword } = business

    return NextResponse.json(
      { business: businessWithoutPassword, message: 'Реєстрація успішна' },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Помилка при реєстрації' },
      { status: 500 }
    )
  }
}





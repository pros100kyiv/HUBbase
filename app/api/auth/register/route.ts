import { NextResponse } from 'next/server'
import { createBusiness, generateSlug, hashPassword } from '@/lib/auth'
import { z } from 'zod'
import { generateDeviceId, getClientIp, getUserAgent, addTrustedDevice } from '@/lib/utils/device'
import { ensureAdminControlCenterTable } from '@/lib/database/ensure-admin-control-center'
import { prisma } from '@/lib/prisma'

const registerSchema = z.object({
  name: z.string().min(1, 'Назва обов\'язкова'),
  email: z.string().email('Невірний формат email'),
  password: z.string().min(6, 'Пароль має бути мінімум 6 символів'),
  phone: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    // Перевіряємо та створюємо таблицю admin_control_center, якщо вона не існує
    await ensureAdminControlCenterTable()
    
    const body = await request.json()
    const validated = registerSchema.parse(body)
    
    // Генеруємо deviceId для перевірки пристрою
    const clientIp = getClientIp(request)
    const userAgent = getUserAgent(request)
    const deviceId = generateDeviceId(clientIp, userAgent)

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

    // Додаємо пристрій до довірених при реєстрації
    const updatedTrustedDevices = addTrustedDevice(business.trustedDevices, deviceId)
    await prisma.business.update({
      where: { id: business.id },
      data: { trustedDevices: updatedTrustedDevices }
    })

    // Повертаємо успішну відповідь з даними бізнесу
    return NextResponse.json({
      success: true,
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        email: business.email,
        phone: business.phone,
        address: business.address,
        description: business.description,
        logo: business.logo,
        avatar: business.avatar,
        primaryColor: business.primaryColor,
        secondaryColor: business.secondaryColor,
        backgroundColor: business.backgroundColor,
        surfaceColor: business.surfaceColor,
        isActive: business.isActive,
        businessIdentifier: business.businessIdentifier,
        profileCompleted: business.profileCompleted,
        niche: business.niche,
        customNiche: business.customNiche,
      },
      message: 'Бізнес успішно зареєстровано'
    }, { status: 201 })
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
        { error: 'Email вже зареєстровано. Спробуйте увійти або використайте інший email.' },
        { status: 409 }
      )
    }

    // Обробка помилок бази даних
    if (error instanceof Error) {
      // Якщо таблиця не існує - дружнє повідомлення
      if (error.message.includes('does not exist') || error.message.includes('admin_control_center')) {
        console.error('Database table missing:', error)
        return NextResponse.json(
          { error: 'Система тимчасово недоступна. Будь ласка, спробуйте пізніше або зверніться до підтримки.' },
          { status: 503 }
        )
      }
      
      // Якщо користувач не зареєстрований
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Ви ще не зареєстровані. Будь ласка, зареєструйтесь спочатку.' },
          { status: 404 }
        )
      }
    }

    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Помилка при реєстрації. Будь ласка, спробуйте ще раз або зверніться до підтримки.' },
      { status: 500 }
    )
  }
}


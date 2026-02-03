import { NextResponse } from 'next/server'
import { createBusiness, generateSlug, hashPassword } from '@/lib/auth'
import { z } from 'zod'
import { generateDeviceId, getClientIp, getUserAgent, addTrustedDevice } from '@/lib/utils/device'
import { ensureAdminControlCenterTable } from '@/lib/database/ensure-admin-control-center'
import { prisma } from '@/lib/prisma'
import { BusinessNiche } from '@prisma/client'

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

    // Нормалізуємо email один раз
    const normalizedEmail = validated.email.toLowerCase().trim()

    // Використовуємо транзакцію для атомарності операцій
    const result = await prisma.$transaction(async (tx) => {
      // Перевіряємо, чи email вже існує (з урахуванням регістру через insensitive search)
      const existingBusiness = await tx.business.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive'
          }
        }
      })

      if (existingBusiness) {
        // Перевіряємо пароль
        const { verifyPassword } = await import('@/lib/auth')
        const passwordMatch = existingBusiness.password 
          ? await verifyPassword(validated.password, existingBusiness.password)
          : false

        if (passwordMatch) {
          // Автоматичний вхід - додаємо пристрій до довірених
          const updatedTrustedDevices = addTrustedDevice(existingBusiness.trustedDevices, deviceId)
          const updated = await tx.business.update({
            where: { id: existingBusiness.id },
            data: { trustedDevices: updatedTrustedDevices }
          })

          return { type: 'login' as const, business: updated }
        } else {
          // Пароль не співпадає - викидаємо помилку для обробки поза транзакцією
          throw new Error('EMAIL_EXISTS_WRONG_PASSWORD')
        }
      }

      // Генеруємо slug з перевіркою унікальності
      const slug = generateSlug(validated.name)
      let finalSlug = slug
      let counter = 1
      
      // Перевіряємо унікальність slug в транзакції
      while (await tx.business.findUnique({ where: { slug: finalSlug } })) {
        finalSlug = `${slug}-${counter}`
        counter++
        if (counter > 100) {
          // Захист від нескінченного циклу
          finalSlug = `${slug}-${Date.now()}`
          break
        }
      }

      // Хешуємо пароль
      const hashedPassword = validated.password ? await hashPassword(validated.password) : null

      // Автоматично встановлюємо токен Telegram бота
      const defaultTelegramBotToken = process.env.DEFAULT_TELEGRAM_BOT_TOKEN || '8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo'

      // Створюємо бізнес в транзакції
      const business = await tx.business.create({
        data: {
          name: validated.name,
          email: normalizedEmail, // Завжди lowercase
          password: hashedPassword,
          slug: finalSlug,
          phone: validated.phone || null,
          niche: BusinessNiche.OTHER,
          customNiche: null,
          telegramBotToken: defaultTelegramBotToken,
          telegramNotificationsEnabled: true,
        },
      })

      // Додаємо пристрій до довірених
      const updatedTrustedDevices = addTrustedDevice(business.trustedDevices, deviceId)
      const updatedBusiness = await tx.business.update({
        where: { id: business.id },
        data: { trustedDevices: updatedTrustedDevices }
      })

      return { type: 'register' as const, business: updatedBusiness }
    }, {
      timeout: 10000, // 10 секунд таймаут
      isolationLevel: 'Serializable', // Найвищий рівень ізоляції для уникнення race conditions
    })

    // Синхронізуємо з ManagementCenter (після транзакції)
    try {
      const { syncBusinessToManagementCenter } = await import('@/lib/services/management-center')
      await syncBusinessToManagementCenter(result.business.id)
    } catch (syncError) {
      console.error('Error syncing to ManagementCenter:', syncError)
      // Не викидаємо помилку, щоб не зламати реєстрацію
    }

    // Формуємо відповідь з повними даними бізнесу
    const businessData = {
      id: result.business.id,
      name: result.business.name,
      slug: result.business.slug,
      email: result.business.email,
      phone: result.business.phone,
      address: result.business.address,
      description: result.business.description,
      logo: result.business.logo,
      avatar: result.business.avatar,
      primaryColor: result.business.primaryColor,
      secondaryColor: result.business.secondaryColor,
      backgroundColor: result.business.backgroundColor,
      surfaceColor: result.business.surfaceColor,
      isActive: result.business.isActive,
      businessIdentifier: result.business.businessIdentifier,
      profileCompleted: result.business.profileCompleted,
      niche: result.business.niche,
      customNiche: result.business.customNiche,
    }

    // Повертаємо відповідь
    if (result.type === 'login') {
      return NextResponse.json({
        success: true,
        business: businessData,
        message: 'Успішний вхід в існуючий акаунт',
        isLogin: true
      }, { status: 200 })
    } else {
      return NextResponse.json({
        success: true,
        business: businessData,
        message: 'Бізнес успішно зареєстровано та синхронізовано з базою даних',
        isLogin: false
      }, { status: 201 })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    // Обробка помилки невірного пароля для існуючого email
    if (error instanceof Error && error.message === 'EMAIL_EXISTS_WRONG_PASSWORD') {
      return NextResponse.json(
        { error: 'Email вже зареєстровано. Невірний пароль. Спробуйте увійти або використайте інший email.' },
        { status: 409 }
      )
    }

    // Перевірка на дублікат email (Prisma помилка P2002)
    if (error instanceof Error && (error.message.includes('Unique constraint') || error.message.includes('P2002'))) {
      // Спробуємо знайти існуючий бізнес для більш точного повідомлення
      try {
        const normalizedEmail = validated?.email?.toLowerCase().trim()
        if (normalizedEmail) {
          const existing = await prisma.business.findFirst({
            where: {
              email: {
                equals: normalizedEmail,
                mode: 'insensitive'
              }
            },
            select: { id: true, email: true }
          })

          if (existing) {
            return NextResponse.json(
              { error: 'Email вже зареєстровано. Спробуйте увійти або використайте інший email.' },
              { status: 409 }
            )
          }
        }
      } catch (e) {
        // Ігноруємо помилку пошуку
      }

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


import { NextResponse } from 'next/server'
import { createBusiness, generateSlug, hashPassword } from '@/lib/auth'
import { z } from 'zod'
import { generateDeviceId, getClientIp, getUserAgent, addTrustedDevice } from '@/lib/utils/device'
import { ensureAdminControlCenterTable } from '@/lib/database/ensure-admin-control-center'
import { prisma } from '@/lib/prisma'
import { BusinessNiche } from '@prisma/client'
import { generateBusinessIdentifier } from '@/lib/utils/business-identifier'
import { normalizeUaPhone } from '@/lib/utils/phone'
import { getTrialEndDate } from '@/lib/subscription'

const registerSchema = z.object({
  name: z.string().min(1, 'Назва обов\'язкова'),
  email: z.string().email('Невірний формат email'),
  password: z.string().min(6, 'Пароль має бути мінімум 6 символів'),
  phone: z.string().optional(),
})

function isConnectionError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  const t = msg.toLowerCase()
  return t.includes("can't reach database") || t.includes('database server') || t.includes('econnrefused') || t.includes('etimedout') || t.includes('connection') || t.includes('neon.tech')
}

const DB_RETRY_ATTEMPTS = 3
const DB_RETRY_DELAY_MS = 2000

export async function POST(request: Request) {
  let requestBody: any = null

  try {
    requestBody = await request.json()
    const validated = registerSchema.parse(requestBody)

    const clientIp = getClientIp(request)
    const userAgent = getUserAgent(request)
    const deviceId = generateDeviceId(clientIp, userAgent)
    const normalizedEmail = validated.email.toLowerCase().trim()

    let lastError: unknown = null
    for (let attempt = 0; attempt < DB_RETRY_ATTEMPTS; attempt++) {
      try {
        await ensureAdminControlCenterTable()
        const result = await prisma.$transaction(async (tx) => {
      // Перевіряємо, чи email вже існує (явний select — щоб не ламатись без колонки telegramWebhookSetAt)
      const existingBusiness = await tx.business.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          email: true,
          password: true,
          trustedDevices: true,
        },
      })

      if (existingBusiness) {
        // Перевіряємо пароль
        const { verifyPassword } = await import('@/lib/auth')
        const passwordMatch = existingBusiness.password 
          ? await verifyPassword(validated.password, existingBusiness.password)
          : false

        if (passwordMatch) {
          // Автоматичний вхід - додаємо пристрій до довірених (select без telegramWebhookSetAt — стійкість до відсутньої колонки)
          const updatedTrustedDevices = addTrustedDevice(existingBusiness.trustedDevices, deviceId)
          const updated = await tx.business.update({
            where: { id: existingBusiness.id },
            data: { trustedDevices: updatedTrustedDevices },
            select: {
              id: true, name: true, slug: true, email: true, phone: true, address: true,
              description: true, logo: true, avatar: true, primaryColor: true, secondaryColor: true,
              backgroundColor: true, surfaceColor: true, isActive: true, businessIdentifier: true,
              profileCompleted: true, niche: true, customNiche: true, telegramChatId: true,
            },
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
      
      // Перевіряємо унікальність slug (тільки id — щоб не вибирати колонки, яких може не бути в БД)
      while (await tx.business.findUnique({ where: { slug: finalSlug }, select: { id: true } })) {
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

      // Генеруємо унікальний businessIdentifier
      let businessIdentifier: string
      let attempts = 0
      do {
        businessIdentifier = await generateBusinessIdentifier()
        const exists = await tx.business.findUnique({
          where: { businessIdentifier },
          select: { id: true },
        })
        if (!exists) break
        attempts++
        if (attempts > 10) {
          // Якщо не вдалося знайти унікальний за 10 спроб, використовуємо timestamp
          businessIdentifier = Date.now().toString().slice(-8)
          break
        }
      } while (true)

      // Створюємо бізнес в транзакції (select лише потрібні поля — стійкість до відсутньої колонки telegramWebhookSetAt)
      const business = await tx.business.create({
        data: {
          name: validated.name,
          email: normalizedEmail, // Завжди lowercase
          password: hashedPassword,
          slug: finalSlug,
          phone: validated.phone ? normalizeUaPhone(validated.phone) : null,
          businessIdentifier: businessIdentifier,
          niche: BusinessNiche.OTHER,
          customNiche: null,
          telegramBotToken: defaultTelegramBotToken,
          telegramNotificationsEnabled: true,
          trialEndsAt: getTrialEndDate(),
          subscriptionStatus: 'trial',
        },
        select: {
          id: true,
          trustedDevices: true,
        },
      })

      // Додаємо пристрій до довірених (select без telegramWebhookSetAt — стійкість до відсутньої колонки)
      const updatedTrustedDevices = addTrustedDevice(business.trustedDevices, deviceId)
      const updatedBusiness = await tx.business.update({
        where: { id: business.id },
        data: { trustedDevices: updatedTrustedDevices },
        select: {
          id: true, name: true, slug: true, email: true, phone: true, address: true,
          description: true, logo: true, avatar: true, primaryColor: true, secondaryColor: true,
          backgroundColor: true, surfaceColor: true, isActive: true, businessIdentifier: true,
          profileCompleted: true, niche: true, customNiche: true, telegramChatId: true,
        },
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

    // Формуємо відповідь з повними даними бізнесу (той самий формат, що й при логіні)
    const businessData = {
      id: result.business.id,
      name: result.business.name,
      slug: result.business.slug,
      email: result.business.email,
      phone: result.business.phone,
      address: result.business.address,
      description: result.business.description,
      logo: result.business.logo,
      avatar: result.business.avatar ?? null,
      primaryColor: result.business.primaryColor,
      secondaryColor: result.business.secondaryColor,
      backgroundColor: result.business.backgroundColor,
      surfaceColor: result.business.surfaceColor,
      isActive: result.business.isActive,
      businessIdentifier: result.business.businessIdentifier ?? null,
      profileCompleted: result.business.profileCompleted ?? false,
      niche: result.business.niche ?? null,
      customNiche: result.business.customNiche ?? null,
      telegramChatId: result.business.telegramChatId ?? null,
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
      } catch (e) {
        lastError = e
        if (!isConnectionError(e) || attempt === DB_RETRY_ATTEMPTS - 1) break
        console.warn(`Registration DB attempt ${attempt + 1} failed (connection?), retrying in ${DB_RETRY_DELAY_MS}ms...`, e)
        await new Promise((r) => setTimeout(r, DB_RETRY_DELAY_MS))
      }
    }
    if (lastError) throw lastError
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
        // Спробуємо валідувати requestBody для отримання email
        let normalizedEmail: string | undefined
        if (requestBody) {
          const tempValidated = registerSchema.safeParse(requestBody)
          if (tempValidated.success) {
            normalizedEmail = tempValidated.data.email.toLowerCase().trim()
          }
        }

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

    // Обробка помилок бази даних — ніколи не віддаємо клієнту технічні деталі
    const safeServiceUnavailable = 'Сервіс тимчасово недоступний. Спробуйте через кілька хвилин.'
    if (error instanceof Error) {
      const msg = error.message
      // Немає з'єднання з БД або інші помилки інфраструктури
      if (msg.includes("Can't reach database") || msg.includes('database server') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('Connection') || msg.includes('neon.tech')) {
        console.error('Database connection error:', error)
        return NextResponse.json(
          { error: safeServiceUnavailable },
          { status: 503 }
        )
      }
      // Таблиця не існує
      if (msg.includes('does not exist') || msg.includes('admin_control_center')) {
        console.error('Database table missing:', error)
        return NextResponse.json(
          { error: safeServiceUnavailable },
          { status: 503 }
        )
      }
      // Користувач не зареєстрований (бізнес-логіка)
      if (msg.includes('not found')) {
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


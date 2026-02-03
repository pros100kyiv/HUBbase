import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { createBusiness, generateSlug } from '@/lib/auth'
import { UserRole } from '@prisma/client'

interface TelegramAuthPayload {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
  [key: string]: any
}

function isValidTelegramAuth(data: TelegramAuthPayload, botToken: string): boolean {
  const { hash, ...rest } = data

  const checkString = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join('\n')

  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex')

  if (hmac !== hash) {
    return false
  }

  // Перевіряємо, що токен не надто старий (наприклад, 1 день)
  const now = Math.floor(Date.now() / 1000)
  const maxAge = 60 * 60 * 24 // 24 години
  if (now - data.auth_date > maxAge) {
    return false
  }

  return true
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TelegramAuthPayload

    const botToken =
      process.env.DEFAULT_TELEGRAM_BOT_TOKEN ||
      process.env.TELEGRAM_BOT_TOKEN ||
      ''

    if (!botToken) {
      return NextResponse.json(
        { error: 'Telegram бот не налаштований' },
        { status: 500 }
      )
    }

    if (!body || !body.id || !body.hash || !body.auth_date) {
      return NextResponse.json(
        { error: 'Некоректні дані Telegram' },
        { status: 400 }
      )
    }

    const isValid = isValidTelegramAuth(body, botToken)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Невірні дані Telegram (перевірка підпису не пройшла)' },
        { status: 401 }
      )
    }

    const telegramId = BigInt(body.id)

    // Пробуємо знайти існуючого Telegram-користувача
    let telegramUser = await prisma.telegramUser.findFirst({
      where: {
        telegramId,
        isActive: true,
      },
      include: {
        business: true,
      },
    })

    let business = telegramUser?.business || null
    let isNewBusiness = false

    if (!business) {
      // Якщо бізнесу ще немає — реєструємо новий бізнес за допомогою Telegram акаунта
      const baseName = body.first_name || body.username || 'Telegram бізнес'
      const name = baseName.trim()

      const baseSlug = generateSlug(
        (body.username || name || 'telegram-business') + '-' + String(body.id).slice(-4)
      )

      // Гарантуємо унікальний slug
      let slug = baseSlug
      let counter = 1
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const existing = await prisma.business.findUnique({ where: { slug } })
        if (!existing) break
        slug = `${baseSlug}-${counter++}`
      }

      // Генеруємо службовий email (уникальний для Telegram користувача)
      const email = `tg-${body.id}@telegram.xbase`

      business = await createBusiness({
        name,
        email,
        slug,
      })

      // КРИТИЧНО ВАЖЛИВО: Автоматично реєструємо в Центрі управління (ПОВНЕ ДУБЛЮВАННЯ)
      // createBusiness() вже синхронізує, але переконаємося
      try {
        const { syncBusinessToManagementCenter } = await import('@/lib/services/management-center')
        await syncBusinessToManagementCenter(business.id)
      } catch (error) {
        console.error('КРИТИЧНА ПОМИЛКА: Не вдалося синхронізувати Telegram бізнес в ManagementCenter:', error)
        // Не викидаємо помилку, щоб не зламати реєстрацію
      }

      telegramUser = await prisma.telegramUser.create({
        data: {
          telegramId,
          businessId: business.id,
          username: body.username || null,
          firstName: body.first_name || null,
          lastName: body.last_name || null,
          role: UserRole.OWNER,
          activatedAt: new Date(),
        },
        include: {
          business: true,
        },
      })

      isNewBusiness = true
    }

    if (!business.isActive) {
      return NextResponse.json(
        { error: 'Ваш акаунт деактивовано' },
        { status: 403 }
      )
    }

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
      message: isNewBusiness
        ? 'Реєстрація через Telegram успішна'
        : 'Вхід через Telegram успішний',
    })
  } catch (error) {
    console.error('Telegram auth error:', error)
    return NextResponse.json(
      {
        error: 'Помилка Telegram-авторизації',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}



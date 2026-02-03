import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { registerBusinessInManagementCenter } from './services/management-center'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

import { BusinessNiche } from '@prisma/client'

export async function createBusiness(data: {
  name: string
  email: string
  password?: string
  slug: string
  googleId?: string
  phone?: string | null
  businessIdentifier?: string | null
  niche?: BusinessNiche | string | null
  customNiche?: string | null
}) {
  const hashedPassword = data.password ? await hashPassword(data.password) : null
  
  // Normalize email (lowercase, trim)
  const normalizedEmail = data.email.toLowerCase().trim()
  
  // Автоматично встановлюємо токен Telegram бота при реєстрації
  const defaultTelegramBotToken = process.env.DEFAULT_TELEGRAM_BOT_TOKEN || '8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo'
  
  const business = await prisma.business.create({
    data: {
      name: data.name,
      email: normalizedEmail,
      password: hashedPassword,
      slug: data.slug,
      googleId: data.googleId,
      phone: data.phone || null,
      businessIdentifier: data.businessIdentifier || null,
      niche: (data.niche as BusinessNiche) || BusinessNiche.OTHER,
      customNiche: data.customNiche || null,
      telegramBotToken: defaultTelegramBotToken,
      telegramNotificationsEnabled: true,
    },
  })

  // Автоматично реєструємо в Центрі управління (ПОВНЕ ДУБЛЮВАННЯ)
  if (hashedPassword) {
    const { registerBusinessInManagementCenter } = await import('@/lib/services/management-center')
    await registerBusinessInManagementCenter({
      businessId: business.id,
      business: business, // Передаємо повний об'єкт для дублювання
      registrationType: data.googleId ? 'google' : 'standard',
    })
  }

  return business
}

export async function authenticateBusiness(email: string, password: string) {
  // Normalize email (lowercase, trim)
  const normalizedEmail = email.toLowerCase().trim()
  
  try {
    // Використовуємо select без нових полів, щоб уникнути помилок, якщо вони відсутні в БД
    const business = await prisma.business.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        phone: true,
        address: true,
        description: true,
        logo: true,
        avatar: true, // Аватар користувача
        primaryColor: true,
        secondaryColor: true,
        backgroundColor: true,
        surfaceColor: true,
        hideRevenue: true,
        isActive: true,
        password: true, // Потрібен для перевірки
        googleId: true,
        telegramChatId: true, // Telegram Chat ID
        createdAt: true,
        updatedAt: true,
        // Нові поля візитівки (опціональні)
        businessCardBackgroundImage: true,
        slogan: true,
        additionalInfo: true,
        socialMedia: true,
        workingHours: true,
        location: true,
      },
    })

    if (!business) {
      console.log('Business not found for email:', normalizedEmail)
      return null
    }

    // Check if password is set
    if (!business.password) {
      console.log('Business has no password set:', business.id)
      return null
    }

    const isValid = await verifyPassword(password, business.password)
    if (!isValid) {
      console.log('Password verification failed for business:', business.id)
      return null
    }

    // Не повертаємо пароль
    const { password: _, ...businessWithoutPassword } = business
    return businessWithoutPassword
  } catch (error: any) {
    // Якщо поля відсутні в БД, спробуємо без них
    if (error?.message?.includes('does not exist')) {
      console.warn('Business card fields not found, retrying without them')
      try {
        const business = await prisma.business.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            name: true,
            slug: true,
            email: true,
            phone: true,
            address: true,
            description: true,
            logo: true,
            primaryColor: true,
            secondaryColor: true,
            backgroundColor: true,
            surfaceColor: true,
            hideRevenue: true,
            isActive: true,
            password: true,
            googleId: true,
            createdAt: true,
            updatedAt: true,
          },
        })

        if (!business || !business.password) {
          return null
        }

        const isValid = await verifyPassword(password, business.password)
        if (!isValid) {
          return null
        }

        const { password: _, ...businessWithoutPassword } = business
        return businessWithoutPassword
      } catch (retryError) {
        console.error('Error in retry:', retryError)
        throw retryError
      }
    }
    throw error
  }
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}




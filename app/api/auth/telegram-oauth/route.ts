import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateDeviceId, getClientIp, getUserAgent, addTrustedDevice } from '@/lib/utils/device'
import { ensureAdminControlCenterTable } from '@/lib/database/ensure-admin-control-center'
import { generateBusinessIdentifier } from '@/lib/utils/business-identifier'
import { getTrialEndDate } from '@/lib/subscription'
import { isValidTelegramLoginData } from '@/lib/utils/telegram-auth'
import { checkRateLimit } from '@/lib/utils/rate-limit'

/**
 * API для автоматичної реєстрації/входу через Telegram OAuth
 * Проста логіка: якщо акаунт існує - вхід, якщо ні - створення нового
 */
export async function POST(request: Request) {
  let telegramData: any = null
  
  try {
    const rateLimitIp = getClientIp(request) || 'unknown'
    const rateLimit = checkRateLimit({
      key: `telegram-oauth:${rateLimitIp}`,
      maxRequests: 20,
      windowMs: 5 * 60 * 1000,
    })
    if (rateLimit.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } }
      )
    }

    // Перевіряємо та створюємо таблицю admin_control_center, якщо вона не існує
    await ensureAdminControlCenterTable()
    
    const body = await request.json()
    telegramData = body.telegramData
    const { businessId, deviceId } = body
    
    if (!telegramData || !telegramData.id) {
      return NextResponse.json({ error: 'Telegram data is required' }, { status: 400 })
    }

    const botToken =
      process.env.DEFAULT_TELEGRAM_BOT_TOKEN ||
      process.env.TELEGRAM_BOT_TOKEN ||
      ''
    if (!botToken) {
      return NextResponse.json({ error: 'Telegram bot is not configured' }, { status: 500 })
    }

    if (!isValidTelegramLoginData(telegramData, botToken)) {
      return NextResponse.json({ error: 'Invalid Telegram signature' }, { status: 401 })
    }

    const telegramId = BigInt(telegramData.id)
    
    // Генеруємо deviceId для перевірки пристрою
    const clientIp = getClientIp(request)
    const userAgent = getUserAgent(request)
    const currentDeviceId = deviceId || generateDeviceId(clientIp, userAgent)
    
    // КРОК 1: Перевіряємо чи акаунт вже існує (явний select — без telegramWebhookSetAt)
    const businessFieldsSelect = {
      id: true, telegramId: true, businessIdentifier: true, avatar: true, trustedDevices: true,
      name: true, slug: true, email: true, phone: true, address: true, description: true,
      logo: true, primaryColor: true, secondaryColor: true, backgroundColor: true, surfaceColor: true,
      isActive: true, profileCompleted: true, niche: true, customNiche: true,
    }
    let business = await prisma.business.findUnique({
      where: { telegramId },
      select: businessFieldsSelect,
    })

    // Якщо не знайдено в Business - перевіряємо в TelegramUser
    if (!business) {
      const telegramUser = await prisma.telegramUser.findUnique({
        where: { telegramId },
        include: { business: { select: businessFieldsSelect } }
      })
      
      if (telegramUser?.business) {
        business = telegramUser.business
        
        // Синхронізуємо telegramId в Business, якщо його там немає
        if (!business.telegramId) {
          await prisma.business.update({
            where: { id: business.id },
            data: { telegramId },
            select: { id: true },
          })
        }
      }
    }
    
    // КРОК 2: Якщо акаунт знайдено - робимо ВХІД
    if (business) {
      // Генеруємо businessIdentifier якщо відсутній
      let businessIdentifier = business.businessIdentifier
      if (!businessIdentifier) {
        businessIdentifier = await generateBusinessIdentifier()
      }

      // Оновлюємо дані бізнесу (select без telegramWebhookSetAt; потрібні поля для відповіді)
      const updatedBusiness = await prisma.business.update({
        where: { id: business.id },
        data: {
          telegramChatId: telegramData.id.toString(),
          avatar: telegramData.photo_url || business.avatar,
          telegramId: business.telegramId || telegramId, // Переконаємося що telegramId встановлено
          businessIdentifier: businessIdentifier, // Оновлюємо businessIdentifier
        },
        select: {
          id: true, trustedDevices: true, name: true, slug: true, email: true, phone: true,
          address: true, description: true, logo: true, avatar: true, primaryColor: true,
          secondaryColor: true, backgroundColor: true, surfaceColor: true, isActive: true,
          telegramChatId: true, businessIdentifier: true, profileCompleted: true,
        },
      })

      // Отримуємо або створюємо TelegramUser
      let telegramUser = await prisma.telegramUser.findUnique({
        where: { telegramId }
      })

      if (!telegramUser) {
        telegramUser = await prisma.telegramUser.create({
          data: {
            businessId: business.id,
            telegramId: telegramId,
            username: telegramData.username || null,
            firstName: telegramData.first_name || null,
            lastName: telegramData.last_name || null,
            role: 'OWNER',
            isActive: true,
            activatedAt: new Date(),
            lastActivity: new Date()
          }
        })
      } else {
        // Оновлюємо дані користувача
        await prisma.telegramUser.update({
          where: { id: telegramUser.id },
          data: {
            username: telegramData.username || null,
            firstName: telegramData.first_name || null,
            lastName: telegramData.last_name || null,
            lastActivity: new Date()
          }
        })
      }

      // Додаємо пристрій до довірених (OAuth підтвердження = довіра) (select без telegramWebhookSetAt)
      const updatedTrustedDevices = addTrustedDevice(updatedBusiness.trustedDevices, currentDeviceId)
      await prisma.business.update({
        where: { id: business.id },
        data: { trustedDevices: updatedTrustedDevices },
        select: { id: true },
      })

      // Оновлюємо інтеграцію
      await prisma.socialIntegration.upsert({
        where: {
          businessId_platform: {
            businessId: business.id,
            platform: 'telegram'
          }
        },
        update: {
          isConnected: true,
          userId: telegramData.id.toString(),
          username: telegramData.username || null,
          metadata: JSON.stringify({
            firstName: telegramData.first_name,
            lastName: telegramData.last_name,
            photoUrl: telegramData.photo_url
          }),
          lastSyncAt: new Date()
        },
        create: {
          businessId: business.id,
          platform: 'telegram',
          isConnected: true,
          userId: telegramData.id.toString(),
          username: telegramData.username || null,
          metadata: JSON.stringify({
            firstName: telegramData.first_name,
            lastName: telegramData.last_name,
            photoUrl: telegramData.photo_url
          }),
          lastSyncAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        action: 'login',
        business: {
          id: updatedBusiness.id,
          name: updatedBusiness.name,
          slug: updatedBusiness.slug,
          email: updatedBusiness.email,
          phone: updatedBusiness.phone,
          address: updatedBusiness.address,
          description: updatedBusiness.description,
          logo: updatedBusiness.logo,
          avatar: updatedBusiness.avatar || null,
          primaryColor: updatedBusiness.primaryColor,
          secondaryColor: updatedBusiness.secondaryColor,
          backgroundColor: updatedBusiness.backgroundColor,
          surfaceColor: updatedBusiness.surfaceColor,
          isActive: updatedBusiness.isActive,
          telegramChatId: updatedBusiness.telegramChatId || null,
          businessIdentifier: businessIdentifier, // Використовуємо згенерований або існуючий
          profileCompleted: updatedBusiness.profileCompleted || false,
        },
        user: {
          id: telegramUser.id,
          telegramId: telegramUser.telegramId.toString(),
          username: telegramUser.username,
          firstName: telegramUser.firstName,
          lastName: telegramUser.lastName,
          role: telegramUser.role
        }
      })
    }

    // КРОК 3: Якщо businessId вказано (реєстрація з нового пристрою) - прив'язуємо до бізнесу
    if (businessId) {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: {
          id: true, trustedDevices: true, avatar: true, name: true, slug: true, email: true,
          phone: true, address: true, description: true, logo: true, primaryColor: true,
          secondaryColor: true, backgroundColor: true, surfaceColor: true, isActive: true,
          businessIdentifier: true, profileCompleted: true,
        },
      })

      if (!business) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 })
      }

      // Додаємо пристрій до довірених (select без telegramWebhookSetAt)
      const updatedTrustedDevices = addTrustedDevice(business.trustedDevices, currentDeviceId)
      await prisma.business.update({
        where: { id: business.id },
        data: { trustedDevices: updatedTrustedDevices },
        select: { id: true },
      })

      // Оновлюємо telegramId в бізнесі (business має avatar з select вище)
      const currentAvatar = (business as { avatar?: string | null }).avatar
      await prisma.business.update({
        where: { id: business.id },
        data: {
          telegramId: telegramId,
          telegramChatId: telegramData.id.toString(),
          avatar: telegramData.photo_url || currentAvatar
        },
        select: { id: true },
      })

      // Створюємо або оновлюємо TelegramUser
      const telegramUser = await prisma.telegramUser.upsert({
        where: { telegramId },
        update: {
          username: telegramData.username || null,
          firstName: telegramData.first_name || null,
          lastName: telegramData.last_name || null,
          lastActivity: new Date()
        },
        create: {
          businessId: business.id,
          telegramId: telegramId,
          username: telegramData.username || null,
          firstName: telegramData.first_name || null,
          lastName: telegramData.last_name || null,
          role: 'OWNER',
          isActive: true,
          activatedAt: new Date(),
          lastActivity: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        action: 'register',
        business: {
          id: business.id,
          name: business.name,
          slug: business.slug,
          email: business.email,
          phone: business.phone,
          address: business.address,
          description: business.description,
          logo: business.logo,
          avatar: telegramData.photo_url || business.avatar || null,
          primaryColor: business.primaryColor,
          secondaryColor: business.secondaryColor,
          backgroundColor: business.backgroundColor,
          surfaceColor: business.surfaceColor,
          isActive: business.isActive,
          telegramChatId: telegramData.id.toString(),
          businessIdentifier: business.businessIdentifier || null,
          profileCompleted: business.profileCompleted || false,
        },
        user: {
          id: telegramUser.id,
          telegramId: telegramUser.telegramId.toString(),
          username: telegramUser.username,
          firstName: telegramUser.firstName,
          lastName: telegramUser.lastName,
          role: telegramUser.role
        },
        message: 'Реєстрацію підтверджено через Telegram OAuth'
      })
    }

    // КРОК 4: Якщо акаунт НЕ знайдено - або прив'язуємо до існуючого по email, або створюємо НОВИЙ
    // Генеруємо базовий email з Telegram даних
    const email = telegramData.username 
      ? `${telegramData.username}@telegram.xbase.online`
      : `telegram-${telegramData.id}@xbase.online`

    // 4.1. Перевіряємо, чи існує бізнес з таким email (select без telegramWebhookSetAt)
    const existingByEmail = await prisma.business.findUnique({
      where: { email },
      select: { id: true, businessIdentifier: true, avatar: true, trustedDevices: true },
    })

    if (existingByEmail) {
      // Генеруємо businessIdentifier якщо відсутній
      let businessIdentifier = existingByEmail.businessIdentifier
      if (!businessIdentifier) {
        businessIdentifier = await generateBusinessIdentifier()
      }

      // Оновлюємо існуючий бізнес: прив'язуємо Telegram (select без telegramWebhookSetAt)
      const updatedBusiness = await prisma.business.update({
        where: { id: existingByEmail.id },
        data: {
          telegramId: telegramId,
          telegramChatId: telegramData.id.toString(),
          avatar: telegramData.photo_url || existingByEmail.avatar,
          businessIdentifier: businessIdentifier, // Оновлюємо businessIdentifier
        },
        select: { id: true, trustedDevices: true, name: true, slug: true, email: true, phone: true, address: true, description: true, logo: true, avatar: true, primaryColor: true, secondaryColor: true, backgroundColor: true, surfaceColor: true, isActive: true, businessIdentifier: true, profileCompleted: true, niche: true, customNiche: true, telegramChatId: true },
      })

      // Додаємо пристрій до довірених (select без telegramWebhookSetAt)
      const updatedTrustedDevices = addTrustedDevice(updatedBusiness.trustedDevices, currentDeviceId)
      await prisma.business.update({
        where: { id: updatedBusiness.id },
        data: { trustedDevices: updatedTrustedDevices },
        select: { id: true },
      })

      // Створюємо або оновлюємо TelegramUser
      const telegramUser = await prisma.telegramUser.upsert({
        where: { telegramId },
        update: {
          username: telegramData.username || null,
          firstName: telegramData.first_name || null,
          lastName: telegramData.last_name || null,
          lastActivity: new Date()
        },
        create: {
          businessId: updatedBusiness.id,
          telegramId: telegramId,
          username: telegramData.username || null,
          firstName: telegramData.first_name || null,
          lastName: telegramData.last_name || null,
          role: 'OWNER',
          isActive: true,
          activatedAt: new Date(),
          lastActivity: new Date()
        }
      })

      // Оновлюємо інтеграцію
      await prisma.socialIntegration.upsert({
        where: {
          businessId_platform: {
            businessId: updatedBusiness.id,
            platform: 'telegram'
          }
        },
        update: {
          isConnected: true,
          userId: telegramData.id.toString(),
          username: telegramData.username || null,
          metadata: JSON.stringify({
            firstName: telegramData.first_name,
            lastName: telegramData.last_name,
            photoUrl: telegramData.photo_url
          }),
          lastSyncAt: new Date()
        },
        create: {
          businessId: updatedBusiness.id,
          platform: 'telegram',
          isConnected: true,
          userId: telegramData.id.toString(),
          username: telegramData.username || null,
          metadata: JSON.stringify({
            firstName: telegramData.first_name,
            lastName: telegramData.last_name,
            photoUrl: telegramData.photo_url
          }),
          lastSyncAt: new Date()
        }
      })

      // Повертаємо успішний ВХІД в існуючий бізнес
      return NextResponse.json({
        success: true,
        action: 'login',
        business: {
          id: updatedBusiness.id,
          name: updatedBusiness.name,
          slug: updatedBusiness.slug,
          email: updatedBusiness.email,
          phone: updatedBusiness.phone,
          address: updatedBusiness.address,
          description: updatedBusiness.description,
          logo: updatedBusiness.logo,
          avatar: updatedBusiness.avatar || null,
          primaryColor: updatedBusiness.primaryColor,
          secondaryColor: updatedBusiness.secondaryColor,
          backgroundColor: updatedBusiness.backgroundColor,
          surfaceColor: updatedBusiness.surfaceColor,
          isActive: updatedBusiness.isActive,
          telegramChatId: updatedBusiness.telegramChatId || null,
          businessIdentifier: businessIdentifier, // Використовуємо згенерований або існуючий
          profileCompleted: updatedBusiness.profileCompleted || false,
        },
        user: {
          id: telegramUser.id,
          telegramId: telegramUser.telegramId.toString(),
          username: telegramUser.username,
          firstName: telegramUser.firstName,
          lastName: telegramUser.lastName,
          role: telegramUser.role
        }
      })
    }

    // 4.2. Якщо бізнесу з таким email немає - створюємо НОВИЙ
    // Генеруємо унікальний slug
    const baseSlug = (telegramData.first_name || 'user').toLowerCase()
      .replace(/[^a-z0-9а-яіїєґ]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    
    let slug = baseSlug
    let counter = 1
    
    while (await prisma.business.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Реєстрація через Telegram — пароль не встановлюємо; користувач створить його в налаштуваннях
    // і зможе входити як через Telegram, так і через email + пароль

    // Генеруємо унікальний ідентифікатор бізнесу
    const businessIdentifier = await generateBusinessIdentifier()

    // Створюємо новий бізнес (select без telegramWebhookSetAt)
    const newBusiness = await prisma.business.create({
      data: {
        name: telegramData.first_name 
          ? `${telegramData.first_name}${telegramData.last_name ? ' ' + telegramData.last_name : ''}`
          : 'Новий бізнес',
        email: email,
        password: null,
        slug: slug,
        phone: null,
        avatar: telegramData.photo_url || null,
        telegramId: telegramId,
        telegramBotToken: null,
        telegramChatId: telegramData.id.toString(),
        telegramNotificationsEnabled: true,
        smsProvider: 'smsc',
        remindersEnabled: true,
        reminderSmsEnabled: true,
        profileCompleted: false,
        businessIdentifier: businessIdentifier,
        niche: 'OTHER',
        customNiche: null,
        trustedDevices: JSON.stringify([currentDeviceId]), // Додаємо поточний пристрій до довірених
        trialEndsAt: getTrialEndDate(),
        subscriptionStatus: 'trial',
      },
      select: { id: true, name: true, slug: true, email: true, phone: true, address: true, description: true, logo: true, avatar: true, primaryColor: true, secondaryColor: true, backgroundColor: true, surfaceColor: true, isActive: true, businessIdentifier: true, profileCompleted: true, niche: true, customNiche: true },
    })

    // Реєструємо в Центрі управління
    try {
      const { registerBusinessInManagementCenter } = await import('@/lib/services/management-center')
      await registerBusinessInManagementCenter({
        businessId: newBusiness.id,
        business: newBusiness,
        registrationType: 'telegram',
      })
    } catch (error) {
      console.error('Помилка синхронізації в ManagementCenter:', error)
    }

    // Створюємо TelegramUser
    const newTelegramUser = await prisma.telegramUser.create({
      data: {
        businessId: newBusiness.id,
        telegramId: telegramId,
        username: telegramData.username || null,
        firstName: telegramData.first_name || null,
        lastName: telegramData.last_name || null,
        role: 'OWNER',
        isActive: true,
        activatedAt: new Date(),
        lastActivity: new Date()
      }
    })

    // Створюємо інтеграцію
    await prisma.socialIntegration.create({
      data: {
        businessId: newBusiness.id,
        platform: 'telegram',
        isConnected: true,
        userId: telegramData.id.toString(),
        username: telegramData.username || null,
        metadata: JSON.stringify({
          firstName: telegramData.first_name,
          lastName: telegramData.last_name,
          photoUrl: telegramData.photo_url
        }),
        lastSyncAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      action: 'register',
      business: {
        id: newBusiness.id,
        name: newBusiness.name,
        slug: newBusiness.slug,
        email: newBusiness.email,
        phone: newBusiness.phone,
        address: newBusiness.address,
        description: newBusiness.description,
        logo: newBusiness.logo,
        avatar: newBusiness.avatar || null,
        primaryColor: newBusiness.primaryColor,
        secondaryColor: newBusiness.secondaryColor,
        backgroundColor: newBusiness.backgroundColor,
        surfaceColor: newBusiness.surfaceColor,
        isActive: newBusiness.isActive,
        businessIdentifier: newBusiness.businessIdentifier || null,
        profileCompleted: newBusiness.profileCompleted || false,
        niche: newBusiness.niche || 'OTHER',
        customNiche: newBusiness.customNiche || null,
      },
      user: {
        id: newTelegramUser.id,
        telegramId: newTelegramUser.telegramId.toString(),
        username: newTelegramUser.username,
        firstName: newTelegramUser.firstName,
        lastName: newTelegramUser.lastName,
        role: newTelegramUser.role
      },
      message: 'Бізнес автоматично створено через Telegram OAuth'
    })
  } catch (error: any) {
    console.error('Telegram OAuth error:', error)
    
    if (error.code === 'P2002' && telegramData) {
      // Якщо помилка унікальності - спробуємо знайти існуючий акаунт (select без telegramWebhookSetAt)
      try {
        const telegramId = BigInt(telegramData.id)
        const business = await prisma.business.findUnique({
          where: { telegramId },
          select: { id: true, name: true, slug: true, email: true, phone: true, address: true, description: true, logo: true, avatar: true, primaryColor: true, secondaryColor: true, backgroundColor: true, surfaceColor: true, isActive: true, businessIdentifier: true, profileCompleted: true, niche: true, customNiche: true, telegramChatId: true },
        })
        
        if (business) {
          return NextResponse.json({
            success: true,
            action: 'login',
            business: {
              id: business.id,
              name: business.name,
              slug: business.slug,
              email: business.email,
              phone: business.phone,
              address: business.address,
              description: business.description,
              logo: business.logo,
              avatar: business.avatar || null,
              primaryColor: business.primaryColor,
              secondaryColor: business.secondaryColor,
              backgroundColor: business.backgroundColor,
              surfaceColor: business.surfaceColor,
              isActive: business.isActive,
              telegramChatId: business.telegramChatId || null,
              businessIdentifier: business.businessIdentifier || null,
              profileCompleted: business.profileCompleted || false,
            }
          })
        }
      } catch (retryError) {
        console.error('Retry error:', retryError)
      }
      
      return NextResponse.json({ 
        error: 'Цей Telegram акаунт вже зареєстровано' 
      }, { status: 409 })
    }
    
    return NextResponse.json(
      { error: 'Помилка обробки Telegram OAuth' },
      { status: 500 }
    )
  }
}

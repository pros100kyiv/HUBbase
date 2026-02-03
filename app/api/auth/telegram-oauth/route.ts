import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { generateDeviceId, getClientIp, getUserAgent, addTrustedDevice } from '@/lib/utils/device'
import { createVerificationCode, sendVerificationCodeToTelegram, verifyCode } from '@/lib/utils/telegram-verification'

/**
 * Виконує логіку входу/реєстрації після підтвердження коду
 */
async function processTelegramAuth(data: {
  telegramId: bigint
  telegramData: any
  action: 'login' | 'register'
  deviceId: string | null
  businessId: string | null
}) {
  const { telegramId, telegramData, action, deviceId, businessId } = data

  // Перевіряємо чи акаунт вже існує
  let business = await prisma.business.findUnique({
    where: { telegramId }
  })

  if (!business) {
    const telegramUser = await prisma.telegramUser.findUnique({
      where: { telegramId },
      include: { business: true }
    })

    if (telegramUser?.business) {
      business = telegramUser.business
      if (!business.telegramId) {
        await prisma.business.update({
          where: { id: business.id },
          data: { telegramId }
        })
      }
    }
  }

  // Якщо акаунт існує - виконуємо ВХІД
  if (business) {
    const updatedBusiness = await prisma.business.update({
      where: { id: business.id },
      data: {
        telegramChatId: telegramData?.id?.toString() || business.telegramChatId,
        avatar: telegramData?.photo_url || business.avatar,
        telegramId: business.telegramId || telegramId,
      }
    })

    // Додаємо пристрій до довірених
    if (deviceId) {
      const updatedTrustedDevices = addTrustedDevice(updatedBusiness.trustedDevices, deviceId)
      await prisma.business.update({
        where: { id: business.id },
        data: { trustedDevices: updatedTrustedDevices }
      })
    }

    // Отримуємо або створюємо TelegramUser
    let telegramUser = await prisma.telegramUser.findUnique({
      where: { telegramId }
    })

    if (!telegramUser) {
      telegramUser = await prisma.telegramUser.create({
        data: {
          businessId: business.id,
          telegramId: telegramId,
          username: telegramData?.username || null,
          firstName: telegramData?.first_name || null,
          lastName: telegramData?.last_name || null,
          role: 'OWNER',
          isActive: true,
          activatedAt: new Date(),
          lastActivity: new Date()
        }
      })
    } else {
      await prisma.telegramUser.update({
        where: { id: telegramUser.id },
        data: {
          username: telegramData?.username || null,
          firstName: telegramData?.first_name || null,
          lastName: telegramData?.last_name || null,
          lastActivity: new Date()
        }
      })
    }

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
        userId: telegramData?.id?.toString() || telegramId.toString(),
        username: telegramData?.username || null,
        metadata: JSON.stringify({
          firstName: telegramData?.first_name,
          lastName: telegramData?.last_name,
          photoUrl: telegramData?.photo_url
        }),
        lastSyncAt: new Date()
      },
      create: {
        businessId: business.id,
        platform: 'telegram',
        isConnected: true,
        userId: telegramData?.id?.toString() || telegramId.toString(),
        username: telegramData?.username || null,
        metadata: JSON.stringify({
          firstName: telegramData?.first_name,
          lastName: telegramData?.last_name,
          photoUrl: telegramData?.photo_url
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
        businessIdentifier: updatedBusiness.businessIdentifier || null,
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

  // Якщо businessId вказано (реєстрація з нового пристрою) - прив'язуємо до бізнесу
  if (businessId) {
    const existingBusiness = await prisma.business.findUnique({
      where: { id: businessId }
    })

    if (!existingBusiness) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Додаємо пристрій до довірених
    if (deviceId) {
      const updatedTrustedDevices = addTrustedDevice(existingBusiness.trustedDevices, deviceId)
      await prisma.business.update({
        where: { id: existingBusiness.id },
        data: { trustedDevices: updatedTrustedDevices }
      })
    }

    // Оновлюємо telegramId в бізнесі
    await prisma.business.update({
      where: { id: existingBusiness.id },
      data: {
        telegramId: telegramId,
        telegramChatId: telegramData?.id?.toString() || existingBusiness.telegramChatId,
        avatar: telegramData?.photo_url || existingBusiness.avatar
      }
    })

    // Створюємо або оновлюємо TelegramUser
    const telegramUser = await prisma.telegramUser.upsert({
      where: { telegramId },
      update: {
        username: telegramData?.username || null,
        firstName: telegramData?.first_name || null,
        lastName: telegramData?.last_name || null,
        lastActivity: new Date()
      },
      create: {
        businessId: existingBusiness.id,
        telegramId: telegramId,
        username: telegramData?.username || null,
        firstName: telegramData?.first_name || null,
        lastName: telegramData?.last_name || null,
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
        id: existingBusiness.id,
        name: existingBusiness.name,
        slug: existingBusiness.slug,
        email: existingBusiness.email,
        phone: existingBusiness.phone,
        address: existingBusiness.address,
        description: existingBusiness.description,
        logo: existingBusiness.logo,
        avatar: telegramData?.photo_url || existingBusiness.avatar || null,
        primaryColor: existingBusiness.primaryColor,
        secondaryColor: existingBusiness.secondaryColor,
        backgroundColor: existingBusiness.backgroundColor,
        surfaceColor: existingBusiness.surfaceColor,
        isActive: existingBusiness.isActive,
        telegramChatId: telegramData?.id?.toString() || existingBusiness.telegramChatId,
        businessIdentifier: existingBusiness.businessIdentifier || null,
        profileCompleted: existingBusiness.profileCompleted || false,
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

  // Якщо акаунт НЕ знайдено - створюємо НОВИЙ
  const baseSlug = (telegramData?.first_name || 'user').toLowerCase()
    .replace(/[^a-z0-9а-яіїєґ]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  
  let slug = baseSlug
  let counter = 1
  
  while (await prisma.business.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`
    counter++
  }

  const email = telegramData?.username 
    ? `${telegramData.username}@telegram.xbase.online`
    : `telegram-${telegramId}@xbase.online`

  const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12)
  const hashedPassword = await bcrypt.hash(randomPassword, 10)
  const defaultBotToken = process.env.DEFAULT_TELEGRAM_BOT_TOKEN || '8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo'
  const businessIdentifier = Math.floor(10000 + Math.random() * 90000).toString()

  const newBusiness = await prisma.business.create({
    data: {
      name: telegramData?.first_name 
        ? `${telegramData.first_name}${telegramData.last_name ? ' ' + telegramData.last_name : ''}`
        : 'Новий бізнес',
      email: email,
      password: hashedPassword,
      slug: slug,
      phone: null,
      avatar: telegramData?.photo_url || null,
      telegramId: telegramId,
      telegramBotToken: defaultBotToken,
      telegramChatId: telegramData?.id?.toString() || null,
      telegramNotificationsEnabled: true,
      smsProvider: 'smsc',
      remindersEnabled: true,
      reminderSmsEnabled: true,
      profileCompleted: false,
      businessIdentifier: businessIdentifier,
      niche: 'OTHER',
      customNiche: null,
      trustedDevices: deviceId ? JSON.stringify([deviceId]) : null,
    }
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

  const newTelegramUser = await prisma.telegramUser.create({
    data: {
      businessId: newBusiness.id,
      telegramId: telegramId,
      username: telegramData?.username || null,
      firstName: telegramData?.first_name || null,
      lastName: telegramData?.last_name || null,
      role: 'OWNER',
      isActive: true,
      activatedAt: new Date(),
      lastActivity: new Date()
    }
  })

  await prisma.socialIntegration.create({
    data: {
      businessId: newBusiness.id,
      platform: 'telegram',
      isConnected: true,
      userId: telegramData?.id?.toString() || telegramId.toString(),
      username: telegramData?.username || null,
      metadata: JSON.stringify({
        firstName: telegramData?.first_name,
        lastName: telegramData?.last_name,
        photoUrl: telegramData?.photo_url
      }),
      lastSyncAt: new Date()
    }
  })

  try {
    const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'}/api/telegram/webhook?businessId=${newBusiness.id}`
    await fetch(`https://api.telegram.org/bot${defaultBotToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    })
  } catch (error) {
    console.error('Помилка налаштування webhook:', error)
  }

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
}

/**
 * API для автоматичної реєстрації/входу через Telegram OAuth
 * НОВА ЛОГІКА: завжди відправляємо код підтвердження в Telegram
 * Після підтвердження коду в боті - виконуємо вхід/реєстрацію
 */
export async function POST(request: Request) {
  let telegramData: any = null
  
  try {
    const body = await request.json()
    telegramData = body.telegramData
    const { businessId, deviceId, verificationCode } = body
    
    // Якщо передано код підтвердження - перевіряємо його та виконуємо вхід/реєстрацію
    if (verificationCode) {
      const verification = await verifyCode(verificationCode)
      
      if (!verification.success || !verification.verification) {
        return NextResponse.json({ 
          error: verification.error || 'Невірний код підтвердження' 
        }, { status: 400 })
      }

      const ver = verification.verification
      const telegramId = ver.telegramId
      const parsedTelegramData = ver.telegramData ? JSON.parse(ver.telegramData) : null
      
      // Виконуємо логіку входу/реєстрації після підтвердження коду
      return await processTelegramAuth({
        telegramId,
        telegramData: parsedTelegramData,
        action: ver.action as 'login' | 'register',
        deviceId: ver.deviceId || null,
        businessId: ver.businessId || null
      })
    }
    
    // Якщо код не передано - генеруємо та відправляємо код підтвердження
    if (!telegramData || !telegramData.id) {
      return NextResponse.json({ error: 'Telegram data is required' }, { status: 400 })
    }

    const telegramId = BigInt(telegramData.id)
    
    // Генеруємо deviceId для перевірки пристрою
    const clientIp = getClientIp(request)
    const userAgent = getUserAgent(request)
    const currentDeviceId = deviceId || generateDeviceId(clientIp, userAgent)
    
    // Визначаємо дію (login або register)
    let business = await prisma.business.findUnique({
      where: { telegramId }
    })

    if (!business) {
      const telegramUser = await prisma.telegramUser.findUnique({
        where: { telegramId },
        include: { business: true }
      })
      business = telegramUser?.business || null
    }

    const action: 'login' | 'register' = business ? 'login' : 'register'
    
    // Генеруємо код підтвердження
    const code = await createVerificationCode({
      telegramId,
      telegramData,
      action,
      deviceId: currentDeviceId,
      businessId: businessId || null
    })

    // Відправляємо код в Telegram
    // Використовуємо дефолтний токен бота або токен бізнесу
    const botToken = business?.telegramBotToken || process.env.DEFAULT_TELEGRAM_BOT_TOKEN || '8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo'
    
    const codeSent = await sendVerificationCodeToTelegram(
      botToken,
      telegramId,
      code,
      action
    )

    if (!codeSent) {
      return NextResponse.json({ 
        error: 'Не вдалося відправити код підтвердження в Telegram. Переконайтеся, що ви почали діалог з ботом.' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      requiresVerification: true,
      message: `Код підтвердження відправлено в Telegram. Введіть код ${code} в боті для завершення ${action === 'login' ? 'входу' : 'реєстрації'}.`,
      code: code // Тимчасово повертаємо код для тестування (в продакшені прибрати)
    })
  } catch (error: any) {
    console.error('Telegram OAuth error:', error)
    
    if (error.code === 'P2002') {
      try {
        const telegramId = BigInt(telegramData.id)
        const business = await prisma.business.findUnique({
          where: { telegramId }
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
    
    return NextResponse.json({ 
      error: error.message || 'Помилка обробки Telegram OAuth' 
    }, { status: 500 })
  }
}

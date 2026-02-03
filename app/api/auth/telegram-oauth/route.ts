import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

/**
 * API для автоматичної реєстрації/входу через Telegram OAuth
 * Проста логіка: якщо акаунт існує - вхід, якщо ні - створення нового
 */
export async function POST(request: Request) {
  let telegramData: any = null
  
  try {
    const body = await request.json()
    telegramData = body.telegramData
    
    if (!telegramData || !telegramData.id) {
      return NextResponse.json({ error: 'Telegram data is required' }, { status: 400 })
    }

    const telegramId = BigInt(telegramData.id)
    
    // КРОК 1: Перевіряємо чи акаунт вже існує
    // Спочатку перевіряємо в Business.telegramId
    let business = await prisma.business.findUnique({
      where: { telegramId }
    })
    
    // Якщо не знайдено в Business - перевіряємо в TelegramUser
    if (!business) {
      const telegramUser = await prisma.telegramUser.findUnique({
        where: { telegramId },
        include: { business: true }
      })
      
      if (telegramUser?.business) {
        business = telegramUser.business
        
        // Синхронізуємо telegramId в Business, якщо його там немає
        if (!business.telegramId) {
          await prisma.business.update({
            where: { id: business.id },
            data: { telegramId }
          })
        }
      }
    }
    
    // КРОК 2: Якщо акаунт знайдено - робимо ВХІД
    if (business) {
      // Оновлюємо дані бізнесу
      const updatedBusiness = await prisma.business.update({
        where: { id: business.id },
        data: {
          telegramChatId: telegramData.id.toString(),
          avatar: telegramData.photo_url || business.avatar,
          telegramId: business.telegramId || telegramId, // Переконаємося що telegramId встановлено
        }
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

    // КРОК 3: Якщо акаунт НЕ знайдено - створюємо НОВИЙ
    // Генеруємо унікальний slug
    const baseSlug = (telegramData.first_name || 'user').toLowerCase()
      .replace(/[^a-z0-9а-яіїєґ]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    
    let slug = baseSlug
    let counter = 1
    
    while (await prisma.business.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Генеруємо email
    const email = telegramData.username 
      ? `${telegramData.username}@telegram.xbase.online`
      : `telegram-${telegramData.id}@xbase.online`

    // Генеруємо пароль
    const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12)
    const hashedPassword = await bcrypt.hash(randomPassword, 10)

    // Отримуємо токен бота
    const defaultBotToken = process.env.DEFAULT_TELEGRAM_BOT_TOKEN || '8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo'
    
    // Генеруємо ідентифікатор бізнесу
    const businessIdentifier = Math.floor(10000 + Math.random() * 90000).toString()

    // Створюємо новий бізнес
    const newBusiness = await prisma.business.create({
      data: {
        name: telegramData.first_name 
          ? `${telegramData.first_name}${telegramData.last_name ? ' ' + telegramData.last_name : ''}`
          : 'Новий бізнес',
        email: email,
        password: hashedPassword,
        slug: slug,
        phone: null,
        avatar: telegramData.photo_url || null,
        telegramId: telegramId,
        telegramBotToken: defaultBotToken,
        telegramChatId: telegramData.id.toString(),
        telegramNotificationsEnabled: true,
        smsProvider: 'smsc',
        remindersEnabled: true,
        reminderSmsEnabled: true,
        profileCompleted: false,
        businessIdentifier: businessIdentifier,
        niche: 'OTHER',
        customNiche: null,
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

    // Налаштовуємо webhook
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
  } catch (error: any) {
    console.error('Telegram OAuth error:', error)
    
    if (error.code === 'P2002' && telegramData) {
      // Якщо помилка унікальності - спробуємо знайти існуючий акаунт
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

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createBusiness } from '@/lib/auth'
import bcrypt from 'bcryptjs'

/**
 * API для автоматичної реєстрації/входу через Telegram OAuth
 * Пріоритет: OAuth - якщо користувач авторизується через Telegram, автоматично створюється акаунт
 */
export async function POST(request: Request) {
  try {
    const { telegramData, businessId } = await request.json()
    
    if (!telegramData || !telegramData.id) {
      return NextResponse.json({ error: 'Telegram data is required' }, { status: 400 })
    }

    const telegramId = BigInt(telegramData.id)
    
    // Перевіряємо, чи бізнес вже зареєстрований через Telegram OAuth
    let existingBusiness = await prisma.business.findUnique({
      where: { telegramId }
    })

    // Якщо бізнес знайдено через Telegram ID - автоматичний вхід
    if (existingBusiness) {
      // Оновлюємо дані бізнесу
      await prisma.business.update({
        where: { id: existingBusiness.id },
        data: {
          telegramChatId: telegramData.id.toString(),
          avatar: telegramData.photo_url || existingBusiness.avatar // Оновлюємо аватар, якщо є
        }
      })

      // Отримуємо або створюємо TelegramUser
      let telegramUser = await prisma.telegramUser.findUnique({
        where: { telegramId },
        include: { business: true }
      })

      if (!telegramUser) {
        telegramUser = await prisma.telegramUser.create({
          data: {
            businessId: existingBusiness.id,
            telegramId: telegramId,
            username: telegramData.username || null,
            firstName: telegramData.first_name || null,
            lastName: telegramData.last_name || null,
            role: 'OWNER',
            isActive: true,
            activatedAt: new Date(),
            lastActivity: new Date()
          },
          include: { business: true }
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
            businessId: existingBusiness.id,
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
          businessId: existingBusiness.id,
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
          id: existingBusiness.id,
          name: existingBusiness.name,
          slug: existingBusiness.slug,
          email: existingBusiness.email,
          phone: existingBusiness.phone,
          address: existingBusiness.address,
          description: existingBusiness.description,
          logo: existingBusiness.logo,
          avatar: telegramData.photo_url || existingBusiness.avatar || null,
          primaryColor: existingBusiness.primaryColor,
          secondaryColor: existingBusiness.secondaryColor,
          backgroundColor: existingBusiness.backgroundColor,
          surfaceColor: existingBusiness.surfaceColor,
          isActive: existingBusiness.isActive,
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

    // Перевіряємо, чи користувач вже зареєстрований через TelegramUser
    let telegramUser = await prisma.telegramUser.findUnique({
      where: { telegramId },
      include: { business: true }
    })

    // Якщо користувач вже існує - автоматичний вхід
    if (telegramUser && telegramUser.business) {
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

      // Оновлюємо інтеграцію
      await prisma.socialIntegration.upsert({
        where: {
          businessId_platform: {
            businessId: telegramUser.businessId,
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
          businessId: telegramUser.businessId,
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
          id: telegramUser.business.id,
          name: telegramUser.business.name,
          slug: telegramUser.business.slug,
          email: telegramUser.business.email,
          phone: telegramUser.business.phone,
          address: telegramUser.business.address,
          description: telegramUser.business.description,
          logo: telegramUser.business.logo,
          primaryColor: telegramUser.business.primaryColor,
          secondaryColor: telegramUser.business.secondaryColor,
          backgroundColor: telegramUser.business.backgroundColor,
          surfaceColor: telegramUser.business.surfaceColor,
          isActive: telegramUser.business.isActive,
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

    // Якщо businessId вказано - прив'язуємо до існуючого бізнесу
    if (businessId) {
      const business = await prisma.business.findUnique({
        where: { id: businessId }
      })

      if (!business) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 })
      }

      // Створюємо TelegramUser для існуючого бізнесу
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
        },
        include: { business: true }
      })

      // Створюємо інтеграцію
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
        action: 'connected',
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

    // Автоматична реєстрація нового бізнесу через Telegram OAuth
    // Генеруємо унікальний slug на основі імені користувача
    const baseSlug = (telegramData.first_name || 'user').toLowerCase()
      .replace(/[^a-z0-9а-яіїєґ]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    
    let slug = baseSlug
    let counter = 1
    
    // Перевіряємо унікальність slug
    while (await prisma.business.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Генеруємо email на основі Telegram username або ID
    const email = telegramData.username 
      ? `${telegramData.username}@telegram.xbase.online`
      : `telegram-${telegramData.id}@xbase.online`

    // Генеруємо випадковий пароль (користувач може змінити його пізніше)
    const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12)
    const hashedPassword = await bcrypt.hash(randomPassword, 10)

    // Отримуємо токен бота з env або використовуємо дефолтний
    const defaultBotToken = process.env.DEFAULT_TELEGRAM_BOT_TOKEN || '8258074435:AAHTKLTw6UDd92BV0Go-2ZQ_f2g_3QTXiIo'
    
    // Створюємо новий бізнес з усіма налаштуваннями Telegram
    const newBusiness = await prisma.business.create({
      data: {
        name: telegramData.first_name 
          ? `${telegramData.first_name}${telegramData.last_name ? ' ' + telegramData.last_name : ''}`
          : 'Новий бізнес',
        email: email,
        password: hashedPassword,
        slug: slug,
        phone: null,
        avatar: telegramData.photo_url || null, // Зберігаємо аватар з Telegram
        telegramId: telegramId, // Зберігаємо Telegram ID для OAuth
        telegramBotToken: defaultBotToken,
        telegramChatId: telegramData.id.toString(),
        telegramNotificationsEnabled: true,
        // Автоматично вмикаємо SMS для нових бізнесів через Telegram
        smsProvider: 'smsc', // Дефолтний провайдер
        remindersEnabled: true,
        reminderSmsEnabled: true
      }
    })

    // Створюємо TelegramUser
    telegramUser = await prisma.telegramUser.create({
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
      },
      include: { business: true }
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

    // Налаштовуємо webhook для нового бізнесу
    try {
      const webhookUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://xbase.online'}/api/telegram/webhook?businessId=${newBusiness.id}`
      await fetch(`https://api.telegram.org/bot${defaultBotToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
      })
    } catch (error) {
      console.error('Error setting webhook for new business:', error)
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
      },
      user: {
        id: telegramUser.id,
        telegramId: telegramUser.telegramId.toString(),
        username: telegramUser.username,
        firstName: telegramUser.firstName,
        lastName: telegramUser.lastName,
        role: telegramUser.role
      },
      message: 'Бізнес автоматично створено через Telegram OAuth'
    })
  } catch (error: any) {
    console.error('Telegram OAuth registration error:', error)
    
    if (error.code === 'P2002') {
      return NextResponse.json({ 
        error: 'Цей Telegram акаунт вже зареєстровано' 
      }, { status: 409 })
    }
    
    return NextResponse.json({ 
      error: error.message || 'Failed to process Telegram OAuth' 
    }, { status: 500 })
  }
}


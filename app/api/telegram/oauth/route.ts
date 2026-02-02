import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { businessId, telegramData } = await request.json()
    
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    if (!telegramData || !telegramData.id) {
      return NextResponse.json({ error: 'Telegram data is required' }, { status: 400 })
    }

    // Валідація даних
    const telegramId = BigInt(telegramData.id)
    if (!telegramId || telegramId <= 0) {
      return NextResponse.json({ error: 'Invalid Telegram user ID' }, { status: 400 })
    }

    // Зберігаємо дані Telegram користувача
    const telegramUser = await prisma.telegramUser.upsert({
      where: {
        businessId_telegramId: {
          businessId,
          telegramId: telegramId
        }
      },
      update: {
        username: telegramData.username || null,
        firstName: telegramData.first_name || null,
        lastName: telegramData.last_name || null,
        isActive: true,
        lastActivity: new Date()
      },
      create: {
        businessId,
        telegramId: telegramId,
        username: telegramData.username || null,
        firstName: telegramData.first_name || null,
        lastName: telegramData.last_name || null,
        role: 'OWNER',
        isActive: true,
        lastActivity: new Date()
      },
      include: { business: true }
    })

    // Оновлюємо business з Telegram Chat ID
    await prisma.business.update({
      where: { id: businessId },
      data: {
        telegramChatId: telegramData.id.toString()
      }
    })

    // Створюємо або оновлюємо інтеграцію
    await prisma.socialIntegration.upsert({
      where: {
        businessId_platform: {
          businessId,
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
        businessId,
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
      user: {
        id: telegramUser.id,
        telegramId: telegramUser.telegramId,
        username: telegramUser.username,
        firstName: telegramUser.firstName,
        lastName: telegramUser.lastName,
        role: telegramUser.role,
        isActive: telegramUser.isActive
      },
      telegramUser: {
        id: telegramUser.id,
        telegramId: telegramUser.telegramId,
        username: telegramUser.username,
        firstName: telegramUser.firstName,
        lastName: telegramUser.lastName,
        role: telegramUser.role,
        isActive: telegramUser.isActive
      },
      telegramData
    })
  } catch (error: any) {
    console.error('Telegram OAuth error:', error)
    
    // Більш детальна обробка помилок
    if (error.code === 'P2002') {
      return NextResponse.json({ 
        error: 'Цей Telegram акаунт вже підключено до іншого бізнесу' 
      }, { status: 409 })
    }
    
    if (error.message?.includes('Invalid')) {
      return NextResponse.json({ 
        error: 'Некоректні дані від Telegram' 
      }, { status: 400 })
    }
    
    return NextResponse.json({ 
      error: error.message || 'Failed to connect Telegram' 
    }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    const integration = await prisma.socialIntegration.findUnique({
      where: {
        businessId_platform: {
          businessId,
          platform: 'telegram'
        }
      }
    })

    if (integration && integration.isConnected) {
      const telegramUser = await prisma.telegramUser.findFirst({
        where: {
          businessId,
          role: 'OWNER',
          isActive: true
        }
      })

      return NextResponse.json({
        connected: true,
        user: telegramUser,
        integration
      })
    }

    return NextResponse.json({
      connected: false
    })
  } catch (error) {
    console.error('Error checking connection:', error)
    return NextResponse.json({ error: 'Failed to check connection' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { businessId } = await request.json()
    
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Відключаємо інтеграцію
    await prisma.socialIntegration.updateMany({
      where: {
        businessId,
        platform: 'telegram'
      },
      data: {
        isConnected: false,
        accessToken: null,
        refreshToken: null
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disconnecting:', error)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}


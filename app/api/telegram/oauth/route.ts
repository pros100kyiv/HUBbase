import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { businessId, telegramData } = await request.json()
    
    if (!businessId || !telegramData) {
      return NextResponse.json({ error: 'Missing required data' }, { status: 400 })
    }

    // Зберігаємо дані Telegram користувача
    const telegramUser = await prisma.telegramUser.upsert({
      where: {
        businessId_telegramId: {
          businessId,
          telegramId: BigInt(telegramData.id)
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
        telegramId: BigInt(telegramData.id),
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
      user: telegramUser,
      telegramData
    })
  } catch (error) {
    console.error('Telegram OAuth error:', error)
    return NextResponse.json({ error: 'Failed to connect Telegram' }, { status: 500 })
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


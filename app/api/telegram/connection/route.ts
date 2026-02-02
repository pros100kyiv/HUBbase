import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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


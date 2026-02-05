import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * DELETE /api/telegram/oauth - Відключення Telegram інтеграції
 * Використовується TelegramOAuth при натисканні "Відключити"
 */
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

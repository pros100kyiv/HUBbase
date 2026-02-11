import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    const [integrations, business] = await Promise.all([
      prisma.socialIntegration.findMany({
        where: { businessId },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.business.findUnique({
        where: { id: businessId },
        select: { telegramBotToken: true }
      })
    ])

    const hasTelegramBot = !!business?.telegramBotToken
    const platformNames: Record<string, string> = {
      telegram: 'Telegram',
      instagram: 'Instagram',
      whatsapp: 'WhatsApp',
      facebook: 'Facebook',
      viber: 'Viber',
    }

    // Формуємо список інтеграцій; Telegram вважається підключеним, якщо є OAuth або налаштований бот (для повідомлень)
    const integrationsList = ['telegram', 'instagram', 'whatsapp', 'facebook', 'viber'].map(platform => {
      const integration = integrations.find(i => i.platform === platform)
      const connected = platform === 'telegram'
        ? (integration?.isConnected ?? false) || hasTelegramBot
        : (integration?.isConnected ?? false)
      return {
        id: platform,
        name: platformNames[platform] || platform.charAt(0).toUpperCase() + platform.slice(1),
        connected,
        username: integration?.username ?? null,
        lastSyncAt: integration?.lastSyncAt ?? null
      }
    })

    return NextResponse.json({
      integrations: integrationsList
    })
  } catch (error) {
    console.error('Error fetching integrations:', error)
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 })
  }
}


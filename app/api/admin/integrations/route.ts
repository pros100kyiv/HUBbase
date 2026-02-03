import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const platform = new URL(request.url).searchParams.get('platform') // 'telegram' | 'google' | 'all'

    const where: any = {}
    if (platform && platform !== 'all') {
      where.platform = platform
    }

    const integrations = await prisma.socialIntegration.findMany({
      where,
      include: {
        business: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { lastSyncAt: 'desc' },
    })

    const stats = {
      total: await prisma.socialIntegration.count(),
      connected: await prisma.socialIntegration.count({ where: { isConnected: true } }),
      telegram: await prisma.socialIntegration.count({ where: { platform: 'telegram' } }),
      google: await prisma.socialIntegration.count({ where: { platform: 'google' } }),
      byPlatform: await prisma.socialIntegration.groupBy({
        by: ['platform'],
        _count: true,
      }),
    }

    return NextResponse.json({
      integrations,
      stats,
    })
  } catch (error: any) {
    console.error('Error fetching integrations:', error)
    return NextResponse.json({ error: 'Помилка отримання інтеграцій' }, { status: 500 })
  }
}


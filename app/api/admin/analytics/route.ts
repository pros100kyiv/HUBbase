import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
import { verifyAdminToken } from '@/lib/middleware/admin-auth'
import { jsonSafe } from '@/lib/utils/json'

export async function GET(request: Request) {
  // Перевірка доступу
  const auth = verifyAdminToken(request as any)
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month' // 'day' | 'week' | 'month' | 'year'

    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    const totalBusinesses = await prisma.business.count()
    const activeBusinesses = await prisma.business.count({ where: { isActive: true } })

    const registrations = await prisma.business.findMany({
      where: { createdAt: { gte: startDate } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, createdAt: true, telegramId: true, googleId: true },
    })

    const byNiche = await prisma.business.groupBy({
      by: ['niche'],
      _count: true,
    })

    const telegramCount = await prisma.business.count({ where: { telegramId: { not: null } } })
    const googleCount = await prisma.business.count({ where: { googleId: { not: null } } })
    const standardCount = await prisma.business.count({
      where: { telegramId: null, googleId: null },
    })

    const topBusinesses = await prisma.business.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { id: true, name: true, email: true, updatedAt: true },
    })

    const dateCounts = new Map<string, number>()
    for (const r of registrations) {
      const d = r.createdAt.toISOString().split('T')[0]
      dateCounts.set(d, (dateCounts.get(d) || 0) + 1)
    }
    const registrationTrend = Array.from(dateCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date: new Date(date), count }))

    return NextResponse.json(jsonSafe({
      overview: {
        totalBusinesses,
        activeBusinesses,
        inactiveBusinesses: totalBusinesses - activeBusinesses,
      },
      registrations: {
        total: registrations.length,
        trend: registrationTrend,
        byType: [
          { registrationType: 'telegram', _count: telegramCount },
          { registrationType: 'google', _count: googleCount },
          { registrationType: 'standard', _count: standardCount },
        ],
      },
      byNiche,
      topBusinesses,
    }))
  } catch (error: any) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json({ error: 'Помилка отримання аналітики' }, { status: 500 })
  }
}


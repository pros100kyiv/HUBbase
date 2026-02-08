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

    // Загальна статистика
    const totalBusinesses = await prisma.managementCenter.count()
    const activeBusinesses = await prisma.managementCenter.count({ where: { isActive: true } })
    
    // Реєстрації за період
    const registrations = await prisma.managementCenter.findMany({
      where: {
        registeredAt: { gte: startDate },
      },
      orderBy: { registeredAt: 'asc' },
    })

    // Статистика по нішах
    const byNiche = await prisma.managementCenter.groupBy({
      by: ['niche'],
      _count: true,
    })

    // Статистика по типах реєстрації
    const byRegistrationType = await prisma.managementCenter.groupBy({
      by: ['registrationType'],
      _count: true,
    })

    // Топ бізнеси (по останньому входу)
    const topBusinesses = await prisma.managementCenter.findMany({
      where: {
        lastLoginAt: { not: null },
      },
      orderBy: { lastLoginAt: 'desc' },
      take: 10,
    })

    // Динаміка реєстрацій
    const registrationTrend = await prisma.$queryRawUnsafe(
      `SELECT 
        DATE(registered_at) as date,
        COUNT(*)::int as count
      FROM "ManagementCenter"
      WHERE registered_at >= $1
      GROUP BY DATE(registered_at)
      ORDER BY date ASC`,
      startDate
    )

    return NextResponse.json(jsonSafe({
      overview: {
        totalBusinesses,
        activeBusinesses,
        inactiveBusinesses: totalBusinesses - activeBusinesses,
      },
      registrations: {
        total: registrations.length,
        trend: registrationTrend,
        byType: byRegistrationType,
      },
      byNiche,
      topBusinesses,
    }))
  } catch (error: any) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json({ error: 'Помилка отримання аналітики' }, { status: 500 })
  }
}


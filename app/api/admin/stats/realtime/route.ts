import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/middleware/admin-auth'

/** Хвилини для визначення статусу */
const ONLINE_MINUTES = 5   // вхід за останні 5 хв = онлайн
const IDLE_MINUTES = 60   // 5–60 хв = в простої, >60 хв = офлайн

export async function GET(request: Request) {
  const auth = verifyAdminToken(request as any)
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const onlineThreshold = new Date(now.getTime() - ONLINE_MINUTES * 60 * 1000)
    const idleThreshold = new Date(now.getTime() - IDLE_MINUTES * 60 * 1000)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [
      total,
      online,
      idle,
      offlineNever,
      newToday,
      blocked,
    ] = await Promise.all([
      prisma.managementCenter.count(),
      prisma.managementCenter.count({
        where: {
          lastLoginAt: { gte: onlineThreshold },
          isActive: true,
        },
      }),
      prisma.managementCenter.count({
        where: {
          lastLoginAt: {
            gte: idleThreshold,
            lt: onlineThreshold,
          },
          isActive: true,
        },
      }),
      prisma.managementCenter.count({
        where: {
          OR: [
            { lastLoginAt: null },
            { lastLoginAt: { lt: idleThreshold } },
          ],
          isActive: true,
        },
      }),
      prisma.managementCenter.count({
        where: { registeredAt: { gte: todayStart } },
      }),
      prisma.managementCenter.count({
        where: { isActive: false },
      }),
    ])

    return NextResponse.json({
      total,
      online,
      idle,
      offline: offlineNever,
      newToday,
      blocked,
      updatedAt: now.toISOString(),
    })
  } catch (error) {
    console.error('Error fetching realtime stats:', error)
    return NextResponse.json({ error: 'Помилка отримання статистики' }, { status: 500 })
  }
}

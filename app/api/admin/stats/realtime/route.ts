import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
import { verifyAdminToken } from '@/lib/middleware/admin-auth'

/** Хвилини для визначення статусу */
const PAGE_ONLINE_MINUTES = 2   // heartbeat за останні 2 хв = сторінка відкрита (онлайн)
const IDLE_MINUTES = 60        // 2–60 хв = в простої, >60 хв = офлайн

export async function GET(request: Request) {
  const auth = verifyAdminToken(request as any)
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const pageOnlineThreshold = new Date(now.getTime() - PAGE_ONLINE_MINUTES * 60 * 1000)
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
      // Онлайн = сторінка дашборду відкрита (lastSeenAt за останні 2 хв)
      prisma.managementCenter.count({
        where: {
          lastSeenAt: { gte: pageOnlineThreshold },
          isActive: true,
        },
      }),
      // В простої = був на сторінці 2–60 хв тому
      prisma.managementCenter.count({
        where: {
          lastSeenAt: {
            gte: idleThreshold,
            lt: pageOnlineThreshold,
          },
          isActive: true,
        },
      }),
      // Офлайн = lastSeenAt > 60 хв або null
      prisma.managementCenter.count({
        where: {
          OR: [
            { lastSeenAt: null },
            { lastSeenAt: { lt: idleThreshold } },
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

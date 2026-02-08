import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/middleware/admin-auth'

export const dynamic = 'force-dynamic'

const PAGE_ONLINE_MINUTES = 2
const IDLE_MINUTES = 60

const EMPTY_STATS = {
  total: 0,
  online: 0,
  idle: 0,
  offline: 0,
  newToday: 0,
  blocked: 0,
  updatedAt: new Date().toISOString(),
}

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

    const [total, online, idle, offlineNever, newToday, blocked] = await Promise.all([
      prisma.business.count(),
      prisma.managementCenter.count({
        where: { lastSeenAt: { gte: pageOnlineThreshold }, isActive: true },
      }),
      prisma.managementCenter.count({
        where: {
          lastSeenAt: { gte: idleThreshold, lt: pageOnlineThreshold },
          isActive: true,
        },
      }),
      prisma.managementCenter.count({
        where: {
          OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: idleThreshold } }],
          isActive: true,
        },
      }),
      prisma.business.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.business.count({ where: { isActive: false } }),
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
    console.error('Realtime stats error:', error)
    return NextResponse.json(EMPTY_STATS, { status: 200 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/middleware/admin-auth'
import { jsonSafe } from '@/lib/utils/json'

export const dynamic = 'force-dynamic'

/** Джерело правди: Business. ManagementCenter — додаткові поля (lastSeenAt, lastLoginAt). */
function getRegistrationType(b: { telegramId: bigint | null; googleId: string | null }) {
  if (b.telegramId) return 'telegram' as const
  if (b.googleId) return 'google' as const
  return 'standard' as const
}

export async function GET(request: Request) {
  const auth = verifyAdminToken(request as any)
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') // 'active' | 'inactive' | 'all'
    const registrationType = searchParams.get('registrationType') // 'telegram' | 'google' | 'standard' | 'all'
    const niche = searchParams.get('niche') // 'all' | конкретна ніша

    const skip = (page - 1) * limit
    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { businessIdentifier: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status === 'active') where.isActive = true
    else if (status === 'inactive') where.isActive = false

    if (niche && niche !== 'all') where.niche = niche

    if (registrationType && registrationType !== 'all') {
      if (registrationType === 'telegram') where.telegramId = { not: null }
      else if (registrationType === 'google') where.googleId = { not: null }
      else if (registrationType === 'standard') {
        where.telegramId = null
        where.googleId = null
      }
    }

    const [businessesRaw, total] = await Promise.all([
      prisma.business.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.business.count({ where }),
    ])

    const mcMap = new Map<string, { lastLoginAt: Date | null; lastSeenAt: Date | null; registrationType: string }>()
    if (businessesRaw.length > 0) {
      const mcList = await prisma.managementCenter.findMany({
        where: { businessId: { in: businessesRaw.map((b) => b.id) } },
        select: { businessId: true, lastLoginAt: true, lastSeenAt: true, registrationType: true },
      })
      for (const mc of mcList) {
        mcMap.set(mc.businessId, mc)
      }
    }

    const businesses = businessesRaw.map((b) => {
      const mc = mcMap.get(b.id)
      const regType = (mc?.registrationType as 'telegram' | 'google' | 'standard') || getRegistrationType(b)

      return {
        id: mc ? `mc-${b.id}` : b.id,
        businessId: b.id,
        name: b.name,
        email: b.email,
        phone: b.phone,
        isActive: b.isActive,
        registeredAt: b.createdAt,
        lastLoginAt: mc?.lastLoginAt ?? null,
        lastSeenAt: mc?.lastSeenAt ?? null,
        registrationType: regType,
        businessIdentifier: b.businessIdentifier,
        niche: b.niche,
      }
    })


    const stats = {
      total: await prisma.business.count(),
      active: await prisma.business.count({ where: { isActive: true } }),
      inactive: await prisma.business.count({ where: { isActive: false } }),
      telegram: await prisma.business.count({ where: { telegramId: { not: null } } }),
      google: await prisma.business.count({ where: { googleId: { not: null } } }),
      standard: await prisma.business.count({
        where: { telegramId: null, googleId: null },
      }),
      byNiche: await prisma.business.groupBy({
        by: ['niche'],
        _count: true,
      }),
    }

    return NextResponse.json(jsonSafe({
      businesses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats,
    }))
  } catch (error: any) {
    console.error('Error fetching control center data:', error)
    return NextResponse.json(
      { error: 'Помилка отримання даних' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  // Перевірка доступу
  const auth = verifyAdminToken(request as any)
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { businessId, action, data } = body

    if (!businessId || !action) {
      return NextResponse.json({ error: 'businessId and action required' }, { status: 400 })
    }

    switch (action) {
      case 'activate':
        await prisma.business.update({
          where: { id: businessId },
          data: { isActive: true },
        })
        await prisma.managementCenter.updateMany({
          where: { businessId },
          data: { isActive: true },
        })
        break

      case 'deactivate':
        await prisma.business.update({
          where: { id: businessId },
          data: { isActive: false },
        })
        await prisma.managementCenter.updateMany({
          where: { businessId },
          data: { isActive: false },
        })
        break

      case 'update':
        if (data) {
          await prisma.business.update({
            where: { id: businessId },
            data,
          })
          await prisma.managementCenter.updateMany({
            where: { businessId },
            data,
          })
        }
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating business:', error)
    return NextResponse.json({ error: 'Помилка оновлення' }, { status: 500 })
  }
}


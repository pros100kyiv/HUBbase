import { NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { addDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { withDbRetry } from '@/lib/db-retry'
import { verifyAdminToken } from '@/lib/middleware/admin-auth'
import { jsonSafe } from '@/lib/utils/json'
import type { SubscriptionPlan } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const revalidate = 60

async function getControlCenterStats(): Promise<{
  totalCount: number
  activeCount: number
  inactiveCount: number
  telegramCount: number
  googleCount: number
  standardCount: number
  byNiche: Array<{ niche: string; _count: number }>
}> {
  try {
    return await unstable_cache(
      async () => {
        const [totalCount, activeCount, inactiveCount, telegramCount, googleCount, standardCount, byNiche] = await Promise.all([
          prisma.business.count(),
          prisma.business.count({ where: { isActive: true } }),
          prisma.business.count({ where: { isActive: false } }),
          prisma.business.count({ where: { telegramId: { not: null } } }),
          prisma.business.count({ where: { googleId: { not: null } } }),
          prisma.business.count({ where: { telegramId: null, googleId: null } }),
          prisma.business.groupBy({ by: ['niche'], _count: true }),
        ])
        return { totalCount, activeCount, inactiveCount, telegramCount, googleCount, standardCount, byNiche }
      },
      ['control-center-stats'],
      { revalidate: 60, tags: ['control-center'] }
    )()
  } catch (e) {
    console.error('Control center stats error:', e)
    return {
      totalCount: 0,
      activeCount: 0,
      inactiveCount: 0,
      telegramCount: 0,
      googleCount: 0,
      standardCount: 0,
      byNiche: [],
    }
  }
}

const EMPTY_STATS = {
  total: 0,
  active: 0,
  inactive: 0,
  telegram: 0,
  google: 0,
  standard: 0,
  byNiche: [] as Array<{ niche: string; _count: number }>,
}

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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20') || 20))
    const search = (searchParams.get('search') || '').trim()
    const status = searchParams.get('status')
    const registrationType = searchParams.get('registrationType')
    const niche = searchParams.get('niche')

    const skip = (page - 1) * limit
    const where: Record<string, unknown> = {}

    if (search) {
      const trimmed = search.trim()
      const or: Record<string, unknown>[] = [
        { name: { contains: trimmed, mode: 'insensitive' } },
        { email: { contains: trimmed, mode: 'insensitive' } },
        { phone: { contains: trimmed, mode: 'insensitive' } },
        { businessIdentifier: { contains: trimmed, mode: 'insensitive' } },
      ]
      // Точний пошук за внутрішнім ID (UUID/CUID) — для швидкого доступу
      if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed) || /^[0-9]{5,}$/.test(trimmed)) {
        or.push({ id: trimmed })
        or.push({ businessIdentifier: trimmed })
      }
      where.OR = or
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

    // Select без колонок підписки — щоб працювало в БД, де міграція subscription ще не застосована (P3005 / column missing)
    // withDbRetry: повтор при тимчасовій недоступності БД (наприклад Neon cold start)
    const { businesses, pagination, stats } = await withDbRetry(
      async () => {
        const [businessesRaw, total] = await Promise.all([
          prisma.business.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              isActive: true,
              createdAt: true,
              businessIdentifier: true,
              niche: true,
              telegramId: true,
              googleId: true,
            },
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

        const businessesList = businessesRaw.map((b) => {
          const mc = mcMap.get(b.id)
          const regType = (mc?.registrationType as 'telegram' | 'google' | 'standard') || getRegistrationType(b)
          return {
            id: b.id,
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
            subscriptionPlan: 'FREE',
            trialEndsAt: null,
            subscriptionStatus: null,
            subscriptionCurrentPeriodEnd: null,
          }
        })

        const { totalCount, activeCount, inactiveCount, telegramCount, googleCount, standardCount, byNiche } =
          await getControlCenterStats()

        const statsData = {
          total: totalCount,
          active: activeCount,
          inactive: inactiveCount,
          telegram: telegramCount,
          google: googleCount,
          standard: standardCount,
          byNiche: byNiche || [],
        }

        return {
          businesses: businessesList,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
          },
          stats: statsData,
        }
      },
      { maxAttempts: 3, delayMs: 2500 }
    )

    return NextResponse.json(jsonSafe({ businesses, pagination, stats }))
  } catch (error: unknown) {
    console.error('Control center API error:', error)
    return NextResponse.json(
      jsonSafe({
        businesses: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        stats: EMPTY_STATS,
        error: error instanceof Error ? error.message : 'Помилка завантаження',
      }),
      { status: 200 }
    )
  }
}

export async function PATCH(request: Request) {
  const auth = verifyAdminToken(request as any)
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Невірний формат даних (очікується JSON)' }, { status: 400 })
    }
    const { businessId, action, data } = body

    if (!businessId || !action) {
      return NextResponse.json({ error: 'businessId and action required' }, { status: 400 })
    }

    switch (action) {
      case 'activate':
        await prisma.business.update({ where: { id: businessId }, data: { isActive: true } })
        await prisma.managementCenter.updateMany({ where: { businessId }, data: { isActive: true } })
        break
      case 'deactivate':
        await prisma.business.update({ where: { id: businessId }, data: { isActive: false } })
        await prisma.managementCenter.updateMany({ where: { businessId }, data: { isActive: false } })
        break
      case 'update':
        if (data && typeof data === 'object') {
          // Дозволені поля для оновлення — без telegramWebhookSetAt та інших полів, яких може не бути в БД
          const allowedKeys = ['name', 'email', 'phone', 'isActive', 'address', 'description', 'businessIdentifier', 'niche', 'customNiche', 'settings', 'profileCompleted'] as const
          const safeData: Record<string, unknown> = {}
          for (const key of allowedKeys) {
            if (key in data && data[key] !== undefined) safeData[key] = data[key]
          }
          if (Object.keys(safeData).length > 0) {
            await prisma.business.update({ where: { id: businessId }, data: safeData })
            await prisma.managementCenter.updateMany({ where: { businessId }, data: safeData as any })
          }
        }
        break
      case 'updateSubscription':
        if (data && typeof data === 'object') {
          const updateData: {
            subscriptionPlan?: SubscriptionPlan
            trialEndsAt?: Date | null
            subscriptionStatus?: string | null
          } = {}
          const plan = data.subscriptionPlan
          if (plan === 'FREE' || plan === 'START' || plan === 'BUSINESS' || plan === 'PRO') {
            updateData.subscriptionPlan = plan
          }
          if (typeof data.trialEndsAt === 'string') {
            updateData.trialEndsAt = new Date(data.trialEndsAt)
          } else if (data.trialEndsAt === null) {
            updateData.trialEndsAt = null
          }
          if (typeof data.extendTrialDays === 'number' && data.extendTrialDays > 0) {
            const business = await prisma.business.findUnique({
              where: { id: businessId },
              select: { trialEndsAt: true },
            })
            const from = business?.trialEndsAt && new Date(business.trialEndsAt) > new Date()
              ? new Date(business.trialEndsAt)
              : new Date()
            updateData.trialEndsAt = addDays(from, data.extendTrialDays)
            updateData.subscriptionStatus = 'trial'
          }
          if (data.subscriptionStatus === 'trial' || data.subscriptionStatus === 'active' || data.subscriptionStatus === 'expired' || data.subscriptionStatus === 'cancelled') {
            updateData.subscriptionStatus = data.subscriptionStatus
          }
          if (Object.keys(updateData).length > 0) {
            await prisma.business.update({ where: { id: businessId }, data: updateData })
          }
        }
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Control center PATCH error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Помилка оновлення' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

    if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive') {
      where.isActive = false
    }

    if (registrationType && registrationType !== 'all') {
      where.registrationType = registrationType
    }

    if (niche && niche !== 'all') {
      where.niche = niche
    }

    const [businesses, total] = await Promise.all([
      prisma.managementCenter.findMany({
        where,
        skip,
        take: limit,
        orderBy: { registeredAt: 'desc' },
      }),
      prisma.managementCenter.count({ where }),
    ])

    const stats = {
      total: await prisma.managementCenter.count(),
      active: await prisma.managementCenter.count({ where: { isActive: true } }),
      inactive: await prisma.managementCenter.count({ where: { isActive: false } }),
      telegram: await prisma.managementCenter.count({ where: { telegramId: { not: null } } }),
      google: await prisma.managementCenter.count({ where: { googleId: { not: null } } }),
      standard: await prisma.managementCenter.count({ 
        where: { 
          telegramId: null, 
          googleId: null 
        } 
      }),
      byNiche: await prisma.managementCenter.groupBy({
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
        totalPages: Math.ceil(total / limit),
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
        await prisma.managementCenter.update({
          where: { businessId },
          data: { isActive: true },
        })
        await prisma.business.update({
          where: { id: businessId },
          data: { isActive: true },
        })
        break

      case 'deactivate':
        await prisma.managementCenter.update({
          where: { businessId },
          data: { isActive: false },
        })
        await prisma.business.update({
          where: { id: businessId },
          data: { isActive: false },
        })
        break

      case 'update':
        if (data) {
          await prisma.managementCenter.update({
            where: { businessId },
            data,
          })
          await prisma.business.update({
            where: { id: businessId },
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


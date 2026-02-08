import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
import { verifyAdminToken } from '@/lib/middleware/admin-auth'

export async function GET(request: Request) {
  // Перевірка доступу
  const auth = verifyAdminToken(request as any)
  if (!auth.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') as 'BUSINESS' | 'CLIENT' | 'all' | null
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const skip = (page - 1) * limit

    const where: any = {}

    if (category && category !== 'all') {
      where.category = category
    }

    if (search) {
      where.OR = [
        { phone: { contains: search, mode: 'insensitive' } },
        { businessName: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [phones, total] = await Promise.all([
      prisma.phoneDirectory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.phoneDirectory.count({ where }),
    ])

    const stats = {
      total: await prisma.phoneDirectory.count(),
      business: await prisma.phoneDirectory.count({ where: { category: 'BUSINESS' } }),
      client: await prisma.phoneDirectory.count({ where: { category: 'CLIENT' } }),
      active: await prisma.phoneDirectory.count({ where: { isActive: true } }),
      verified: await prisma.phoneDirectory.count({ where: { isVerified: true } }),
    }

    return NextResponse.json({
      phones,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    })
  } catch (error: any) {
    console.error('Error fetching phone directory:', error)
    return NextResponse.json({ error: 'Помилка отримання даних' }, { status: 500 })
  }
}


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
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const skip = (page - 1) * limit

    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        include: {
          business: {
            select: {
              id: true,
              name: true,
            },
          },
          appointments: {
            where: {
              status: 'Done',
            },
            take: 5,
            orderBy: { startTime: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.client.count({ where }),
    ])

    const stats = {
      total: await prisma.client.count(),
      withAppointments: await prisma.client.count({
        where: {
          appointments: {
            some: {},
          },
        },
      }),
      totalSpent: await prisma.client.aggregate({
        _sum: {
          totalSpent: true,
        },
      }),
    }

    return NextResponse.json(jsonSafe({
      clients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    }))
  } catch (error: any) {
    console.error('Error fetching clients:', error)
    return NextResponse.json({ error: 'Помилка отримання клієнтів' }, { status: 500 })
  }
}


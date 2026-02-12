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
    const actionType = searchParams.get('actionType') // 'client_created' | 'appointment_created' | 'business_created' | 'all'
    const businessId = searchParams.get('businessId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const skip = (page - 1) * limit

    // Використовуємо raw query для admin_control_center
    let whereClause = '1=1'
    const params: any[] = []
    let paramIndex = 1

    if (actionType && actionType !== 'all') {
      whereClause += ` AND action_type = $${paramIndex}`
      params.push(actionType)
      paramIndex++
    }

    if (businessId) {
      whereClause += ` AND business_id = $${paramIndex}`
      params.push(businessId)
      paramIndex++
    }

    if (startDate) {
      whereClause += ` AND created_at >= $${paramIndex}`
      params.push(new Date(startDate))
      paramIndex++
    }

    if (endDate) {
      whereClause += ` AND created_at <= $${paramIndex}`
      params.push(new Date(endDate))
      paramIndex++
    }

    // Формуємо запит з правильними параметрами
    const query = `SELECT * FROM admin_control_center WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`
    const allParams = [...params, limit, skip]
    
    const logs = await prisma.$queryRawUnsafe(query, ...allParams) as any[]

    const countQuery = `SELECT COUNT(*)::int as count FROM admin_control_center WHERE ${whereClause}`
    const totalResult = await prisma.$queryRawUnsafe(countQuery, ...params) as any[]

    const total = Number(totalResult[0]?.count || 0)

    const statsResult = await prisma.$queryRawUnsafe(
      `SELECT action_type, COUNT(*)::int as count FROM admin_control_center GROUP BY action_type`
    ) as any[]

    const totalCountResult = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM admin_control_center`
    ) as any[]

    const stats = {
      total: Number(totalCountResult[0]?.count || 0),
      byType: statsResult,
    }

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    })
  } catch (error: any) {
    console.error('Error fetching activity log:', error)
    // Якщо таблиця admin_control_center ще не створена — повертаємо порожній результат, щоб вкладка не ламалась
    return NextResponse.json({
      logs: [],
      pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      stats: { total: 0, byType: [] },
    })
  }
}


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
    const period = searchParams.get('period') || 'month'

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

    // Отримуємо всі платежі за період (Payment.status: succeeded = успішна оплата)
    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: startDate },
        status: 'succeeded',
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    const totalRevenueRaw = payments.reduce((sum, p) => sum + Number(p.amount) / 100, 0)
    const totalRevenue = Math.round(totalRevenueRaw * 100) / 100

    // Топ бізнеси за доходами (суми з точністю до копійки)
    const topByRevenue = payments.reduce((acc: any, payment) => {
      const businessId = payment.businessId
      if (!acc[businessId]) {
        acc[businessId] = {
          businessId,
          businessName: payment.business?.name || 'Невідомий',
          revenue: 0,
          payments: 0,
        }
      }
      acc[businessId].revenue += Number(payment.amount) / 100
      acc[businessId].payments += 1
      return acc
    }, {})

    const topBusinesses = Object.values(topByRevenue)
      .map((b: any) => ({ ...b, revenue: Math.round(b.revenue * 100) / 100 }))
      .sort((a: any, b: any) => b.revenue - a.revenue)
      .slice(0, 10)

    // Статистика по провайдерах платежів (у try — якщо колонки БД відрізняються, не ламаємо весь запит)
    let byProvider: Array<{ paymentProvider: string | null; _count: number }> = []
    try {
      byProvider = await prisma.business.groupBy({
        by: ['paymentProvider'],
        where: {
          paymentEnabled: true,
          paymentProvider: { not: null },
        },
        _count: true,
      })
    } catch (e) {
      console.warn('Finances byProvider groupBy skipped:', e)
    }

    return NextResponse.json({
      totalRevenue,
      totalPayments: payments.length,
      topBusinesses,
      byProvider,
      period,
    })
  } catch (error: any) {
    console.error('Error fetching finances:', error)
    return NextResponse.json({ error: 'Помилка отримання фінансових даних' }, { status: 500 })
  }
}


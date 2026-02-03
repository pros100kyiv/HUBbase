import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
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

    // Отримуємо всі платежі за період
    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: startDate },
        status: 'completed',
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

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount) / 100, 0)

    // Топ бізнеси за доходами
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
      .sort((a: any, b: any) => b.revenue - a.revenue)
      .slice(0, 10)

    // Статистика по провайдерах платежів
    const byProvider = await prisma.business.groupBy({
      by: ['paymentProvider'],
      where: {
        paymentEnabled: true,
        paymentProvider: { not: null },
      },
      _count: true,
    })

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


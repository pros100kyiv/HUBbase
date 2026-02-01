import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subMonths, startOfMonth, endOfMonth } from 'date-fns'

// Customer Lifetime Value (LTV) розрахунок
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const period = searchParams.get('period') || 'all' // all, 3months, 6months, 12months

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Визначаємо період
    let startDate: Date | null = null
    if (period !== 'all') {
      const months = period === '3months' ? 3 : period === '6months' ? 6 : 12
      startDate = startOfMonth(subMonths(new Date(), months))
    }

    // Отримуємо всіх клієнтів з їх записами
    const where: any = { businessId }
    if (startDate) {
      where.appointments = {
        some: {
          startTime: {
            gte: startDate,
          },
        },
      }
    }

    const clients = await prisma.client.findMany({
      where,
      include: {
        appointments: {
          where: startDate
            ? {
                startTime: {
                  gte: startDate,
                },
              }
            : undefined,
          include: {
            master: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    // Розраховуємо LTV для кожного клієнта
    const ltvData = clients.map((client) => {
      const appointments = client.appointments.filter((apt) => apt.status === 'Done')
      const totalRevenue = appointments.reduce((sum, apt) => {
        const price = apt.customPrice || 0
        // Якщо немає customPrice, розраховуємо з послуг
        if (!price && apt.services) {
          try {
            const serviceIds = JSON.parse(apt.services)
            // Тут потрібно було б отримати ціни послуг, але для спрощення використовуємо customPrice
          } catch (e) {
            // Ignore
          }
        }
        return sum + (price || 0)
      }, 0)

      const averageOrderValue = appointments.length > 0 ? totalRevenue / appointments.length : 0
      const purchaseFrequency = appointments.length
      const customerLifespan = client.firstAppointmentDate && client.lastAppointmentDate
        ? Math.max(1, Math.ceil((client.lastAppointmentDate.getTime() - client.firstAppointmentDate.getTime()) / (1000 * 60 * 60 * 24 * 30))) // в місяцях
        : 1

      const ltv = averageOrderValue * purchaseFrequency * customerLifespan

      return {
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        totalAppointments: appointments.length,
        totalRevenue,
        averageOrderValue,
        purchaseFrequency,
        customerLifespan,
        ltv,
        firstAppointmentDate: client.firstAppointmentDate,
        lastAppointmentDate: client.lastAppointmentDate,
      }
    })

    // Загальна статистика
    const totalLTV = ltvData.reduce((sum, client) => sum + client.ltv, 0)
    const averageLTV = ltvData.length > 0 ? totalLTV / ltvData.length : 0
    const medianLTV = ltvData.length > 0
      ? [...ltvData].sort((a, b) => a.ltv - b.ltv)[Math.floor(ltvData.length / 2)].ltv
      : 0

    return NextResponse.json({
      period,
      totalClients: clients.length,
      totalLTV,
      averageLTV,
      medianLTV,
      clients: ltvData.sort((a, b) => b.ltv - a.ltv), // Сортуємо за LTV
    })
  } catch (error) {
    console.error('Error calculating LTV:', error)
    return NextResponse.json(
      {
        error: 'Failed to calculate LTV',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}


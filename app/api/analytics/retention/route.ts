import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subMonths, startOfMonth, endOfMonth, differenceInMonths } from 'date-fns'

// Retention Rate розрахунок
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const period = searchParams.get('period') || 'month' // month, quarter, year

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Визначаємо період для аналізу
    const now = new Date()
    let startDate: Date
    let endDate = endOfMonth(now)

    if (period === 'month') {
      startDate = startOfMonth(subMonths(now, 1))
    } else if (period === 'quarter') {
      startDate = startOfMonth(subMonths(now, 3))
    } else {
      startDate = startOfMonth(subMonths(now, 12))
    }

    // Отримуємо клієнтів, які мали записи до початку періоду (базова когорта)
    const baseCohort = await prisma.client.findMany({
      where: {
        businessId,
        firstAppointmentDate: {
          lt: startDate,
        },
        isActive: true,
      },
      include: {
        appointments: {
          where: {
            startTime: {
              gte: startDate,
              lte: endDate,
            },
            status: {
              in: ['Confirmed', 'Done'],
            },
          },
        },
      },
    })

    // Отримуємо нових клієнтів за період
    const newClients = await prisma.client.findMany({
      where: {
        businessId,
        firstAppointmentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        appointments: {
          where: {
            status: {
              in: ['Confirmed', 'Done'],
            },
          },
        },
      },
    })

    // Розраховуємо retention rate для базової когорти
    const totalBaseClients = baseCohort.length
    const activeClients = baseCohort.filter((client) => client.appointments.length > 0).length
    const retentionRate = totalBaseClients > 0 ? (activeClients / totalBaseClients) * 100 : 0

    // Розраховуємо retention по місяцях для деталізації
    const monthlyRetention: Array<{
      month: string
      cohortSize: number
      activeClients: number
      retentionRate: number
    }> = []

    const monthsToAnalyze = period === 'month' ? 1 : period === 'quarter' ? 3 : 12

    for (let i = 0; i < monthsToAnalyze; i++) {
      const monthStart = startOfMonth(subMonths(now, monthsToAnalyze - i - 1))
      const monthEnd = endOfMonth(monthStart)

      // Клієнти, які почали до початку місяця
      const cohortClients = await prisma.client.findMany({
        where: {
          businessId,
          firstAppointmentDate: {
            lt: monthStart,
          },
        },
        include: {
          appointments: {
            where: {
              startTime: {
                gte: monthStart,
                lte: monthEnd,
              },
              status: {
                in: ['Confirmed', 'Done'],
              },
            },
          },
        },
      })

      const cohortSize = cohortClients.length
      const activeInMonth = cohortClients.filter((c) => c.appointments.length > 0).length
      const monthRetention = cohortSize > 0 ? (activeInMonth / cohortSize) * 100 : 0

      monthlyRetention.push({
        month: monthStart.toISOString().split('T')[0],
        cohortSize,
        activeClients: activeInMonth,
        retentionRate: monthRetention,
      })
    }

    // Розраховуємо churn rate (коефіцієнт відтоку)
    const churnRate = 100 - retentionRate

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      baseCohort: {
        totalClients: totalBaseClients,
        activeClients,
        retentionRate: Math.round(retentionRate * 100) / 100,
        churnRate: Math.round(churnRate * 100) / 100,
      },
      newClients: {
        total: newClients.length,
        withAppointments: newClients.filter((c) => c.appointments.length > 0).length,
      },
      monthlyRetention,
    })
  } catch (error) {
    console.error('Error calculating retention rate:', error)
    return NextResponse.json(
      {
        error: 'Failed to calculate retention rate',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}


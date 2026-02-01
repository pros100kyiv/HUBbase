import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, subMonths, differenceInHours } from 'date-fns'

// Метрики використання співробітників
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const masterId = searchParams.get('masterId') // Опціонально для конкретного майстра
    const period = searchParams.get('period') || 'month' // day, week, month, quarter, year

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Визначаємо період
    const now = new Date()
    let startDate: Date
    let endDate = endOfMonth(now)

    if (period === 'day') {
      startDate = new Date(now)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(now)
      endDate.setHours(23, 59, 59, 999)
    } else if (period === 'week') {
      startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 7)
    } else if (period === 'month') {
      startDate = startOfMonth(now)
    } else if (period === 'quarter') {
      startDate = startOfMonth(subMonths(now, 3))
    } else {
      startDate = startOfMonth(subMonths(now, 12))
    }

    // Отримуємо майстрів
    const where: any = { businessId, isActive: true }
    if (masterId) {
      where.id = masterId
    }

    const masters = await prisma.master.findMany({
      where,
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

    // Розраховуємо метрики для кожного майстра
    const utilizationData = masters.map((master) => {
      const appointments = master.appointments

      // Розраховуємо загальний час роботи
      const totalWorkedHours = appointments.reduce((sum, apt) => {
        const duration = differenceInHours(apt.endTime, apt.startTime)
        return sum + Math.max(0, duration)
      }, 0)

      // Розраховуємо загальний дохід
      const totalRevenue = appointments.reduce((sum, apt) => {
        return sum + (apt.customPrice || 0)
      }, 0)

      // Розраховуємо доступні години (з workingHours)
      let availableHours = 0
      try {
        if (master.workingHours) {
          const workingHours = JSON.parse(master.workingHours)
          const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          const workingDaysPerWeek = Object.values(workingHours).filter((day: any) => day?.enabled).length
          const weeksInPeriod = daysInPeriod / 7
          const hoursPerDay = 8 // За замовчуванням, можна розрахувати з workingHours
          availableHours = workingDaysPerWeek * weeksInPeriod * hoursPerDay
        } else {
          // Якщо немає workingHours, використовуємо стандартні 8 годин на день
          const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          availableHours = daysInPeriod * 8
        }
      } catch (e) {
        // Якщо помилка парсингу, використовуємо стандартні значення
        const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        availableHours = daysInPeriod * 8
      }

      // Коефіцієнт використання
      const utilizationRate = availableHours > 0 ? (totalWorkedHours / availableHours) * 100 : 0

      // Середній рейтинг
      const averageRating = master.rating || 0

      // Середній дохід на годину
      const revenuePerHour = totalWorkedHours > 0 ? totalRevenue / totalWorkedHours : 0

      // Середній дохід на запис
      const revenuePerAppointment = appointments.length > 0 ? totalRevenue / appointments.length : 0

      return {
        masterId: master.id,
        masterName: master.name,
        photo: master.photo,
        totalAppointments: appointments.length,
        totalWorkedHours: Math.round(totalWorkedHours * 100) / 100,
        availableHours: Math.round(availableHours * 100) / 100,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
        totalRevenue,
        averageRating: Math.round(averageRating * 100) / 100,
        revenuePerHour: Math.round(revenuePerHour),
        revenuePerAppointment: Math.round(revenuePerAppointment),
        appointments: appointments.map((apt) => ({
          id: apt.id,
          startTime: apt.startTime,
          endTime: apt.endTime,
          revenue: apt.customPrice || 0,
          status: apt.status,
        })),
      }
    })

    // Загальна статистика
    const totalMasters = utilizationData.length
    const totalAppointments = utilizationData.reduce((sum, m) => sum + m.totalAppointments, 0)
    const totalRevenue = utilizationData.reduce((sum, m) => sum + m.totalRevenue, 0)
    const averageUtilization = totalMasters > 0
      ? utilizationData.reduce((sum, m) => sum + m.utilizationRate, 0) / totalMasters
      : 0

    return NextResponse.json({
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      summary: {
        totalMasters,
        totalAppointments,
        totalRevenue,
        averageUtilization: Math.round(averageUtilization * 100) / 100,
      },
      masters: utilizationData.sort((a, b) => b.utilizationRate - a.utilizationRate),
    })
  } catch (error) {
    console.error('Error calculating employee utilization:', error)
    return NextResponse.json(
      {
        error: 'Failed to calculate employee utilization',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}


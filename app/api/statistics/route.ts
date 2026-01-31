import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const period = searchParams.get('period') || 'month' // month, week, day

    if (!businessId) {
      return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })
    }

    const now = new Date()
    let startDate: Date
    let endDate: Date

    switch (period) {
      case 'day':
        startDate = startOfDay(now)
        endDate = endOfDay(now)
        break
      case 'week':
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 7)
        endDate = now
        break
      case 'month':
      default:
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        break
    }

    // Загальна статистика
    const totalAppointments = await prisma.appointment.count({
      where: {
        businessId,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
    })

    const confirmedAppointments = await prisma.appointment.count({
      where: {
        businessId,
        status: 'Confirmed',
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
    })

    const completedAppointments = await prisma.appointment.count({
      where: {
        businessId,
        status: 'Done',
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
    })

    const cancelledAppointments = await prisma.appointment.count({
      where: {
        businessId,
        status: 'Cancelled',
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
    })

    // Статистика по послугах
    const appointments = await prisma.appointment.findMany({
      where: {
        businessId,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          not: 'Cancelled',
        },
      },
      select: {
        services: true,
      },
    })

    const serviceStats: Record<string, number> = {}
    appointments.forEach((apt) => {
      try {
        const serviceIds = JSON.parse(apt.services) as string[]
        serviceIds.forEach((serviceId) => {
          serviceStats[serviceId] = (serviceStats[serviceId] || 0) + 1
        })
      } catch (e) {
        // Ignore parse errors
      }
    })

    // Статистика по майстрах
    const masterStats = await prisma.appointment.groupBy({
      by: ['masterId'],
      where: {
        businessId,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          not: 'Cancelled',
        },
      },
      _count: {
        id: true,
      },
    })

    // Унікальні клієнти
    const uniqueClients = await prisma.appointment.findMany({
      where: {
        businessId,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        clientPhone: true,
      },
      distinct: ['clientPhone'],
    })

    // Загальний дохід (сума послуг)
    const allAppointments = await prisma.appointment.findMany({
      where: {
        businessId,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          not: 'Cancelled',
        },
      },
      select: {
        services: true,
      },
    })

    let totalRevenue = 0
    const services = await prisma.service.findMany({
      where: { businessId },
    })

    allAppointments.forEach((apt) => {
      try {
        const serviceIds = JSON.parse(apt.services) as string[]
        serviceIds.forEach((serviceId) => {
          const service = services.find((s) => s.id === serviceId)
          if (service) {
            totalRevenue += service.price
          }
        })
      } catch (e) {
        // Ignore parse errors
      }
    })

    return NextResponse.json({
      period,
      totalAppointments,
      confirmedAppointments,
      completedAppointments,
      cancelledAppointments,
      uniqueClients: uniqueClients.length,
      totalRevenue,
      serviceStats,
      masterStats: masterStats.map((stat) => ({
        masterId: stat.masterId,
        count: stat._count.id,
      })),
    })
  } catch (error) {
    console.error('Error fetching statistics:', error)
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 })
  }
}





import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, subDays, subMonths } from 'date-fns'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const period = searchParams.get('period') || 'month'

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    const now = new Date()
    let startDate: Date, endDate: Date

    switch (period) {
      case 'day':
        startDate = startOfDay(now)
        endDate = endOfDay(now)
        break
      case 'week':
        startDate = startOfDay(subDays(now, 7))
        endDate = endOfDay(now)
        break
      case 'month':
        startDate = startOfDay(subMonths(now, 1))
        endDate = endOfDay(now)
        break
      default:
        startDate = startOfDay(subMonths(now, 1))
        endDate = endOfDay(now)
    }

    const [appointments, clients, services, masters] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          businessId,
          startTime: { gte: startDate, lte: endDate }
        },
        select: {
          status: true,
          services: true,
          customPrice: true,
          clientId: true,
        },
      }),
      prisma.client.findMany({
        where: { businessId }
      }),
      prisma.service.findMany({ where: { businessId } }),
      prisma.master.findMany({ where: { businessId } })
    ])

    const totalAppointments = appointments.length
    const confirmedAppointments = appointments.filter(
      a => a.status === 'Confirmed'
    ).length
    const completedAppointments = appointments.filter(a => a.status === 'Done').length
    const cancelledAppointments = appointments.filter(a => a.status === 'Cancelled').length

    const uniqueClientIds = new Set(appointments.map(a => a.clientId).filter(Boolean))
    const uniqueClients = uniqueClientIds.size

    const totalRevenue = appointments
      .filter(a => a.status === 'Done')
      .reduce((sum, apt) => {
        const servicesList = JSON.parse(apt.services || '[]') as string[]
        const total = servicesList.reduce((s: number, serviceId: string) => {
          const service = services.find(sv => sv.id === serviceId)
          return s + (service?.price || 0)
        }, 0)
        return sum + (apt.customPrice ? Number(apt.customPrice) / 100 : total)
      }, 0)

    const serviceStats: Record<string, number> = {}
    for (const apt of appointments.filter(a => a.status !== 'Cancelled')) {
      try {
        const servicesList = JSON.parse(apt.services || '[]') as string[]
        for (const sid of servicesList) {
          serviceStats[sid] = (serviceStats[sid] || 0) + 1
        }
      } catch {
        // skip invalid services
      }
    }

    const masterStats = masters.map(m => ({
      masterId: m.id,
      count: appointments.filter(a => a.masterId === m.id && a.status !== 'Cancelled').length
    }))

    // Оновлюємо дату останнього входу в Центрі управління (як heartbeat)
    try {
      const { updateLastLogin } = await import('@/lib/services/management-center')
      await updateLastLogin(businessId)
    } catch (e) {
      // ignore update errors to not block statistics
    }

    return NextResponse.json({
      period,
      totalAppointments,
      confirmedAppointments,
      completedAppointments,
      cancelledAppointments,
      uniqueClients,
      totalRevenue: Math.round(totalRevenue),
      serviceStats,
      masterStats
    })
  } catch (error) {
    console.error('Statistics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}

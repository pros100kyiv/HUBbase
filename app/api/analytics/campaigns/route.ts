import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, startOfDay, endOfDay, subDays, subMonths } from 'date-fns'

interface CampaignAnalysis {
  campaigns: Array<{
    campaignId: string
    source: string
    totalAppointments: number
    completedAppointments: number
    confirmedAppointments: number
    revenue: number // Тільки з завершених
    forecastedRevenue: number // З підтверджених
    conversionRate: number // % завершених від загальної кількості
    averageOrderValue: number
    cost?: number // Вартість кампанії (якщо додано)
    roi?: number // Return on Investment (якщо є cost)
  }>
  totalRevenue: number
  totalForecastedRevenue: number
  bestPerformingCampaign: {
    campaignId: string
    source: string
    revenue: number
  } | null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const period = searchParams.get('period') || 'month'

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

    // Завантажуємо всі послуги
    const services = await prisma.service.findMany({
      where: { businessId },
      select: { id: true, price: true },
    })
    const serviceMap = new Map(services.map(s => [s.id, s]))

    // Завантажуємо всі візити з джерелами
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
        id: true,
        status: true,
        services: true,
        customPrice: true,
        source: true,
        campaignId: true,
      },
    })

    // Групуємо по кампаніях/джерелах
    const campaignMap = new Map<string, {
      source: string
      appointments: typeof allAppointments
    }>()

    allAppointments.forEach((apt) => {
      const key = apt.campaignId || apt.source || 'unknown'
      const existing = campaignMap.get(key)
      if (existing) {
        existing.appointments.push(apt)
      } else {
        campaignMap.set(key, {
          source: apt.source || apt.campaignId || 'Невідоме джерело',
          appointments: [apt],
        })
      }
    })

    // Розраховуємо метрики для кожної кампанії
    const campaigns = Array.from(campaignMap.entries()).map(([campaignId, data]) => {
      const appointments = data.appointments
      const completed = appointments.filter(apt => apt.status === 'Done')
      const confirmed = appointments.filter(apt => apt.status === 'Confirmed')

      let revenue = 0
      completed.forEach((apt) => {
        if (apt.customPrice !== null && apt.customPrice !== undefined) {
          revenue += apt.customPrice
        } else {
          try {
            const parsed = JSON.parse(apt.services)
            const serviceIds = Array.isArray(parsed) ? parsed : (parsed.serviceIds || [])
            serviceIds.forEach((serviceId: string) => {
              const service = serviceMap.get(serviceId)
              if (service) revenue += service.price
            })
          } catch (e) {}
        }
      })

      let forecastedRevenue = 0
      confirmed.forEach((apt) => {
        if (apt.customPrice !== null && apt.customPrice !== undefined) {
          forecastedRevenue += apt.customPrice
        } else {
          try {
            const parsed = JSON.parse(apt.services)
            const serviceIds = Array.isArray(parsed) ? parsed : (parsed.serviceIds || [])
            serviceIds.forEach((serviceId: string) => {
              const service = serviceMap.get(serviceId)
              if (service) forecastedRevenue += service.price
            })
          } catch (e) {}
        }
      })

      const conversionRate = appointments.length > 0
        ? (completed.length / appointments.length) * 100
        : 0

      const averageOrderValue = completed.length > 0
        ? Math.round(revenue / completed.length)
        : 0

      return {
        campaignId,
        source: data.source,
        totalAppointments: appointments.length,
        completedAppointments: completed.length,
        confirmedAppointments: confirmed.length,
        revenue,
        forecastedRevenue,
        conversionRate: Math.round(conversionRate * 100) / 100,
        averageOrderValue,
      }
    }).sort((a, b) => b.revenue - a.revenue)

    const totalRevenue = campaigns.reduce((sum, c) => sum + c.revenue, 0)
    const totalForecastedRevenue = campaigns.reduce((sum, c) => sum + c.forecastedRevenue, 0)

    const bestPerformingCampaign = campaigns.length > 0
      ? {
          campaignId: campaigns[0].campaignId,
          source: campaigns[0].source,
          revenue: campaigns[0].revenue,
        }
      : null

    const analysis: CampaignAnalysis = {
      campaigns,
      totalRevenue,
      totalForecastedRevenue,
      bestPerformingCampaign,
    }

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Error calculating campaign analysis:', error)
    return NextResponse.json(
      { error: 'Failed to calculate campaign analysis', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


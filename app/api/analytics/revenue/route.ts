import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, startOfDay, endOfDay, subDays, subMonths } from 'date-fns'

interface RevenueAnalysis {
  currentRevenue: number // Поточний прибуток (тільки завершені візити)
  forecastedRevenue: number // Прогнозований прибуток (підтверджені візити)
  revenueByService: Array<{
    serviceId: string
    serviceName: string
    category?: string
    revenue: number
    count: number
    margin?: number // Маржинальність (якщо додано в майбутньому)
    averagePrice: number
  }>
  revenueByPeriod: Array<{
    date: string
    currentRevenue: number
    forecastedRevenue: number
  }>
  trends: {
    currentRevenueChange: number // Зміна поточного прибутку (%)
    forecastedRevenueChange: number // Зміна прогнозованого прибутку (%)
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const period = searchParams.get('period') || 'month' // day, week, month, quarter, year

    if (!businessId) {
      return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })
    }

    const now = new Date()
    let startDate: Date
    let endDate: Date
    let previousStartDate: Date
    let previousEndDate: Date

    switch (period) {
      case 'day':
        startDate = startOfDay(now)
        endDate = endOfDay(now)
        previousStartDate = startOfDay(subDays(now, 1))
        previousEndDate = endOfDay(subDays(now, 1))
        break
      case 'week':
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 7)
        endDate = now
        previousStartDate = new Date(startDate)
        previousStartDate.setDate(previousStartDate.getDate() - 7)
        previousEndDate = new Date(startDate)
        break
      case 'month':
      default:
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        previousStartDate = startOfMonth(subMonths(now, 1))
        previousEndDate = endOfMonth(subMonths(now, 1))
        break
    }

    // Завантажуємо всі послуги для мапінгу
    const services = await prisma.service.findMany({
      where: { businessId },
      select: {
        id: true,
        name: true,
        price: true,
        category: true,
      },
    })
    const serviceMap = new Map(services.map(s => [s.id, s]))

    // 1. ПОТОЧНИЙ ПРИБУТОК - тільки завершені візити (status = 'Done')
    const completedAppointments = await prisma.appointment.findMany({
      where: {
        businessId,
        status: 'Done',
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        services: true,
        customPrice: true,
        startTime: true,
      },
    })

    let currentRevenue = 0
    const serviceRevenueMap = new Map<string, { revenue: number; count: number }>()

    completedAppointments.forEach((apt) => {
      let appointmentRevenue = 0

      // Якщо є customPrice, використовуємо його
      if (apt.customPrice !== null && apt.customPrice !== undefined) {
        appointmentRevenue = apt.customPrice
      } else {
        // Інакше рахуємо з послуг
        try {
          const parsed = JSON.parse(apt.services)
          const serviceIds = Array.isArray(parsed) ? parsed : (parsed.serviceIds || [])
          
          serviceIds.forEach((serviceId: string) => {
            const service = serviceMap.get(serviceId)
            if (service) {
              appointmentRevenue += service.price
            }
          })
        } catch (e) {
          console.error('Error parsing services:', e)
        }
      }

      currentRevenue += appointmentRevenue

      // Аналітика по послугах
      try {
        const parsed = JSON.parse(apt.services)
        const serviceIds = Array.isArray(parsed) ? parsed : (parsed.serviceIds || [])
        
        serviceIds.forEach((serviceId: string) => {
          const service = serviceMap.get(serviceId)
          if (service) {
            const existing = serviceRevenueMap.get(serviceId)
            const servicePrice = apt.customPrice !== null && apt.customPrice !== undefined
              ? Math.round(apt.customPrice / serviceIds.length) // Розподіляємо customPrice між послугами
              : service.price

            if (existing) {
              existing.revenue += servicePrice
              existing.count += 1
            } else {
              serviceRevenueMap.set(serviceId, { revenue: servicePrice, count: 1 })
            }
          }
        })
      } catch (e) {
        // Ignore
      }
    })

    // 2. ПРОГНОЗОВАНИЙ ПРИБУТОК - підтверджені візити (status = 'Confirmed')
    const confirmedAppointments = await prisma.appointment.findMany({
      where: {
        businessId,
        status: 'Confirmed',
        startTime: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        services: true,
        customPrice: true,
        startTime: true,
      },
    })

    let forecastedRevenue = 0
    const forecastedServiceRevenueMap = new Map<string, { revenue: number; count: number }>()

    confirmedAppointments.forEach((apt) => {
      let appointmentRevenue = 0

      if (apt.customPrice !== null && apt.customPrice !== undefined) {
        appointmentRevenue = apt.customPrice
      } else {
        try {
          const parsed = JSON.parse(apt.services)
          const serviceIds = Array.isArray(parsed) ? parsed : (parsed.serviceIds || [])
          
          serviceIds.forEach((serviceId: string) => {
            const service = serviceMap.get(serviceId)
            if (service) {
              appointmentRevenue += service.price
            }
          })
        } catch (e) {
          // Ignore
        }
      }

      forecastedRevenue += appointmentRevenue

      // Аналітика по послугах для прогнозу
      try {
        const parsed = JSON.parse(apt.services)
        const serviceIds = Array.isArray(parsed) ? parsed : (parsed.serviceIds || [])
        
        serviceIds.forEach((serviceId: string) => {
          const service = serviceMap.get(serviceId)
          if (service) {
            const existing = forecastedServiceRevenueMap.get(serviceId)
            const servicePrice = apt.customPrice !== null && apt.customPrice !== undefined
              ? Math.round(apt.customPrice / serviceIds.length)
              : service.price

            if (existing) {
              existing.revenue += servicePrice
              existing.count += 1
            } else {
              forecastedServiceRevenueMap.set(serviceId, { revenue: servicePrice, count: 1 })
            }
          }
        })
      } catch (e) {
        // Ignore
      }
    })

    // 3. АНАЛІТИКА ПО ПОСЛУГАХ
    const revenueByService = Array.from(serviceRevenueMap.entries()).map(([serviceId, data]) => {
      const service = serviceMap.get(serviceId)
      return {
        serviceId,
        serviceName: service?.name || 'Невідома послуга',
        category: service?.category || undefined,
        revenue: data.revenue,
        count: data.count,
        averagePrice: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
      }
    }).sort((a, b) => b.revenue - a.revenue)

    // 4. ТРЕНДИ - порівняння з попереднім періодом
    const previousCompleted = await prisma.appointment.findMany({
      where: {
        businessId,
        status: 'Done',
        startTime: {
          gte: previousStartDate,
          lte: previousEndDate,
        },
      },
      select: {
        services: true,
        customPrice: true,
      },
    })

    let previousCurrentRevenue = 0
    previousCompleted.forEach((apt) => {
      if (apt.customPrice !== null && apt.customPrice !== undefined) {
        previousCurrentRevenue += apt.customPrice
      } else {
        try {
          const parsed = JSON.parse(apt.services)
          const serviceIds = Array.isArray(parsed) ? parsed : (parsed.serviceIds || [])
          serviceIds.forEach((serviceId: string) => {
            const service = serviceMap.get(serviceId)
            if (service) {
              previousCurrentRevenue += service.price
            }
          })
        } catch (e) {
          // Ignore
        }
      }
    })

    const previousConfirmed = await prisma.appointment.findMany({
      where: {
        businessId,
        status: 'Confirmed',
        startTime: {
          gte: previousStartDate,
          lte: previousEndDate,
        },
      },
      select: {
        services: true,
        customPrice: true,
      },
    })

    let previousForecastedRevenue = 0
    previousConfirmed.forEach((apt) => {
      if (apt.customPrice !== null && apt.customPrice !== undefined) {
        previousForecastedRevenue += apt.customPrice
      } else {
        try {
          const parsed = JSON.parse(apt.services)
          const serviceIds = Array.isArray(parsed) ? parsed : (parsed.serviceIds || [])
          serviceIds.forEach((serviceId: string) => {
            const service = serviceMap.get(serviceId)
            if (service) {
              previousForecastedRevenue += service.price
            }
          })
        } catch (e) {
          // Ignore
        }
      }
    })

    const currentRevenueChange = previousCurrentRevenue > 0
      ? ((currentRevenue - previousCurrentRevenue) / previousCurrentRevenue) * 100
      : 0

    const forecastedRevenueChange = previousForecastedRevenue > 0
      ? ((forecastedRevenue - previousForecastedRevenue) / previousForecastedRevenue) * 100
      : 0

    // 5. РОЗБИТТЯ ПО ПЕРІОДАХ (для графіків)
    const revenueByPeriod: Array<{ date: string; currentRevenue: number; forecastedRevenue: number }> = []
    
    if (period === 'month') {
      // Розбиваємо місяць на тижні
      const weeks: Date[][] = []
      let currentWeekStart = new Date(startDate)
      
      while (currentWeekStart <= endDate) {
        const weekEnd = new Date(currentWeekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)
        if (weekEnd > endDate) weekEnd.setTime(endDate.getTime())
        weeks.push([new Date(currentWeekStart), weekEnd])
        currentWeekStart = new Date(weekEnd)
        currentWeekStart.setDate(currentWeekStart.getDate() + 1)
      }

      for (const [weekStart, weekEnd] of weeks) {
        const weekCompleted = completedAppointments.filter(
          apt => apt.startTime >= weekStart && apt.startTime <= weekEnd
        )
        const weekConfirmed = confirmedAppointments.filter(
          apt => apt.startTime >= weekStart && apt.startTime <= weekEnd
        )

        let weekCurrent = 0
        weekCompleted.forEach(apt => {
          if (apt.customPrice !== null && apt.customPrice !== undefined) {
            weekCurrent += apt.customPrice
          } else {
            try {
              const parsed = JSON.parse(apt.services)
              const serviceIds = Array.isArray(parsed) ? parsed : (parsed.serviceIds || [])
              serviceIds.forEach((serviceId: string) => {
                const service = serviceMap.get(serviceId)
                if (service) weekCurrent += service.price
              })
            } catch (e) {}
          }
        })

        let weekForecasted = 0
        weekConfirmed.forEach(apt => {
          if (apt.customPrice !== null && apt.customPrice !== undefined) {
            weekForecasted += apt.customPrice
          } else {
            try {
              const parsed = JSON.parse(apt.services)
              const serviceIds = Array.isArray(parsed) ? parsed : (parsed.serviceIds || [])
              serviceIds.forEach((serviceId: string) => {
                const service = serviceMap.get(serviceId)
                if (service) weekForecasted += service.price
              })
            } catch (e) {}
          }
        })

        revenueByPeriod.push({
          date: weekStart.toISOString().split('T')[0],
          currentRevenue: weekCurrent,
          forecastedRevenue: weekForecasted,
        })
      }
    }

    const analysis: RevenueAnalysis = {
      currentRevenue,
      forecastedRevenue,
      revenueByService,
      revenueByPeriod,
      trends: {
        currentRevenueChange: Math.round(currentRevenueChange * 100) / 100,
        forecastedRevenueChange: Math.round(forecastedRevenueChange * 100) / 100,
      },
    }

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Error calculating revenue analysis:', error)
    return NextResponse.json(
      { error: 'Failed to calculate revenue analysis', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


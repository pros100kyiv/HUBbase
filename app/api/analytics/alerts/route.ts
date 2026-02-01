import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, subMonths } from 'date-fns'

interface RevenueAlert {
  type: 'warning' | 'critical' | 'info'
  message: string
  value: number
  previousValue: number
  change: number // % зміни
  threshold?: number // Поріг для сповіщення
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    if (!businessId) {
      return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })
    }

    const alerts: RevenueAlert[] = []
    const now = new Date()
    const currentStart = startOfMonth(now)
    const currentEnd = endOfMonth(now)
    const previousStart = startOfMonth(subMonths(now, 1))
    const previousEnd = endOfMonth(subMonths(now, 1))

    // Завантажуємо послуги
    const services = await prisma.service.findMany({
      where: { businessId },
      select: { id: true, price: true },
    })
    const serviceMap = new Map(services.map(s => [s.id, s]))

    // Розраховуємо поточний прибуток
    const currentCompleted = await prisma.appointment.findMany({
      where: {
        businessId,
        status: 'Done',
        startTime: { gte: currentStart, lte: currentEnd },
      },
      select: { services: true, customPrice: true },
    })

    let currentRevenue = 0
    currentCompleted.forEach((apt) => {
      if (apt.customPrice !== null && apt.customPrice !== undefined) {
        currentRevenue += apt.customPrice
      } else {
        try {
          const parsed = JSON.parse(apt.services)
          const serviceIds = Array.isArray(parsed) ? parsed : (parsed.serviceIds || [])
          serviceIds.forEach((serviceId: string) => {
            const service = serviceMap.get(serviceId)
            if (service) currentRevenue += service.price
          })
        } catch (e) {}
      }
    })

    // Розраховуємо попередній прибуток
    const previousCompleted = await prisma.appointment.findMany({
      where: {
        businessId,
        status: 'Done',
        startTime: { gte: previousStart, lte: previousEnd },
      },
      select: { services: true, customPrice: true },
    })

    let previousRevenue = 0
    previousCompleted.forEach((apt) => {
      if (apt.customPrice !== null && apt.customPrice !== undefined) {
        previousRevenue += apt.customPrice
      } else {
        try {
          const parsed = JSON.parse(apt.services)
          const serviceIds = Array.isArray(parsed) ? parsed : (parsed.serviceIds || [])
          serviceIds.forEach((serviceId: string) => {
            const service = serviceMap.get(serviceId)
            if (service) previousRevenue += service.price
          })
        } catch (e) {}
      }
    })

    // Перевірка зміни прибутку
    if (previousRevenue > 0) {
      const change = ((currentRevenue - previousRevenue) / previousRevenue) * 100
      
      if (change < -20) {
        alerts.push({
          type: 'critical',
          message: `Критичне падіння прибутку на ${Math.abs(change).toFixed(1)}%`,
          value: currentRevenue,
          previousValue: previousRevenue,
          change: Math.round(change * 100) / 100,
          threshold: -20,
        })
      } else if (change < -10) {
        alerts.push({
          type: 'warning',
          message: `Попередження: прибуток знизився на ${Math.abs(change).toFixed(1)}%`,
          value: currentRevenue,
          previousValue: previousRevenue,
          change: Math.round(change * 100) / 100,
          threshold: -10,
        })
      } else if (change > 20) {
        alerts.push({
          type: 'info',
          message: `Відмінно! Прибуток зріс на ${change.toFixed(1)}%`,
          value: currentRevenue,
          previousValue: previousRevenue,
          change: Math.round(change * 100) / 100,
        })
      }
    }

    // Перевірка прогнозованого прибутку
    const currentConfirmed = await prisma.appointment.findMany({
      where: {
        businessId,
        status: 'Confirmed',
        startTime: { gte: currentStart, lte: currentEnd },
      },
      select: { services: true, customPrice: true },
    })

    let forecastedRevenue = 0
    currentConfirmed.forEach((apt) => {
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

    // Якщо прогнозований прибуток значно менший за поточний
    if (currentRevenue > 0 && forecastedRevenue < currentRevenue * 0.7) {
      alerts.push({
        type: 'warning',
        message: `Прогнозований прибуток на ${Math.round(((currentRevenue - forecastedRevenue) / currentRevenue) * 100)}% нижче поточного`,
        value: forecastedRevenue,
        previousValue: currentRevenue,
        change: Math.round(((forecastedRevenue - currentRevenue) / currentRevenue) * 100 * 100) / 100,
      })
    }

    // Перевірка кількості підтверджених візитів
    const confirmedCount = await prisma.appointment.count({
      where: {
        businessId,
        status: 'Confirmed',
        startTime: { gte: currentStart, lte: currentEnd },
      },
    })

    const previousConfirmedCount = await prisma.appointment.count({
      where: {
        businessId,
        status: 'Confirmed',
        startTime: { gte: previousStart, lte: previousEnd },
      },
    })

    if (previousConfirmedCount > 0) {
      const confirmedChange = ((confirmedCount - previousConfirmedCount) / previousConfirmedCount) * 100
      
      if (confirmedChange < -30) {
        alerts.push({
          type: 'critical',
          message: `Критичне зниження підтверджених візитів на ${Math.abs(confirmedChange).toFixed(1)}%`,
          value: confirmedCount,
          previousValue: previousConfirmedCount,
          change: Math.round(confirmedChange * 100) / 100,
          threshold: -30,
        })
      }
    }

    return NextResponse.json({ alerts })
  } catch (error) {
    console.error('Error calculating alerts:', error)
    return NextResponse.json(
      { error: 'Failed to calculate alerts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


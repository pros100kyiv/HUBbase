import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, subDays, subMonths, format, eachDayOfInterval } from 'date-fns'

function parseServices(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function appointmentRevenue(apt: any, services: { id: string; price: number }[]): number {
  const custom = apt?.customPrice != null ? Number(apt.customPrice) / 100 : NaN
  if (Number.isFinite(custom)) return custom
  const servicesList = parseServices(apt?.services)
  return servicesList.reduce((sum: number, serviceId: string) => {
    const service = services.find(s => s.id === serviceId)
    return sum + (service?.price || 0)
  }, 0)
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')?.trim()
    const period = (searchParams.get('period') || 'month').toLowerCase()
    
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    })
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
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
          id: true,
          status: true,
          services: true,
          customPrice: true,
          clientId: true,
          masterId: true,
          startTime: true,
          endTime: true,
          source: true,
          client: true,
          master: true,
        },
      }),
      prisma.client.findMany({
        where: { businessId },
        include: { appointments: true }
      }),
      prisma.service.findMany({ where: { businessId } }),
      prisma.master.findMany({ where: { businessId } })
    ])
    
    // Поточний прибуток (тільки виконані)
    const completedAppointments = appointments.filter(a => a.status === 'Done')
    const currentRevenue = completedAppointments.reduce((sum, apt) => {
      return sum + appointmentRevenue(apt, services)
    }, 0)
    
    // Прогнозований прибуток (підтверджені)
    const confirmedAppointments = appointments.filter(a => a.status === 'Confirmed')
    const forecastedRevenue = confirmedAppointments.reduce((sum, apt) => {
      return sum + appointmentRevenue(apt, services)
    }, 0)
    
    // LTV
    const ltvData = clients.map(client => {
      const clientAppointments = client.appointments?.filter(a => a.status === 'Done') ?? []
      const totalSpentRaw = client.totalSpent ?? 0
      const totalSpent = Number(totalSpentRaw) / 100
      const visits = clientAppointments.length
      const avgOrderValue = visits > 0 ? totalSpent / visits : 0
      const firstVisit = client.firstAppointmentDate ? new Date(client.firstAppointmentDate) : null
      const lastVisit = client.lastAppointmentDate ? new Date(client.lastAppointmentDate) : null
      const daysActive = firstVisit && lastVisit 
        ? Math.max(1, Math.floor((lastVisit.getTime() - firstVisit.getTime()) / (1000 * 60 * 60 * 24)))
        : 0
      const visitsPerMonth = daysActive > 0 ? (visits / daysActive) * 30 : 0
      const estimatedLifetime = visitsPerMonth > 0 ? avgOrderValue * visitsPerMonth * 12 : 0
      
      return {
        clientId: client.id,
        clientName: client.name,
        totalSpent,
        visits,
        avgOrderValue,
        ltv: estimatedLifetime,
        daysActive
      }
    })
    
    const avgLTV = ltvData.length > 0 
      ? ltvData.reduce((sum, c) => sum + c.ltv, 0) / ltvData.length 
      : 0
    
    // Retention Rate
    const activeClients = clients.filter(c => {
      if (!c.lastAppointmentDate) return false
      const lastVisit = new Date(c.lastAppointmentDate)
      const daysSinceLastVisit = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceLastVisit <= 90
    }).length
    
    const retentionRate = clients.length > 0 
      ? (activeClients / clients.length) * 100 
      : 0
    
    // Аналіз послуг
    const serviceAnalysis = services.map(service => {
      const serviceAppointments = completedAppointments.filter(apt => {
        const servicesList = parseServices(apt?.services)
        return servicesList.includes(service.id)
      })
      
      const revenue = serviceAppointments.length * service.price
      const popularity = completedAppointments.length > 0 
        ? (serviceAppointments.length / completedAppointments.length) * 100 
        : 0
      
      return {
        serviceId: service.id,
        serviceName: service.name,
        price: service.price,
        bookings: serviceAppointments.length,
        revenue,
        popularity: Math.round(popularity * 100) / 100,
        avgRevenuePerBooking: service.price
      }
    }).sort((a, b) => b.revenue - a.revenue)
    
    // Завантаженість спеціалістів
    const masterUtilization = masters.map(master => {
      const masterAppointments = completedAppointments.filter(a => a.masterId === master.id)
      const totalHours = masterAppointments.reduce((sum, apt) => {
        const start = new Date(apt.startTime)
        const end = new Date(apt.endTime)
        const startMs = start.getTime()
        const endMs = end.getTime()
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return sum
        const duration = (endMs - startMs) / (1000 * 60 * 60)
        return sum + duration
      }, 0)
      
      const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      const workingDays = daysInPeriod * 0.7
      const availableHours = workingDays * 8
      
      const utilizationRate = availableHours > 0 ? (totalHours / availableHours) * 100 : 0
      const revenue = masterAppointments.reduce((sum, apt) => {
        return sum + appointmentRevenue(apt, services)
      }, 0)
      
      return {
        masterId: master.id,
        masterName: master.name,
        appointments: masterAppointments.length,
        totalHours: Math.round(totalHours * 100) / 100,
        availableHours: Math.round(availableHours * 100) / 100,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
        revenue,
        avgRevenuePerHour: totalHours > 0 ? revenue / totalHours : 0
      }
    }).sort((a, b) => b.utilizationRate - a.utilizationRate)
    
    // Тренди
    const intervalStart = startDate.getTime()
    const intervalEnd = endDate.getTime()
    const days = intervalEnd >= intervalStart
      ? eachDayOfInterval({ start: startDate, end: endDate })
      : []
    const dailyTrends = days.map(date => {
      const dayAppointments = appointments.filter(a => {
        const aptDate = new Date(a.startTime)
        return aptDate.toDateString() === date.toDateString()
      })
      
      const dayRevenue = dayAppointments
        .filter(a => a.status === 'Done')
        .reduce((sum, apt) => {
          return sum + appointmentRevenue(apt, services)
        }, 0)
      
      return {
        date: format(date, 'yyyy-MM-dd'),
        dateLabel: format(date, 'dd.MM'),
        appointments: dayAppointments.length,
        completed: dayAppointments.filter(a => a.status === 'Done').length,
        revenue: dayRevenue
      }
    })
    
    // Конверсія
    const totalBookings = appointments.length
    const confirmed = appointments.filter(a => a.status === 'Confirmed' || a.status === 'Done').length
    const completed = appointments.filter(a => a.status === 'Done').length
    const cancelled = appointments.filter(a => a.status === 'Cancelled').length
    
    const conversionFunnel = {
      total: totalBookings,
      confirmed: confirmed,
      completed: completed,
      cancelled: cancelled,
      confirmationRate: totalBookings > 0 ? (confirmed / totalBookings) * 100 : 0,
      completionRate: confirmed > 0 ? (completed / confirmed) * 100 : 0,
      cancellationRate: totalBookings > 0 ? (cancelled / totalBookings) * 100 : 0
    }
    
    // Джерела
    const sourceAnalysis = appointments.reduce((acc, apt) => {
      const source = apt.source || 'unknown'
      if (!acc[source]) {
        acc[source] = { count: 0, revenue: 0 }
      }
      acc[source].count++
      if (apt.status === 'Done') {
        acc[source].revenue += appointmentRevenue(apt, services)
      }
      return acc
    }, {} as Record<string, { count: number, revenue: number }>)
    
    // Прогноз
    const avgDailyRevenue = dailyTrends.length > 0
      ? dailyTrends.reduce((sum, d) => sum + d.revenue, 0) / dailyTrends.length
      : 0
    
    const daysInNextPeriod = period === 'day' ? 1 : period === 'week' ? 7 : 30
    const forecastNextPeriod = avgDailyRevenue * daysInNextPeriod
    
    return NextResponse.json({
      currentRevenue: Math.round(currentRevenue),
      forecastedRevenue: Math.round(forecastedRevenue),
      avgLTV: Math.round(avgLTV),
      retentionRate: Math.round(retentionRate * 100) / 100,
      activeClients,
      totalClients: clients.length,
      serviceAnalysis,
      masterUtilization,
      dailyTrends,
      conversionFunnel,
      sourceAnalysis,
      forecastNextPeriod: Math.round(forecastNextPeriod),
      forecastGrowth: currentRevenue > 0 
        ? Math.round(((forecastedRevenue - currentRevenue) / currentRevenue) * 100)
        : 0
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Advanced analytics error:', error)
    const prismaCode = (error as { code?: string })?.code
    if (prismaCode === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const details = process.env.NODE_ENV === 'development' ? msg : undefined
    return NextResponse.json({ error: 'Failed to calculate analytics', details }, { status: 500 })
  }
}


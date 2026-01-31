import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth } from 'date-fns'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const masterId = resolvedParams.id

    const now = new Date()
    const startDate = startOfMonth(now)
    const endDate = endOfMonth(now)

    // Get appointments for this master
    const appointments = await prisma.appointment.findMany({
      where: {
        masterId,
        startTime: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          not: 'Cancelled',
        },
      },
      include: {
        master: {
          select: {
            businessId: true,
          },
        },
      },
    })

    // Calculate stats
    const visits = appointments.length
    const uniqueClients = new Set(appointments.map((apt) => apt.clientPhone)).size

    // Calculate earnings
    let earned = 0
    const services = await prisma.service.findMany({
      where: {
        businessId: appointments[0]?.master.businessId || '',
      },
    })

    appointments.forEach((apt) => {
      try {
        const serviceIds = JSON.parse(apt.services) as string[]
        serviceIds.forEach((serviceId) => {
          const service = services.find((s) => s.id === serviceId)
          if (service) {
            earned += service.price
          }
        })
      } catch (e) {
        // Ignore
      }
    })

    // Get services count for this master's business
    const servicesCount = services.length

    return NextResponse.json({
      visits,
      earned,
      reviews: 0, // TODO: Add reviews system
      clients: uniqueClients,
      services: servicesCount,
      branches: 1, // TODO: Add branches system
    })
  } catch (error) {
    console.error('Error fetching master stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}





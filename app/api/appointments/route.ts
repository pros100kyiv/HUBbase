import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function checkConflict(
  businessId: string,
  masterId: string,
  startTime: Date,
  endTime: Date,
  excludeId?: string
): Promise<boolean> {
  return prisma.appointment
    .findFirst({
      where: {
        businessId,
        masterId,
        startTime: {
          lt: endTime,
        },
        endTime: {
          gt: startTime,
        },
        status: {
          not: 'Cancelled',
        },
        ...(excludeId && { id: { not: excludeId } }),
      },
    })
    .then((conflict) => !!conflict)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, masterId, clientName, clientPhone, clientEmail, startTime, endTime, services, customPrice, notes } = body

    if (!businessId || !masterId || !clientName || !clientPhone || !startTime || !endTime || !services) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const start = new Date(startTime)
    const end = new Date(endTime)

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    // Check for conflicts
    const hasConflict = await checkConflict(businessId, masterId, start, end)
    if (hasConflict) {
      return NextResponse.json(
        { error: 'This time slot is already booked' },
        { status: 409 }
      )
    }

    const appointment = await prisma.appointment.create({
      data: {
        businessId,
        masterId,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail?.trim() || null,
        startTime: start,
        endTime: end,
        services: JSON.stringify(services),
        customPrice: customPrice ? parseInt(customPrice) : null,
        notes: notes?.trim() || null,
        status: 'Pending',
      },
    })

    return NextResponse.json(appointment, { status: 201 })
  } catch (error) {
    console.error('Error creating appointment:', error)
    return NextResponse.json({ 
      error: 'Failed to create appointment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const masterId = searchParams.get('masterId')
    const businessId = searchParams.get('businessId')
    const status = searchParams.get('status')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    const where: any = { businessId }
    
    if (status) {
      where.status = status
    }
    
    if (date) {
      // Parse date string (YYYY-MM-DD format)
      const dateParts = date.split('-')
      if (dateParts.length === 3) {
        const startOfDay = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), 0, 0, 0, 0)
        const endOfDay = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]), 23, 59, 59, 999)
        where.startTime = {
          gte: startOfDay,
          lte: endOfDay,
        }
      }
    } else if (startDate && endDate) {
      // Parse date strings (YYYY-MM-DD format)
      const startParts = startDate.split('-')
      const endParts = endDate.split('-')
      if (startParts.length === 3 && endParts.length === 3) {
        const start = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]), 0, 0, 0, 0)
        const end = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]), 23, 59, 59, 999)
        where.startTime = {
          gte: start,
          lte: end,
        }
      }
    }
    
    if (masterId) {
      where.masterId = masterId
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        master: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    })

    return NextResponse.json(appointments)
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 })
  }
}


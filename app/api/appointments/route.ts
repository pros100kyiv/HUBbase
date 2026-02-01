import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addDays, addWeeks, addMonths, getDay, startOfDay, isBefore, isAfter } from 'date-fns'
import { upsertClient } from '@/lib/client-utils'

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

function generateRecurringDates(
  startDate: Date,
  endDate: Date,
  recurrenceType: 'daily' | 'weekly' | 'monthly',
  daysOfWeek?: number[]
): Date[] {
  const dates: Date[] = []
  let currentDate = new Date(startDate)

  while (isBefore(currentDate, endDate) || currentDate.getTime() === startDate.getTime()) {
    if (recurrenceType === 'daily') {
      dates.push(new Date(currentDate))
      currentDate = addDays(currentDate, 1)
    } else if (recurrenceType === 'weekly') {
      const dayOfWeek = getDay(currentDate) // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      if (daysOfWeek && daysOfWeek.includes(dayOfWeek)) {
        dates.push(new Date(currentDate))
      }
      currentDate = addDays(currentDate, 1)
      // Якщо пройшли всі дні тижня, переходимо на наступний тиждень
      if (getDay(currentDate) === 1) {
        // Понеділок - початок нового тижня
      }
    } else if (recurrenceType === 'monthly') {
      dates.push(new Date(currentDate))
      currentDate = addMonths(currentDate, 1)
    }

    if (isAfter(currentDate, endDate)) break
  }

  return dates
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      businessId, 
      masterId, 
      clientName, 
      clientPhone, 
      clientEmail, 
      startTime, 
      endTime, 
      services, 
      customPrice, 
      notes,
      isRecurring,
      recurrencePattern,
      recurrenceEndDate,
      isFromBooking // Чи створено через публічне бронювання
    } = body

    if (!businessId || !masterId || !clientName || !clientPhone || !startTime || !endTime || !services) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const start = new Date(startTime)
    const end = new Date(endTime)
    const duration = end.getTime() - start.getTime()

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    // Handle recurring appointments
    if (isRecurring && recurrencePattern && recurrenceEndDate) {
      const pattern = JSON.parse(recurrencePattern)
      const endDate = new Date(recurrenceEndDate)
      
      // Generate all dates for recurring appointments
      const dates = generateRecurringDates(
        start,
        endDate,
        pattern.type,
        pattern.daysOfWeek
      )

      if (dates.length === 0) {
        return NextResponse.json({ error: 'No valid dates found for recurrence pattern' }, { status: 400 })
      }

      // Check for conflicts for all dates
      for (const date of dates) {
        const appointmentStart = new Date(date)
        appointmentStart.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds())
        const appointmentEnd = new Date(appointmentStart.getTime() + duration)

        const hasConflict = await checkConflict(businessId, masterId, appointmentStart, appointmentEnd)
        if (hasConflict) {
          return NextResponse.json(
            { error: `Time slot on ${date.toLocaleDateString()} is already booked` },
            { status: 409 }
          )
        }
      }

      // Create all recurring appointments
      const createdAppointments = []
      let parentAppointmentId: string | null = null

      for (let i = 0; i < dates.length; i++) {
        const appointmentStart = new Date(dates[i])
        appointmentStart.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds())
        const appointmentEnd = new Date(appointmentStart.getTime() + duration)

        const appointmentData: any = {
          businessId,
          masterId,
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim(),
          clientEmail: clientEmail?.trim() || null,
          startTime: appointmentStart,
          endTime: appointmentEnd,
          services: JSON.stringify(services),
          // customPrice приходить в копійках (якщо число) або як рядок
          // Якщо це число, використовуємо його безпосередньо
          // Якщо рядок, парсимо його
          customPrice: customPrice !== null && customPrice !== undefined && customPrice !== ''
            ? (typeof customPrice === 'number' ? customPrice : parseInt(String(customPrice)))
            : null,
          notes: notes?.trim() || null,
          status: 'Pending',
          isRecurring: true,
          recurrencePattern: recurrencePattern,
          recurrenceEndDate: endDate,
          isFromBooking: isFromBooking === true, // Тільки якщо явно вказано true
        }

        if (parentAppointmentId) {
          appointmentData.parentAppointmentId = parentAppointmentId
        }

        const appointment: any = await prisma.appointment.create({
          data: appointmentData as any,
        })

        if (i === 0) {
          parentAppointmentId = appointment.id
        }

        createdAppointments.push(appointment)
      }

      return NextResponse.json({ 
        appointments: createdAppointments,
        count: createdAppointments.length,
        message: `Created ${createdAppointments.length} recurring appointments`
      }, { status: 201 })
    }

    // Single appointment (non-recurring)
    const hasConflict = await checkConflict(businessId, masterId, start, end)
    if (hasConflict) {
      return NextResponse.json(
        { error: 'This time slot is already booked' },
        { status: 409 }
      )
    }

    // Створюємо або оновлюємо клієнта
    const client = await upsertClient(businessId, {
      name: clientName,
      phone: clientPhone,
      email: clientEmail,
    })

    const appointmentData: any = {
      businessId,
      masterId,
      clientId: client?.id || null,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail?.trim() || null,
      startTime: start,
      endTime: end,
      services: JSON.stringify(services),
      customPrice: customPrice ? parseInt(customPrice) : null,
      notes: notes?.trim() || null,
      status: 'Pending',
      isRecurring: false,
      isFromBooking: isFromBooking === true, // Тільки якщо явно вказано true
    }

    const appointment = await prisma.appointment.create({
      data: appointmentData,
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


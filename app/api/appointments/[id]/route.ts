import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addDays, addMonths, getDay, isBefore, isAfter } from 'date-fns'

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
    } else if (recurrenceType === 'monthly') {
      dates.push(new Date(currentDate))
      currentDate = addMonths(currentDate, 1)
    }

    if (isAfter(currentDate, endDate)) break
  }

  return dates
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const body = await request.json()
    const { 
      status, 
      startTime, 
      endTime, 
      customPrice,
      masterId,
      clientName,
      clientPhone,
      clientEmail,
      services,
      notes,
      isRecurring,
      recurrencePattern,
      recurrenceEndDate
    } = body

    // Get current appointment to check for conflicts and get original data
    const currentAppointment = await prisma.appointment.findUnique({
      where: { id: resolvedParams.id },
      select: { 
        businessId: true, 
        masterId: true, 
        startTime: true, 
        endTime: true,
        clientName: true,
        clientPhone: true,
        clientEmail: true,
        services: true,
        isRecurring: true,
        parentAppointmentId: true
      },
    })

    if (!currentAppointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    // Check for conflicts if time or master changed
    const newMasterId = masterId || currentAppointment.masterId
    const newStartTime = startTime ? new Date(startTime) : currentAppointment.startTime
    const newEndTime = endTime ? new Date(endTime) : currentAppointment.endTime

    const timeChanged = startTime || endTime
    const masterChanged = masterId && masterId !== currentAppointment.masterId

    if (timeChanged || masterChanged) {
      const hasConflict = await checkConflict(
        currentAppointment.businessId,
        newMasterId,
        newStartTime,
        newEndTime,
        resolvedParams.id
      )

      if (hasConflict) {
        return NextResponse.json(
          { error: 'This time slot is already booked' },
          { status: 409 }
        )
      }
    }

    // Check if we need to handle recurring appointments
    const shouldCreateRecurring = isRecurring && recurrencePattern && recurrenceEndDate
    const wasRecurring = currentAppointment && await prisma.appointment.findFirst({
      where: { 
        id: resolvedParams.id,
        isRecurring: true
      }
    })

    // If changing to recurring or updating recurring pattern, create all recurring appointments
    if (shouldCreateRecurring) {
      const pattern = JSON.parse(recurrencePattern)
      const endDate = new Date(recurrenceEndDate)
      const start = newStartTime
      const duration = newEndTime.getTime() - newStartTime.getTime()

      // Delete old recurring appointments if they exist
      if (wasRecurring) {
        // Find all related recurring appointments
        const relatedAppointments = await prisma.appointment.findMany({
          where: {
            OR: [
              { id: resolvedParams.id },
              { parentAppointmentId: resolvedParams.id }
            ]
          }
        })
        
        // Delete all related appointments
        await prisma.appointment.deleteMany({
          where: {
            id: {
              in: relatedAppointments.map(a => a.id)
            }
          }
        })
      }

      // Generate all dates for recurring appointments
      const dates = generateRecurringDates(
        start,
        endDate,
        pattern.type,
        pattern.daysOfWeek || pattern.days
      )

      if (dates.length === 0) {
        return NextResponse.json({ error: 'No valid dates found for recurrence pattern' }, { status: 400 })
      }

      // Check for conflicts for all dates
      for (const date of dates) {
        const appointmentStart = new Date(date)
        appointmentStart.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds())
        const appointmentEnd = new Date(appointmentStart.getTime() + duration)

        const hasConflict = await checkConflict(
          currentAppointment.businessId,
          newMasterId,
          appointmentStart,
          appointmentEnd
        )
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
          businessId: currentAppointment.businessId,
          masterId: newMasterId,
          clientName: clientName?.trim() || currentAppointment.clientName,
          clientPhone: clientPhone?.trim() || currentAppointment.clientPhone,
          clientEmail: clientEmail !== undefined ? (clientEmail?.trim() || null) : currentAppointment.clientEmail,
          startTime: appointmentStart,
          endTime: appointmentEnd,
          services: services ? (typeof services === 'string' ? services : JSON.stringify(services)) : currentAppointment.services,
          customPrice: customPrice !== undefined ? (customPrice ? parseInt(customPrice) : null) : null,
          notes: notes !== undefined ? (notes?.trim() || null) : null,
          status: status || 'Pending',
          isRecurring: true,
          recurrencePattern: recurrencePattern,
          recurrenceEndDate: endDate,
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
        message: `Updated and created ${createdAppointments.length} recurring appointments`
      }, { status: 200 })
    }

    // Regular update (non-recurring or removing recurrence)
    const updateData: any = {}
    if (status) updateData.status = status
    if (startTime) updateData.startTime = new Date(startTime)
    if (endTime) updateData.endTime = new Date(endTime)
    if (customPrice !== undefined) {
      updateData.customPrice = customPrice ? parseInt(customPrice) : null
    }
    if (masterId) updateData.masterId = masterId
    if (clientName) updateData.clientName = clientName.trim()
    if (clientPhone) updateData.clientPhone = clientPhone.trim()
    if (clientEmail !== undefined) updateData.clientEmail = clientEmail?.trim() || null
    if (services) updateData.services = typeof services === 'string' ? services : JSON.stringify(services)
    if (notes !== undefined) updateData.notes = notes?.trim() || null
    if (isRecurring !== undefined) updateData.isRecurring = isRecurring
    if (recurrencePattern !== undefined) updateData.recurrencePattern = recurrencePattern
    if (recurrenceEndDate !== undefined) updateData.recurrenceEndDate = recurrenceEndDate ? new Date(recurrenceEndDate) : null

    const appointment = await prisma.appointment.update({
      where: { id: resolvedParams.id },
      data: updateData,
    })

    return NextResponse.json(appointment)
  } catch (error) {
    console.error('Error updating appointment:', error)
    return NextResponse.json({ 
      error: 'Failed to update appointment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    await prisma.appointment.delete({
      where: { id: resolvedParams.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete appointment' }, { status: 500 })
  }
}


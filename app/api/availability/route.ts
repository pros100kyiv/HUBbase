import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { format, addMinutes, startOfDay, getDay } from 'date-fns'

interface DaySchedule {
  enabled: boolean
  start: string
  end: string
}

interface WorkingHours {
  [key: string]: DaySchedule
}

const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const masterId = searchParams.get('masterId')
    const businessId = searchParams.get('businessId')
    const dateParam = searchParams.get('date')

    if (!masterId || !businessId || !dateParam) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    // Parse date string (YYYY-MM-DD format)
    const dateParts = dateParam.split('-')
    if (dateParts.length !== 3) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }
    
    const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]))
    const startOfSelectedDay = startOfDay(date)
    const endOfDay = new Date(startOfSelectedDay)
    endOfDay.setHours(23, 59, 59, 999)

    // Get master with working hours and check if active
    const master = await prisma.master.findUnique({
      where: { id: masterId },
      select: { workingHours: true, blockedPeriods: true, isActive: true },
    })

    // If master is not active, return empty slots
    if (!master || master.isActive === false) {
      return NextResponse.json({ availableSlots: [] })
    }

    // Get existing appointments for this master on this day
    const appointments = await prisma.appointment.findMany({
      where: {
        businessId,
        masterId,
        startTime: {
          gte: startOfSelectedDay,
          lte: endOfDay,
        },
        status: {
          not: 'Cancelled',
        },
      },
    })

    // Parse working hours
    let workingHours: WorkingHours | null = null
    if (master?.workingHours) {
      try {
        workingHours = JSON.parse(master.workingHours)
      } catch (e) {
        console.error('Error parsing working hours:', e)
      }
    }

    // Parse blocked periods
    let blockedPeriods: Array<{ start: string; end: string }> = []
    if (master?.blockedPeriods) {
      try {
        blockedPeriods = JSON.parse(master.blockedPeriods)
      } catch (e) {
        console.error('Error parsing blocked periods:', e)
      }
    }

    // Get day of week (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeek = getDay(date)
    const dayName = dayNames[dayOfWeek]

    // Determine working hours for this day
    let dayStart = 9
    let dayEnd = 21
    let isWorkingDay = true

    if (workingHours && workingHours[dayName]) {
      const daySchedule = workingHours[dayName]
      isWorkingDay = daySchedule.enabled
      if (daySchedule.enabled) {
        const [startHour, startMinute] = daySchedule.start.split(':').map(Number)
        const [endHour, endMinute] = daySchedule.end.split(':').map(Number)
        dayStart = startHour
        dayEnd = endHour + (endMinute > 0 ? 1 : 0)
      }
    }

    // Generate all possible 30-minute slots
    const slots: string[] = []
    if (isWorkingDay) {
      for (let hour = dayStart; hour < dayEnd; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const slotTime = new Date(startOfSelectedDay)
          slotTime.setHours(hour, minute, 0, 0)
          // Only add slots that are not in the past
          if (slotTime >= new Date()) {
            slots.push(format(slotTime, "yyyy-MM-dd'T'HH:mm"))
          }
        }
      }
    }

    // Filter out occupied slots
    const occupiedSlots = new Set<string>()
    appointments.forEach((apt) => {
      let current = new Date(apt.startTime)
      const end = new Date(apt.endTime)
      while (current < end) {
        occupiedSlots.add(format(current, "yyyy-MM-dd'T'HH:mm"))
        current = addMinutes(current, 30)
      }
    })

    // Filter out blocked periods
    blockedPeriods.forEach((blocked) => {
      const blockStart = new Date(blocked.start)
      const blockEnd = new Date(blocked.end)
      let current = new Date(blockStart)
      while (current < blockEnd) {
        const slotStr = format(current, "yyyy-MM-dd'T'HH:mm")
        occupiedSlots.add(slotStr)
        current = addMinutes(current, 30)
      }
    })

    const availableSlots = slots.filter((slot) => !occupiedSlots.has(slot))

    return NextResponse.json({ availableSlots })
  } catch (error) {
    console.error('Error fetching availability:', error)
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 })
  }
}


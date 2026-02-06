import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function normalizeUaPhone(phone: string): string {
  // Нормалізуємо телефон клієнта до формату +380XXXXXXXXX
  let normalizedPhone = String(phone || '')
    .replace(/\s/g, '')
    .replace(/[()-]/g, '')
    .trim()

  if (normalizedPhone.startsWith('0')) {
    normalizedPhone = `+380${normalizedPhone.slice(1)}`
  } else if (normalizedPhone.startsWith('380')) {
    normalizedPhone = `+${normalizedPhone}`
  } else if (!normalizedPhone.startsWith('+380')) {
    normalizedPhone = `+380${normalizedPhone}`
  }

  return normalizedPhone
}

function normalizeServicesToJsonArrayString(services: unknown): string | null {
  // В БД зберігаємо JSON-рядок масиву ID послуг: '["id1","id2"]'
  // Приймаємо як масив, так і рядок JSON.
  try {
    const parsed = typeof services === 'string' ? JSON.parse(services) : services
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return JSON.stringify(parsed)
  } catch {
    return null
  }
}

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
    const { businessId, masterId, clientName, clientPhone, clientEmail, startTime, endTime, services, notes, customPrice } = body

    if (!businessId || !masterId || !clientName || !clientPhone || !startTime || !endTime) {
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

    const normalizedPhone = normalizeUaPhone(clientPhone)
    const normalizedClientName = String(clientName || '').trim()
    const normalizedClientEmail =
      typeof clientEmail === 'string' && clientEmail.trim() ? clientEmail.trim() : null

    // Послуги опціональні — якщо не вказані, зберігаємо порожній масив
    const servicesJson = services ? normalizeServicesToJsonArrayString(services) : '[]'
    if (servicesJson === null) {
      return NextResponse.json(
        { error: 'Invalid services format. Expected array of service IDs.' },
        { status: 400 }
      )
    }

    // КРИТИЧНО: гарантуємо, що клієнт з’явиться у вкладці "Клієнти"
    // Робимо upsert по @@unique([businessId, phone]) — без race condition та без дублікатів.
    const { client, appointment } = await prisma.$transaction(async (tx) => {
      const ensuredClient = await tx.client.upsert({
        where: {
          businessId_phone: {
            businessId,
            phone: normalizedPhone,
          },
        },
        create: {
          businessId,
          name: normalizedClientName,
          phone: normalizedPhone,
          email: normalizedClientEmail,
        },
        update: {
          name: normalizedClientName,
          ...(normalizedClientEmail !== null ? { email: normalizedClientEmail } : {}),
        },
      })

      const createdAppointment = await tx.appointment.create({
        data: {
          businessId,
          masterId,
          clientId: ensuredClient.id,
          clientName: normalizedClientName,
          clientPhone: normalizedPhone,
          clientEmail: normalizedClientEmail,
          startTime: start,
          endTime: end,
          services: servicesJson,
          notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
          customPrice: typeof customPrice === 'number' && customPrice > 0 ? customPrice : null,
          status: 'Pending',
        },
      })

      return { client: ensuredClient, appointment: createdAppointment }
    })

    // Автоматично додаємо номер телефону клієнта в Реєстр телефонів
    try {
      const { addClientPhoneToDirectory } = await import('@/lib/services/management-center')
      await addClientPhoneToDirectory(
        normalizedPhone,
        businessId,
        client.id,
        normalizedClientName
      )
    } catch (error) {
      console.error('Error adding client phone to directory:', error)
      // Не викидаємо помилку, щоб не зламати створення запису
    }

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
    const clientPhone = searchParams.get('clientPhone')

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

    if (clientPhone) {
      // For client history search: normalize UA phone to match stored format
      where.clientPhone = normalizeUaPhone(clientPhone)
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


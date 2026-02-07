import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
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
  // В БД зберігаємо JSON-рядок масиву ID послуг: '["id1","id2"]' або '[]' (без послуги / своя послуга)
  try {
    const parsed = typeof services === 'string' ? JSON.parse(services) : services
    if (!Array.isArray(parsed)) return null
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
    const { businessId, masterId, clientName, clientPhone, clientEmail, startTime, endTime, services, notes, customPrice, customServiceName, customService } = body

    if (!businessId || !masterId || !clientName || !clientPhone || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Не заповнені обов’язкові поля: бізнес, спеціаліст, ім’я, телефон, дата та час' },
        { status: 400 }
      )
    }

    const [business, master] = await Promise.all([
      prisma.business.findUnique({ where: { id: businessId }, select: { id: true } }),
      prisma.master.findUnique({ where: { id: masterId }, select: { id: true, businessId: true } }),
    ])
    if (!business) {
      return NextResponse.json({ error: 'Бізнес не знайдено' }, { status: 400 })
    }
    if (!master || master.businessId !== businessId) {
      return NextResponse.json({ error: 'Спеціаліста не знайдено або він не належить цьому бізнесу' }, { status: 400 })
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

    // Послуги опціональні — порожній масив дозволено (запис без послуги або своя послуга)
    const servicesJson = services !== undefined && services !== null
      ? normalizeServicesToJsonArrayString(services)
      : '[]'
    if (servicesJson === null) {
      return NextResponse.json(
        { error: 'Invalid services format. Expected array of service IDs.' },
        { status: 400 }
      )
    }

    const customServiceNameValue =
      typeof customServiceName === 'string' && customServiceName.trim()
        ? customServiceName.trim()
        : (typeof customService === 'string' && customService.trim() ? customService.trim() : null)

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
          customServiceName: customServiceNameValue,
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
    let userMessage = 'Не вдалося створити запис. Спробуйте ще раз.'
    let status = 500
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        userMessage = 'Цей час вже зайнятий або конфлікт даних.'
        status = 409
      } else if (error.code === 'P2003') {
        userMessage = 'Спеціаліст, бізнес або клієнт не знайдено. Оновіть сторінку та спробуйте знову.'
        status = 400
      }
    } else {
      const isConflict = message.includes('Unique constraint') || message.includes('conflict')
      const isForeignKey = message.includes('Foreign key') || message.includes('Record to update not found')
      if (isConflict) {
        userMessage = 'Цей час вже зайнятий або конфлікт даних.'
        status = 409
      } else if (isForeignKey) {
        userMessage = 'Спеціаліст або бізнес не знайдено. Оновіть сторінку та спробуйте знову.'
      }
    }

    return NextResponse.json({
      error: userMessage,
      details: process.env.NODE_ENV === 'development' ? message : undefined,
    }, { status })
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


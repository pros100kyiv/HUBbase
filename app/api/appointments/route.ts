import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeUaPhone, isValidUaPhone } from '@/lib/utils/phone'
import { addMinutes, addDays } from 'date-fns'
import {
  DEFAULT_BOOKING_OPTIONS,
  parseBookingSlotsOptions,
  parseBookingTimeZone,
  slotKeyToUtcDate,
} from '@/lib/utils/booking-settings'
import { generateAppointmentAccessToken, hashAppointmentAccessToken } from '@/lib/utils/appointment-access-token'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
  excludeId?: string,
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<boolean> {
  return db.appointment
    .findFirst({
      where: {
        businessId,
        masterId,
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        status: { notIn: ['Cancelled', 'Скасовано'] },
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    })
    .then((conflict) => !!conflict)
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Невірний формат даних (очікується JSON)' },
      { status: 400 }
    )
  }
  try {
    const {
      businessId,
      masterId,
      clientName,
      clientPhone,
      clientEmail,
      startTime,
      endTime,
      slot,
      durationMinutes,
      services,
      notes,
      customPrice,
      customServiceName,
      customService,
      isFromBooking,
      source,
      telegramChatId,
    } = body

    const hasSlotPayload = typeof slot === 'string' && slot.trim()
    const hasStartEndPayload = startTime != null && endTime != null

    if (!businessId || !masterId || !clientName || !clientPhone || (!hasSlotPayload && !hasStartEndPayload)) {
      return NextResponse.json(
        { error: 'Не заповнені обов’язкові поля: бізнес, спеціаліст, ім’я, телефон, дата та час' },
        { status: 400 }
      )
    }

    const bid = String(businessId)
    const mid = String(masterId)
    const [business, master] = await Promise.all([
      prisma.business.findUnique({ where: { id: bid }, select: { id: true, slug: true, settings: true } }),
      prisma.master.findUnique({ where: { id: mid }, select: { id: true, businessId: true } }),
    ])
    if (!business) {
      return NextResponse.json({ error: 'Бізнес не знайдено' }, { status: 400 })
    }
    if (!master || master.businessId !== bid) {
      return NextResponse.json({ error: 'Спеціаліста не знайдено або він не належить цьому бізнесу' }, { status: 400 })
    }

    // Name kept unique to avoid any accidental duplicate bindings during bundling.
    const isFromBookingFlag = isFromBooking === true
    const initialStatus = isFromBookingFlag ? 'Pending' : 'Confirmed'

    const settingsRaw = business?.settings ?? null
    const bookingOptions = parseBookingSlotsOptions(settingsRaw)
    const timeZone = parseBookingTimeZone(settingsRaw)

    let start: Date
    let end: Date
    if (hasSlotPayload) {
      const slotKey = String(slot).trim()
      const rawDuration = Number(durationMinutes)
      const dur =
        Number.isFinite(rawDuration) && rawDuration > 0
          ? Math.max(15, Math.min(480, Math.round(rawDuration)))
          : 30
      const startUtc = slotKeyToUtcDate(slotKey, timeZone)
      if (!startUtc) {
        return NextResponse.json(
          { error: 'Невірний формат слоту. Очікується "YYYY-MM-DDTHH:mm".' },
          { status: 400 }
        )
      }
      start = startUtc
      end = addMinutes(startUtc, dur)
    } else {
      start = new Date(startTime as string | number | Date)
      end = new Date(endTime as string | number | Date)
    }

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: 'Невірна дата/час запису' }, { status: 400 })
    }

    // Server-side safety for public booking (prevents booking "in the past" due to TZ/client mismatch).
    if (isFromBookingFlag) {
      const nowUtc = new Date()
      const minAllowedUtc = addMinutes(nowUtc, bookingOptions.minAdvanceBookingMinutes ?? DEFAULT_BOOKING_OPTIONS.minAdvanceBookingMinutes)
      if (start < minAllowedUtc) {
        return NextResponse.json(
          { error: 'Цей час вже недоступний. Оберіть інший слот.' },
          { status: 409 }
        )
      }
      const maxAllowedUtc = addDays(nowUtc, bookingOptions.maxDaysAhead ?? DEFAULT_BOOKING_OPTIONS.maxDaysAhead)
      if (start > maxAllowedUtc) {
        return NextResponse.json(
          { error: 'Запис на таку дату недоступний. Оберіть ближчу дату.' },
          { status: 400 }
        )
      }
    }

    const normalizedPhone = normalizeUaPhone(String(clientPhone))
    if (!isValidUaPhone(normalizedPhone)) {
      return NextResponse.json(
        { error: 'Невірний формат телефону. Введіть український номер, наприклад 0671234567' },
        { status: 400 }
      )
    }
    const normalizedClientName = String(clientName ?? '').trim()
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
    const { client, appointment, manageToken } = await prisma.$transaction(async (tx) => {
      const ensuredClient = await tx.client.upsert({
        where: {
          businessId_phone: {
            businessId: bid,
            phone: normalizedPhone,
          },
        },
        create: {
          businessId: bid,
          name: normalizedClientName,
          phone: normalizedPhone,
          email: normalizedClientEmail,
        },
        update: {
          name: normalizedClientName,
          ...(normalizedClientEmail !== null ? { email: normalizedClientEmail } : {}),
        },
      })

      const hasConflict = await checkConflict(bid, mid, start, end, undefined, tx)
      if (hasConflict) {
        throw new Error('APPOINTMENT_CONFLICT')
      }

      const sourceVal = typeof source === 'string' && source.trim() ? source.trim() : null
      const isFromTelegram = isFromBookingFlag && sourceVal === 'telegram'
      const tgChatId = typeof telegramChatId === 'string' && telegramChatId.trim() ? telegramChatId.trim() : null

      if (isFromTelegram && tgChatId) {
        try {
          await tx.client.update({
            where: { id: ensuredClient.id },
            data: { telegramChatId: tgChatId },
          })
        } catch {
          // telegramChatId column may not exist if migration not applied
        }
      }

      const createdAppointment = await tx.appointment.create({
        data: {
          businessId: bid,
          masterId: mid,
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
          status: initialStatus,
          isFromBooking: isFromBookingFlag,
          source: isFromTelegram ? 'telegram' : sourceVal,
        },
      })

      // Magic-link token for client self-service (only for public booking).
      // We store only hash in DB, token is returned to the client once.
      let token: string | null = null
      if (isFromBookingFlag) {
        const existing = await tx.appointmentAccessToken.findFirst({
          where: { appointmentId: createdAppointment.id, businessId: bid, revokedAt: null },
          select: { id: true },
        })
        if (!existing) {
          token = generateAppointmentAccessToken()
          const tokenHash = hashAppointmentAccessToken(token)
          await tx.appointmentAccessToken.create({
            data: {
              businessId: bid,
              appointmentId: createdAppointment.id,
              tokenHash,
              userAgent: request.headers.get('user-agent'),
              ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null,
            },
          })
        }
      }

      // Basic audit trail (non-blocking).
      try {
        await tx.appointmentEvent.create({
          data: {
            businessId: bid,
            appointmentId: createdAppointment.id,
            type: 'APPOINTMENT_CREATED',
            data: JSON.stringify({ isFromBooking: isFromBookingFlag, status: initialStatus }),
          },
        })
      } catch {
        // ignore
      }

      return { client: ensuredClient, appointment: createdAppointment, manageToken: token }
    })

    // Автоматично додаємо номер телефону клієнта в Реєстр телефонів
    try {
      const { addClientPhoneToDirectory } = await import('@/lib/services/management-center')
      await addClientPhoneToDirectory(
        normalizedPhone,
        bid,
        client.id,
        normalizedClientName
      )
    } catch (error) {
      console.error('Error adding client phone to directory:', error)
      // Не викидаємо помилку, щоб не зламати створення запису
    }

    return NextResponse.json(
      {
        ...appointment,
        ...(manageToken && business?.slug
          ? { manageToken, manageUrl: `/booking/${business.slug}/manage/${manageToken}` }
          : {}),
      },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : undefined
    console.error('Error creating appointment:', message, stack)

    let userMessage = 'Не вдалося створити запис. Спробуйте ще раз.'
    let status = 500

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        userMessage = 'Цей час вже зайнятий або конфлікт даних.'
        status = 409
      } else if (error.code === 'P2003') {
        userMessage = 'Спеціаліст, бізнес або клієнт не знайдено. Оновіть сторінку та спробуйте знову.'
        status = 400
      }
    } else if (message === 'APPOINTMENT_CONFLICT') {
      userMessage = 'Цей час вже зайнятий іншим клієнтом.'
      status = 409
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
      details: (process.env.NODE_ENV === 'development' || status === 500) ? message : undefined,
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

    const baseSelect = {
      id: true,
      businessId: true,
      masterId: true,
      clientId: true,
      clientName: true,
      clientPhone: true,
      clientEmail: true,
      startTime: true,
      endTime: true,
      status: true,
      services: true,
      customServiceName: true,
      customPrice: true,
      notes: true,
      reminderSent: true,
      isRecurring: true,
      recurrencePattern: true,
      recurrenceEndDate: true,
      parentAppointmentId: true,
      isFromBooking: true,
      source: true,
      campaignId: true,
      createdAt: true,
      updatedAt: true,
      master: { select: { id: true, name: true } as const },
    } as const

    const APPOINTMENTS_LIMIT = 500
    let appointments: Array<Record<string, unknown>>
    try {
      appointments = await prisma.appointment.findMany({
        where,
        select: { ...baseSelect, procedureDone: true },
        orderBy: { startTime: 'asc' },
        take: APPOINTMENTS_LIMIT,
      })
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err)
      if (msg.includes('procedureDone') || msg.includes('column') || msg.includes('does not exist')) {
        appointments = await prisma.appointment.findMany({
          where,
          select: baseSelect,
          orderBy: { startTime: 'asc' },
          take: APPOINTMENTS_LIMIT,
        }) as Array<Record<string, unknown>>
        appointments.forEach((a) => { a.procedureDone = null })
      } else {
        throw err
      }
    }

    return NextResponse.json(appointments)
  } catch (error) {
    console.error('Error fetching appointments:', error)
    return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 400 })
  }
}


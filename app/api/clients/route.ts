import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jsonSafe } from '@/lib/utils/json'

function normalizeTags(tags: unknown): string | null {
  if (tags === null || tags === undefined) return null
  if (Array.isArray(tags)) {
    const cleaned = tags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter(Boolean)
    return cleaned.length > 0 ? JSON.stringify(cleaned) : null
  }
  if (typeof tags === 'string') {
    const raw = tags.trim()
    if (!raw) return null
    // If it's already JSON, keep it
    if (raw.startsWith('[')) return raw
    const cleaned = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    return cleaned.length > 0 ? JSON.stringify(cleaned) : null
  }
  return null
}

function normalizeMetadata(metadata: unknown): string | null {
  if (metadata === null || metadata === undefined) return null
  if (typeof metadata === 'string') {
    const raw = metadata.trim()
    return raw ? raw : null
  }
  try {
    return JSON.stringify(metadata)
  } catch {
    return null
  }
}

const CLIENT_STATUS_VALUES = ['new', 'regular', 'vip', 'inactive'] as const
function normalizeStatus(status: unknown): string {
  if (typeof status === 'string' && status.trim()) {
    const s = status.trim().toLowerCase()
    if (CLIENT_STATUS_VALUES.includes(s as any)) return s
  }
  return 'new'
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const phone = searchParams.get('phone')

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    const where: any = { businessId }
    if (phone) {
      where.phone = phone
    }

    const clients = await prisma.client.findMany({
      where,
      include: {
        appointments: {
          orderBy: { startTime: 'desc' },
          take: 5,
          select: {
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(jsonSafe(clients))
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  let body: any = null
  try {
    body = await request.json()
    const { businessId, name, phone, email, notes, tags, metadata, status } = body

    if (!businessId || !name || !phone) {
      return NextResponse.json(
        { error: 'businessId, name, and phone are required' },
        { status: 400 }
      )
    }

    // Нормалізуємо телефон
    let normalizedPhone = phone.replace(/\s/g, '').replace(/[()-]/g, '')
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = `+380${normalizedPhone.slice(1)}`
    } else if (normalizedPhone.startsWith('380')) {
      normalizedPhone = `+${normalizedPhone}`
    } else if (!normalizedPhone.startsWith('+380')) {
      normalizedPhone = `+380${normalizedPhone}`
    }

    // Перевіряємо, чи клієнт вже існує
    const existing = await prisma.client.findFirst({
      where: {
        businessId,
        phone: normalizedPhone,
      },
    })

    if (existing) {
      // Оновлюємо існуючого клієнта
      const updated = await prisma.client.update({
        where: { id: existing.id },
        data: {
          name: name.trim(),
          email: email?.trim() || null,
          notes: notes?.trim() || null,
          ...(tags !== undefined ? { tags: normalizeTags(tags) } : {}),
          ...(metadata !== undefined ? { metadata: normalizeMetadata(metadata) } : {}),
        },
      })

      return NextResponse.json(jsonSafe(updated), { status: 200 })
    }

    // Створюємо нового клієнта
    const client = await prisma.client.create({
      data: {
        businessId,
        name: name.trim(),
        phone: normalizedPhone,
        email: email?.trim() || null,
        notes: notes?.trim() || null,
        tags: normalizeTags(tags),
        metadata: normalizeMetadata(metadata),
        status: normalizeStatus(status),
      },
    })

    // Додаємо номер телефону в Реєстр телефонів
    try {
      const { addClientPhoneToDirectory } = await import('@/lib/services/management-center')
      await addClientPhoneToDirectory(
        normalizedPhone,
        businessId,
        client.id,
        name.trim()
      )
    } catch (error) {
      console.error('Error adding client phone to directory:', error)
      // Не викидаємо помилку, щоб не зламати створення клієнта
    }

    return NextResponse.json(jsonSafe(client), { status: 201 })
  } catch (error: any) {
    console.error('Error creating client:', error)
    
    // Обробка помилки унікального обмеження
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Клієнт з таким номером телефону вже існує' },
        { status: 409 }
      )
    }

    // Більш детальна обробка помилок
    const errorMessage = error?.message || 'Failed to create client'
    console.error('Client creation error details:', {
      error: error?.message,
      code: error?.code,
      message: errorMessage,
      businessId: body?.businessId,
      phone: body?.phone,
    })
    
    return NextResponse.json(
      { 
        error: 'Не вдалося створити клієнта',
        details: errorMessage,
        code: error?.code,
      },
      { status: 500 }
    )
  }
}


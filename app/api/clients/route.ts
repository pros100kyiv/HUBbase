import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(clients)
  } catch (error) {
    console.error('Error fetching clients:', error)
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { businessId, name, phone, email, notes } = body

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
        },
      })

      return NextResponse.json(updated, { status: 200 })
    }

    // Створюємо нового клієнта
    const client = await prisma.client.create({
      data: {
        businessId,
        name: name.trim(),
        phone: normalizedPhone,
        email: email?.trim() || null,
        notes: notes?.trim() || null,
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

    return NextResponse.json(client, { status: 201 })
  } catch (error: any) {
    console.error('Error creating client:', error)
    
    // Обробка помилки унікального обмеження
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Клієнт з таким номером телефону вже існує' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create client', details: error?.message },
      { status: 500 }
    )
  }
}


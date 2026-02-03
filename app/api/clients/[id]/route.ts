import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const { id } = resolvedParams
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        appointments: {
          orderBy: { startTime: 'desc' },
        },
      },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Перевірка businessId для ізоляції даних
    if (businessId && client.businessId !== businessId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json(client)
  } catch (error) {
    console.error('Error fetching client:', error)
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const { id } = resolvedParams
    const body = await request.json()
    const { name, phone, email, notes, businessId } = body

    // КРИТИЧНО: Перевірка businessId для ізоляції даних
    if (businessId) {
      const client = await prisma.client.findUnique({
        where: { id },
        select: { businessId: true },
      })

      if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      }

      if (client.businessId !== businessId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (email !== undefined) updateData.email = email?.trim() || null
    if (notes !== undefined) updateData.notes = notes?.trim() || null

    if (phone !== undefined) {
      // Нормалізуємо телефон
      let normalizedPhone = phone.replace(/\s/g, '').replace(/[()-]/g, '')
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = `+380${normalizedPhone.slice(1)}`
      } else if (normalizedPhone.startsWith('380')) {
        normalizedPhone = `+${normalizedPhone}`
      } else if (!normalizedPhone.startsWith('+380')) {
        normalizedPhone = `+380${normalizedPhone}`
      }
      updateData.phone = normalizedPhone
    }

    const client = await prisma.client.update({
      where: { id },
      data: updateData,
    })

    // Оновлюємо номер телефону в Реєстрі телефонів (якщо змінився)
    if (phone !== undefined && businessId) {
      try {
        const { addClientPhoneToDirectory } = await import('@/lib/services/management-center')
        await addClientPhoneToDirectory(
          updateData.phone,
          businessId,
          client.id,
          client.name
        )
      } catch (error) {
        console.error('Error updating client phone in directory:', error)
      }
    }

    return NextResponse.json(client)
  } catch (error: any) {
    console.error('Error updating client:', error)
    
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Клієнт з таким номером телефону вже існує' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update client', details: error?.message },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const { id } = resolvedParams
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')

    // КРИТИЧНО: Перевірка businessId для ізоляції даних
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Перевіряємо, чи клієнт належить цьому бізнесу
    const client = await prisma.client.findUnique({
      where: { id },
      select: { businessId: true },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (client.businessId !== businessId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    await prisma.client.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting client:', error)
    
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Failed to delete client', details: error?.message },
      { status: 500 }
    )
  }
}


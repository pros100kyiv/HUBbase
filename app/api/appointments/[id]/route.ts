import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyBusinessOwnership } from '@/lib/middleware/business-isolation'

function normalizeUaPhone(phone: string): string {
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
  try {
    const parsed = typeof services === 'string' ? JSON.parse(services) : services
    if (!Array.isArray(parsed)) return null
    return JSON.stringify(parsed)
  } catch {
    return null
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = context.params
    const resolvedParams = typeof (params as Promise<unknown>)?.then === 'function'
      ? await (params as Promise<{ id?: string }>)
      : (params as { id?: string })
    const appointmentId = resolvedParams?.id
    if (!appointmentId || typeof appointmentId !== 'string') {
      return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (!body || typeof body !== 'object') {
      body = {}
    }

    const { searchParams } = new URL(request.url)
    const businessId = (body.businessId ?? searchParams.get('businessId')) as string | undefined
    const {
      status,
      startTime,
      endTime,
      masterId,
      clientName,
      clientPhone,
      clientEmail,
      services,
      notes,
      customPrice,
      customServiceName,
      customService,
      procedureDone,
    } = body as Record<string, unknown>

    if (!businessId || typeof businessId !== 'string') {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Перевіряємо, чи запис належить цьому бізнесу
    const isOwner = await verifyBusinessOwnership(businessId, 'appointment', appointmentId)
    if (!isOwner) {
      return NextResponse.json({ error: 'Appointment not found or access denied' }, { status: 404 })
    }

    const ALLOWED_STATUSES = ['Pending', 'Confirmed', 'Done', 'Cancelled'] as const
    const updateData: Record<string, unknown> = {}
    if (status !== undefined && status !== null) {
      const statusStr = String(status)
      if (!ALLOWED_STATUSES.includes(statusStr as typeof ALLOWED_STATUSES[number])) {
        return NextResponse.json(
          { error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` },
          { status: 400 }
        )
      }
      updateData.status = statusStr
    }
    if (startTime) updateData.startTime = new Date(startTime as string | number)
    if (endTime) updateData.endTime = new Date(endTime as string | number)
    if (masterId) updateData.masterId = masterId
    if (clientName != null && String(clientName).trim()) updateData.clientName = String(clientName).trim()
    if (clientPhone != null && String(clientPhone).trim()) updateData.clientPhone = normalizeUaPhone(String(clientPhone))
    if (clientEmail !== undefined) {
      updateData.clientEmail =
        typeof clientEmail === 'string' && clientEmail.trim() ? clientEmail.trim() : null
    }
    if (services !== undefined) {
      // Послуги можуть бути порожнім масивом
      try {
        const parsed = typeof services === 'string' ? JSON.parse(services) : services
        if (!Array.isArray(parsed)) {
          return NextResponse.json(
            { error: 'Invalid services format. Expected array of service IDs.' },
            { status: 400 }
          )
        }
        updateData.services = JSON.stringify(parsed)
      } catch {
        return NextResponse.json(
          { error: 'Invalid services format. Expected array of service IDs.' },
          { status: 400 }
        )
      }
    }
    if (notes !== undefined) updateData.notes = String(notes ?? '').trim() || null
    if (procedureDone !== undefined) updateData.procedureDone = typeof procedureDone === 'string' && procedureDone.trim() ? procedureDone.trim() : null
    if (customPrice !== undefined) updateData.customPrice = customPrice || null
    if (customServiceName !== undefined) {
      updateData.customServiceName = typeof customServiceName === 'string' && customServiceName.trim() ? customServiceName.trim() : null
    } else if (customService !== undefined) {
      updateData.customServiceName = typeof customService === 'string' && customService.trim() ? customService.trim() : null
    }

    // Якщо змінюємо тільки статус — просте оновлення без транзакції
    const isStatusOnlyUpdate = Object.keys(updateData).length === 1 && updateData.status !== undefined
    if (isStatusOnlyUpdate) {
      const appointment = await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: updateData.status as 'Pending' | 'Confirmed' | 'Done' | 'Cancelled' },
      })
      return NextResponse.json(appointment)
    }

    // Якщо змінюємо дані клієнта — оновлюємо/створюємо клієнта і прив'язуємо appointment.clientId
    const shouldEnsureClient = Boolean(updateData.clientPhone && updateData.clientName)

    const appointment = await prisma.$transaction(async (tx) => {
      if (shouldEnsureClient) {
        const phone = String(updateData.clientPhone ?? '')
        const name = String(updateData.clientName ?? '')
        const ensuredClient = await tx.client.upsert({
          where: {
            businessId_phone: {
              businessId,
              phone,
            },
          },
          create: {
            businessId,
            name,
            phone,
            email: (updateData.clientEmail ?? null) as string | null,
          },
          update: {
            name,
            ...(updateData.clientEmail !== undefined ? { email: updateData.clientEmail } : {}),
          },
        })

        updateData.clientId = ensuredClient.id

        try {
          const { addClientPhoneToDirectory } = await import('@/lib/services/management-center')
          await addClientPhoneToDirectory(
            phone,
            businessId,
            ensuredClient.id,
            name
          )
        } catch (e) {
          console.error('Error adding client phone to directory:', e)
        }
      }

      return tx.appointment.update({
        where: { id: appointmentId },
        data: updateData as Record<string, unknown>,
      })
    })

    return NextResponse.json(appointment)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    const prismaCode = (error as { code?: string })?.code
    console.error('Error updating appointment:', error)

    // Prisma P2025 = Record not found
    if (prismaCode === 'P2025') {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Failed to update appointment', details: process.env.NODE_ENV === 'development' ? msg : undefined },
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
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    
    // Також перевіряємо body для businessId (якщо передано через POST/PATCH)
    let finalBusinessId = businessId
    if (!finalBusinessId) {
      try {
        const body = await request.json().catch(() => ({}))
        finalBusinessId = body.businessId
      } catch {
        // Ignore
      }
    }

    // КРИТИЧНО: Перевірка businessId для ізоляції даних
    if (!finalBusinessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Перевіряємо, чи запис належить цьому бізнесу
    const isOwner = await verifyBusinessOwnership(finalBusinessId, 'appointment', resolvedParams.id)
    if (!isOwner) {
      return NextResponse.json({ error: 'Appointment not found or access denied' }, { status: 404 })
    }

    await prisma.appointment.delete({
      where: { id: resolvedParams.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting appointment:', error)
    return NextResponse.json({ error: 'Failed to delete appointment' }, { status: 500 })
  }
}


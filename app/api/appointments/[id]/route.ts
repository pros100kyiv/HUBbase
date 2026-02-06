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
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return JSON.stringify(parsed)
  } catch {
    return null
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const body = await request.json()
    const { 
      businessId, 
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
    } = body

    // КРИТИЧНО: Перевірка businessId для ізоляції даних
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
    }

    // Перевіряємо, чи запис належить цьому бізнесу
    const isOwner = await verifyBusinessOwnership(businessId, 'appointment', resolvedParams.id)
    if (!isOwner) {
      return NextResponse.json({ error: 'Appointment not found or access denied' }, { status: 404 })
    }

    const updateData: any = {}
    if (status !== undefined) updateData.status = status
    if (startTime) updateData.startTime = new Date(startTime)
    if (endTime) updateData.endTime = new Date(endTime)
    if (masterId) updateData.masterId = masterId
    if (clientName) updateData.clientName = clientName.trim()
    if (clientPhone) updateData.clientPhone = normalizeUaPhone(clientPhone)
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
    if (notes !== undefined) updateData.notes = notes?.trim() || null
    if (customPrice !== undefined) updateData.customPrice = customPrice || null

    // Якщо змінюємо дані клієнта — оновлюємо/створюємо клієнта і прив'язуємо appointment.clientId
    const shouldEnsureClient = Boolean(updateData.clientPhone && updateData.clientName)

    const appointment = await prisma.$transaction(async (tx) => {
      if (shouldEnsureClient) {
        const ensuredClient = await tx.client.upsert({
          where: {
            businessId_phone: {
              businessId,
              phone: updateData.clientPhone,
            },
          },
          create: {
            businessId,
            name: updateData.clientName,
            phone: updateData.clientPhone,
            email: updateData.clientEmail ?? null,
          },
          update: {
            name: updateData.clientName,
            ...(updateData.clientEmail !== undefined ? { email: updateData.clientEmail } : {}),
          },
        })

        updateData.clientId = ensuredClient.id

        // Оновлюємо телефон в Реєстрі телефонів (не блокуємо PATCH)
        try {
          const { addClientPhoneToDirectory } = await import('@/lib/services/management-center')
          await addClientPhoneToDirectory(
            updateData.clientPhone,
            businessId,
            ensuredClient.id,
            updateData.clientName
          )
        } catch (e) {
          console.error('Error adding client phone to directory:', e)
        }
      }

      return tx.appointment.update({
        where: { 
          id: resolvedParams.id,
          businessId // Додаткова перевірка на рівні бази даних
        },
        data: updateData,
      })
    })

    return NextResponse.json(appointment)
  } catch (error) {
    console.error('Error updating appointment:', error)
    return NextResponse.json({ error: 'Failed to update appointment' }, { status: 500 })
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
      where: { 
        id: resolvedParams.id,
        businessId: finalBusinessId // Додаткова перевірка на рівні бази даних
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting appointment:', error)
    return NextResponse.json({ error: 'Failed to delete appointment' }, { status: 500 })
  }
}


import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyBusinessOwnership } from '@/lib/middleware/business-isolation'

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
      services,
      notes,
      customService,
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
    if (clientPhone) updateData.clientPhone = clientPhone.trim()
    if (services !== undefined) updateData.services = typeof services === 'string' ? services : JSON.stringify(services)
    if (notes !== undefined) updateData.notes = notes?.trim() || null
    if (customService !== undefined) updateData.customService = customService?.trim() || null
    if (customPrice !== undefined) updateData.customPrice = customPrice || null

    const appointment = await prisma.appointment.update({
      where: { 
        id: resolvedParams.id,
        businessId // Додаткова перевірка на рівні бази даних
      },
      data: updateData,
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


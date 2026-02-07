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
    let { businessId, name, price, duration, category, subcategory } = body

    // Якщо businessId не передано — отримуємо з запису послуги
    if (!businessId) {
      const service = await prisma.service.findUnique({
        where: { id: resolvedParams.id },
        select: { businessId: true },
      })
      if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })
      businessId = service.businessId
    }

    // Перевіряємо, чи запис належить цьому бізнесу
    const isOwner = await verifyBusinessOwnership(businessId, 'service', resolvedParams.id)
    if (!isOwner) {
      return NextResponse.json({ error: 'Service not found or access denied' }, { status: 404 })
    }

    const service = await prisma.service.update({
      where: { 
        id: resolvedParams.id,
        businessId // Додаткова перевірка на рівні бази даних
      },
      data: {
        ...(name && { name }),
        ...(price !== undefined && { price: parseInt(price) }),
        ...(duration !== undefined && { duration: parseInt(duration) }),
        ...(category !== undefined && { category }),
        ...(subcategory !== undefined && { subcategory }),
      },
    })

    return NextResponse.json(service)
  } catch (error) {
    console.error('Error updating service:', error)
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const { searchParams } = new URL(request.url)
    let businessId = searchParams.get('businessId')

    // Якщо businessId не передано — отримуємо з запису послуги
    if (!businessId) {
      const service = await prisma.service.findUnique({
        where: { id: resolvedParams.id },
        select: { businessId: true },
      })
      if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 })
      businessId = service.businessId
    }

    // Перевіряємо, чи запис належить цьому бізнесу
    const isOwner = await verifyBusinessOwnership(businessId, 'service', resolvedParams.id)
    if (!isOwner) {
      return NextResponse.json({ error: 'Service not found or access denied' }, { status: 404 })
    }

    await prisma.service.delete({
      where: { 
        id: resolvedParams.id,
        businessId // Додаткова перевірка на рівні бази даних
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting service:', error)
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 })
  }
}


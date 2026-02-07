import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyBusinessOwnership } from '@/lib/middleware/business-isolation'
import { jsonSafe } from '@/lib/utils/json'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const body = await request.json()
    let { businessId, name, photo, bio, rating, isActive, workingHours, blockedPeriods } = body

    // Якщо businessId не передано — отримуємо з запису майстра (для викликів з налаштувань)
    if (!businessId) {
      const master = await prisma.master.findUnique({
        where: { id: resolvedParams.id },
        select: { businessId: true },
      })
      if (!master) return NextResponse.json({ error: 'Master not found' }, { status: 404 })
      businessId = master.businessId
    }

    // Перевіряємо, чи запис належить цьому бізнесу
    const isOwner = await verifyBusinessOwnership(businessId, 'master', resolvedParams.id)
    if (!isOwner) {
      return NextResponse.json({ error: 'Master not found or access denied' }, { status: 404 })
    }

    const master = await prisma.master.update({
      where: { 
        id: resolvedParams.id,
        businessId // Додаткова перевірка на рівні бази даних
      },
      data: {
        ...(name && { name }),
        ...(photo !== undefined && { photo }),
        ...(bio !== undefined && { bio }),
        ...(rating !== undefined && { rating }),
        ...(isActive !== undefined && { isActive }),
        ...(workingHours !== undefined && { workingHours }),
        ...(blockedPeriods !== undefined && { blockedPeriods }),
      },
    })

    return NextResponse.json(jsonSafe(master))
  } catch (error) {
    console.error('Error updating master:', error)
    return NextResponse.json({ error: 'Failed to update master' }, { status: 500 })
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

    // Якщо businessId не передано — отримуємо з запису майстра
    if (!businessId) {
      const master = await prisma.master.findUnique({
        where: { id: resolvedParams.id },
        select: { businessId: true },
      })
      if (!master) return NextResponse.json({ error: 'Master not found' }, { status: 404 })
      businessId = master.businessId
    }

    // Перевіряємо, чи запис належить цьому бізнесу
    const isOwner = await verifyBusinessOwnership(businessId, 'master', resolvedParams.id)
    if (!isOwner) {
      return NextResponse.json({ error: 'Master not found or access denied' }, { status: 404 })
    }

    await prisma.master.delete({
      where: { 
        id: resolvedParams.id,
        businessId // Додаткова перевірка на рівні бази даних
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting master:', error)
    return NextResponse.json({ error: 'Failed to delete master' }, { status: 500 })
  }
}


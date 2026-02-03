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
    const { businessId, name, photo, bio, rating, isActive, workingHours, blockedPeriods } = body

    // КРИТИЧНО: Перевірка businessId для ізоляції даних
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
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

    return NextResponse.json(master)
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
    const businessId = searchParams.get('businessId')

    // КРИТИЧНО: Перевірка businessId для ізоляції даних
    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 })
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


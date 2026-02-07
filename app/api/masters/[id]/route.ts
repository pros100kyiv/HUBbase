import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyBusinessOwnership } from '@/lib/middleware/business-isolation'
import { jsonSafe } from '@/lib/utils/json'

function toScheduleJson(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
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
    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Невірний формат JSON' }, { status: 400 })
    }
    let businessId = body.businessId as string | undefined
    const name = body.name as string | undefined
    const photo = body.photo as string | undefined
    const bio = body.bio as string | undefined
    const rating = body.rating as number | undefined
    const isActive = body.isActive as boolean | undefined
    const workingHoursRaw = body.workingHours
    const scheduleDateOverridesRaw = body.scheduleDateOverrides

    // Якщо businessId не передано — отримуємо з запису майстра (для викликів з налаштувань)
    if (!businessId) {
      const master = await prisma.master.findUnique({
        where: { id: resolvedParams.id },
        select: { businessId: true },
      })
      if (!master) return NextResponse.json({ error: 'Master not found' }, { status: 404 })
      businessId = master.businessId
    }
    const bid = String(businessId)

    // Перевіряємо, чи запис належить цьому бізнесу
    const isOwner = await verifyBusinessOwnership(bid, 'master', resolvedParams.id)
    if (!isOwner) {
      return NextResponse.json({ error: 'Master not found or access denied' }, { status: 404 })
    }

    const workingHours = workingHoursRaw !== undefined ? toScheduleJson(workingHoursRaw) : undefined
    const scheduleDateOverrides = scheduleDateOverridesRaw !== undefined ? toScheduleJson(scheduleDateOverridesRaw) : undefined

    const master = await prisma.master.update({
      where: {
        id: resolvedParams.id,
        businessId: bid,
      },
      data: {
        ...(name != null && name !== '' && { name: String(name).trim() }),
        ...(photo !== undefined && { photo: photo != null ? String(photo).trim() || null : null }),
        ...(bio !== undefined && { bio: bio != null ? String(bio).trim() || null : null }),
        ...(rating !== undefined && { rating: Number(rating) || 0 }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(workingHours !== undefined && { workingHours }),
        ...(scheduleDateOverrides !== undefined && { scheduleDateOverrides }),
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


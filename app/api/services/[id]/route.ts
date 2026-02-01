import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const body = await request.json()
    const { name, price, duration, category, subcategory } = body

    // Конвертуємо ціну з гривень в копійки (користувач вводить в гривнях)
    const updateData: any = {}
    if (name) updateData.name = name
    if (price !== undefined) {
      updateData.price = Math.round(parseFloat(price) * 100)
    }
    if (duration !== undefined) updateData.duration = parseInt(duration)
    if (category !== undefined) updateData.category = category
    if (subcategory !== undefined) updateData.subcategory = subcategory

    const service = await prisma.service.update({
      where: { id: resolvedParams.id },
      data: updateData,
    })

    return NextResponse.json(service)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    await prisma.service.delete({
      where: { id: resolvedParams.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 })
  }
}


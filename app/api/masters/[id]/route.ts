import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const body = await request.json()
    const { name, photo, bio, rating, isActive, workingHours, blockedPeriods } = body

    const master = await prisma.master.update({
      where: { id: resolvedParams.id },
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
    return NextResponse.json({ error: 'Failed to update master' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    await prisma.master.delete({
      where: { id: resolvedParams.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete master' }, { status: 500 })
  }
}


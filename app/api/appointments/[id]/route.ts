import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const body = await request.json()
    const { 
      status, 
      startTime, 
      endTime, 
      customPrice,
      masterId,
      clientName,
      clientPhone,
      clientEmail,
      services,
      notes
    } = body

    const updateData: any = {}
    if (status) updateData.status = status
    if (startTime) updateData.startTime = new Date(startTime)
    if (endTime) updateData.endTime = new Date(endTime)
    if (customPrice !== undefined) {
      updateData.customPrice = customPrice ? parseInt(customPrice) : null
    }
    if (masterId) updateData.masterId = masterId
    if (clientName) updateData.clientName = clientName.trim()
    if (clientPhone) updateData.clientPhone = clientPhone.trim()
    if (clientEmail !== undefined) updateData.clientEmail = clientEmail?.trim() || null
    if (services) updateData.services = typeof services === 'string' ? services : JSON.stringify(services)
    if (notes !== undefined) updateData.notes = notes?.trim() || null

    const appointment = await prisma.appointment.update({
      where: { id: resolvedParams.id },
      data: updateData,
    })

    return NextResponse.json(appointment)
  } catch (error) {
    console.error('Error updating appointment:', error)
    return NextResponse.json({ 
      error: 'Failed to update appointment',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    await prisma.appointment.delete({
      where: { id: resolvedParams.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete appointment' }, { status: 500 })
  }
}

